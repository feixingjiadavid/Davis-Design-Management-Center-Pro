import { fetchArkWithRetry } from "./ark-retry.ts";

const ARK_IMAGE_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const nativeFetch = globalThis.fetch.bind(globalThis);

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return String((input as Request)?.url || "");
}

// The existing proxy remains the source of truth for auth, request shaping,
// storage and Drive archival. This bootstrap only hardens the one unstable
// network boundary: Supabase Edge -> Volcengine Ark image generation.
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = requestUrl(input);
  if (url !== ARK_IMAGE_URL) return await nativeFetch(input, init);

  return await fetchArkWithRetry(url, init || {}, {
    fetcher: nativeFetch,
    delaysMs: [0, 4000],
    attemptTimeoutMs: 150_000,
    onAttemptFailure: ({ attempt, retryable, message }) => {
      console.error(JSON.stringify({
        event: "uat_seedream_ark_network_attempt_failed",
        attempt,
        retryable,
        message: String(message || "").slice(0, 500),
      }));
    },
  });
}) as typeof fetch;

await import("./index.ts");
