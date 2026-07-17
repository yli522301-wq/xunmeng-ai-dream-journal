import { API_BASE } from "@/lib/api";

export type DaoshenRealtimePhase = "connecting" | "listening" | "thinking" | "speaking" | "closed";

export interface DaoshenRealtimeCallbacks {
  onPhase?: (phase: DaoshenRealtimePhase) => void;
  onRemoteAudio?: (audio: HTMLAudioElement) => void;
  onUserTranscript?: (text: string) => void;
  onAssistantTranscriptStart?: () => void;
  onAssistantTranscriptDelta?: (text: string) => void;
  onAssistantTranscript?: (text: string) => void;
  onAssistantTranscriptEnd?: () => void;
  onError?: (error: RealtimeError) => void;
}

export interface RealtimeError {
  message: string;
  code: "mic_denied" | "ice_timeout" | "handshake_failed" | "proxy_unavailable"
    | "missing_realtime_access" | "connection_lost" | "channel_error" | "api_error" | "unknown";
}

const ICE_GATHERING_TIMEOUT_MS = 10_000;

export class DaoshenRealtimeClient {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private callbacks: DaoshenRealtimeCallbacks;
  private stopped = false;
  private starting = false;
  private assistantTranscript = "";
  private assistantResponseActive = false;

  constructor(callbacks: DaoshenRealtimeCallbacks) {
    this.callbacks = callbacks;
  }

  get audioElement() { return this.remoteAudio; }

