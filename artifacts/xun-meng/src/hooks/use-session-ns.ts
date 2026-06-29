import { useGetSessionNamespace } from "@workspace/api-client-react";

/**
 * Returns the current session's localStorage namespace token (16 hex chars),
 * or null while the request is in flight.
 *
 * Use this to prefix dream-related localStorage keys so that data is isolated
 * per server session rather than shared across all users of the same browser.
 * Preference keys (TTS, volume, avatars) are intentionally left global.
 */
export function useSessionNs(): string | null {
  const { data } = useGetSessionNamespace();
  return data?.ns ?? null;
}

/** Compute the namespaced key for the dream archive list. */
export function getDreamsKey(ns: string | null): string {
  return ns !== null ? `xm-saved-dreams-${ns}` : "xm-saved-dreams";
}

/** Compute the namespaced key for the resume-dream pointer. */
export function getResumeKey(ns: string | null): string {
  return ns !== null ? `xm-resume-dream-${ns}` : "xm-resume-dream";
}
