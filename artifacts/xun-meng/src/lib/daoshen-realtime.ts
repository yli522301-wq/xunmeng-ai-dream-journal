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
  onError?: (error: Error) => void;
}

export class DaoshenRealtimeClient {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private callbacks: DaoshenRealtimeCallbacks;
  private stopped = false;
  private assistantTranscript = "";
  private assistantResponseActive = false;

  constructor(callbacks: DaoshenRealtimeCallbacks) {
    this.callbacks = callbacks;
  }

  get audioElement() { return this.remoteAudio; }

  async start(): Promise<void> {
    this.stopped = false;
    this.assistantTranscript = "";
    this.assistantResponseActive = false;
    this.callbacks.onPhase?.("connecting");

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (this.stopped) return this.stop();

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
      channel.onerror = () => this.fail(new Error("Realtime data channel error"));

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          this.fail(new Error(`Realtime connection ${peer.connectionState}`));
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch(`${API_BASE}/api/ai/realtime/daoshen/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Realtime handshake ${response.status}: ${detail.slice(0, 300)}`);
      }
      const answerSdp = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  setVolume(volume: number) {
    if (this.remoteAudio) this.remoteAudio.volume = Math.max(0, Math.min(1, volume));
  }

  stop() {
    if (this.stopped && !this.peer && !this.stream) return;
    this.stopped = true;
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
        this.fail(new Error(event.error?.message || "OpenAI Realtime error"));
        break;
    }
  }

  private fail(error: Error) {
    if (this.stopped) return;
    this.callbacks.onError?.(error);
  }
}