  async start(): Promise<void> {
    // Prevent duplicate sessions — if already starting or running, bail out.
    if (this.starting || (!this.stopped && this.peer)) {
      throw new Error("Realtime session already in progress");
    }
    this.starting = true;
    this.stopped = false;
    this.assistantTranscript = "";
    this.assistantResponseActive = false;
    this.callbacks.onPhase?.("connecting");

    try {
      // ── Step 1: acquire microphone ──────────────────────────────────────────
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
      } catch (micError) {
        this.starting = false;
        this.callbacks.onError?.({
          message: "麦克风权限被拒绝",
          code: "mic_denied",
        });
        throw micError;
      }
      if (this.stopped) { this.starting = false; return this.stop(); }

      // ── Step 2: create peer connection and data channel ─────────────────────
      const peer = new RTCPeerConnection();
      this.peer = peer;
      this.stream.getTracks().forEach(track => peer.addTrack(track, this.stream!));

      const audio = new Audio();
      audio.autoplay = true;
      audio.setAttribute("playsinline", "");
      this.remoteAudio = audio;
      peer.ontrack = event => {
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        this.callbacks.onRemoteAudio?.(audio);
        void audio.play().catch(() => undefined);
      };

      const channel = peer.createDataChannel("oai-events");
      this.channel = channel;
      channel.onopen = () => this.callbacks.onPhase?.("listening");
      channel.onmessage = event => this.handleServerEvent(event.data);
      channel.onerror = () => this.fail({
        message: "Realtime 数据通道错误",
        code: "channel_error",
      });

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          this.fail({
            message: "Realtime 连接已断开",
            code: "connection_lost",
          });
        }
      };

      // ── Step 3: create offer and wait for ICE candidates ────────────────────
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      // Wait for ICE gathering to complete so the SDP offer is complete before
      // we send it to the server. Without this the offer may be missing candidates
      // and OpenAI's WebRTC endpoint will reject or drop the call.
      await this.waitForIceGathering(peer);

      if (this.stopped) { this.starting = false; return this.stop(); }

      // ── Step 4: handshake with our backend (which forwards to OpenAI) ───────
      const handshakeUrl = `${API_BASE}/api/ai/realtime/daoshen/call`;
      let response: Response;
      try {
        response = await fetch(handshakeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdp: peer.localDescription?.sdp ?? offer.sdp }),
        });
      } catch (fetchError) {
        this.starting = false;
        const msg = String(fetchError);
        if (msg.includes("NetworkError") || msg.includes("Failed to fetch")) {
          this.fail({ message: "当前代理不可用", code: "proxy_unavailable" });
        } else {
          this.fail({ message: "无法连接 OpenAI", code: "api_error" });
        }
        throw fetchError;
      }

      if (!response.ok) {
        this.starting = false;
        let detail: any = {};
        try { detail = await response.json(); } catch { /* use raw status */ }

        const status = detail.status ?? response.status;
        const type = detail.type as string | undefined;
        const message = detail.message as string | undefined;

        // Categorise the error for the user.
        if (status === 401 || type === "invalid_request_error" || String(message ?? "").includes("API key")) {
          this.fail({ message: "API Key 缺少 Realtime 权限", code: "missing_realtime_access" });
        } else if (status === 402 || type === "insufficient_quota") {
          this.fail({ message: "API 额度不足", code: "api_error" });
        } else if (detail.proxyError) {
          this.fail({ message: "当前代理不可用", code: "proxy_unavailable" });
        } else {
          const short = String(message ?? "").slice(0, 120);
          this.fail({ message: short ? `Realtime 会话建立失败: ${short}` : "Realtime 会话建立失败", code: "handshake_failed" });
        }
        throw new Error(`Realtime handshake ${status}`);
      }

      const answerSdp = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
      this.starting = false;
    } catch (error) {
      this.starting = false;
      // Only call fail if we haven't already called it in a specific handler above.
      if (!this.stopped) {
        const alreadyFailed = this.stopped;
        if (!alreadyFailed) {
          this.fail({ message: String(error instanceof Error ? error.message : error), code: "unknown" });
        }
      }
      throw error;
    }
  }

  /** Block until ICE gathering completes or times out. */
  private waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (peer.iceGatheringState === "complete") return resolve();

      const timeout = setTimeout(() => {
        peer.removeEventListener("icegatheringstatechange", onStateChange);
        // If we have at least some candidates, proceed anyway.
        if (peer.localDescription?.sdp?.includes("a=candidate")) {
          resolve();
        } else {
          this.fail({ message: "Realtime 会话建立失败: ICE 协商超时", code: "ice_timeout" });
          reject(new Error("ICE gathering timed out with no candidates"));
        }
      }, ICE_GATHERING_TIMEOUT_MS);

      const onStateChange = () => {
        if (peer.iceGatheringState === "complete") {
          clearTimeout(timeout);
          peer.removeEventListener("icegatheringstatechange", onStateChange);
          resolve();
        }
      };
      peer.addEventListener("icegatheringstatechange", onStateChange);
    });
  }

  setVolume(volume: number) {
    if (this.remoteAudio) this.remoteAudio.volume = Math.max(0, Math.min(1, volume));
  }

  stop() {
    if (this.stopped && !this.peer && !this.stream) return;
    this.stopped = true;
    this.starting = false;
    this.channel?.close();
    this.channel = null;
    this.peer?.close();
    this.peer = null;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
    }
    this.remoteAudio = null;
    this.endAssistantTranscript();
    this.callbacks.onPhase?.("closed");
  }

  private startAssistantTranscript() {
    this.assistantTranscript = "";
    if (!this.assistantResponseActive) {
      this.assistantResponseActive = true;
      this.callbacks.onAssistantTranscriptStart?.();
    }
  }

  private endAssistantTranscript() {
    if (!this.assistantResponseActive && !this.assistantTranscript) return;
    this.assistantResponseActive = false;
    this.assistantTranscript = "";
    this.callbacks.onAssistantTranscriptEnd?.();
  }

  private handleServerEvent(raw: string) {
    let event: any;
    try { event = JSON.parse(raw); } catch { return; }

    switch (event.type) {
      case "input_audio_buffer.speech_started":
        // A user interruption must remove the previous spoken line immediately.
        this.endAssistantTranscript();
        this.callbacks.onPhase?.("listening");
        break;
      case "input_audio_buffer.speech_stopped":
        this.callbacks.onPhase?.("thinking");
        break;
      case "response.created":
        this.startAssistantTranscript();
        break;
      case "output_audio_buffer.started":
        this.startAssistantTranscript();
        this.callbacks.onPhase?.("speaking");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
      case "response.cancelled":
        this.endAssistantTranscript();
        this.callbacks.onPhase?.("listening");
        break;
      case "response.done":
        // The response can be complete before the WebRTC audio buffer finishes.
        // Keep the final subtitle visible until output_audio_buffer.stopped.
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const text = String(event.transcript ?? "").trim();
        if (text) this.callbacks.onUserTranscript?.(text);
        break;
      }
      case "response.output_audio_transcript.delta": {
        this.startAssistantTranscript();
        const delta = String(event.delta ?? "");
        if (delta) {
          this.assistantTranscript += delta;
          this.callbacks.onAssistantTranscriptDelta?.(this.assistantTranscript);
        }
        break;
      }
      case "response.output_audio_transcript.done": {
        const text = String(event.transcript ?? this.assistantTranscript).trim();
        if (text) this.callbacks.onAssistantTranscriptDelta?.(text);
        if (text) this.callbacks.onAssistantTranscript?.(text);
        break;
      }
      case "error":
        this.fail({
          message: event.error?.message || "OpenAI Realtime error",
          code: "api_error",
        });
        break;
    }
  }

  private fail(error: RealtimeError) {
    if (this.stopped) return;
    this.stopped = true;
    this.callbacks.onError?.(error);
  }
}
