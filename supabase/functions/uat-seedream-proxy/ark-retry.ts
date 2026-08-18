export function isRetryableArkNetworkError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error || "");
  return /tcp connect error|connection timed out|connect timeout|connection refused|network is unreachable|temporary failure in name resolution|name resolution|dns error|error sending request for url/i.test(message);
}

export type ArkRetryFailure = {
  attempt: number;
  retryable: boolean;
  message: string;
};

export async function fetchArkWithRetry(
  url: string,
  init: RequestInit = {},
  options: {
    fetcher?: typeof fetch;
    delaysMs?: number[];
    attemptTimeoutMs?: number;
    sleepFn?: (ms: number) => Promise<void>;
    onAttemptFailure?: (failure: ArkRetryFailure) => void;
  } = {},
) {
  const fetcher = options.fetcher || fetch;
  const sleepFn = options.sleepFn || ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const delaysMs = Array.isArray(options.delaysMs) && options.delaysMs.length ? options.delaysMs : [0, 4000];
  const attemptTimeoutMs = Math.max(30_000, Number(options.attemptTimeoutMs || 150_000));
  let lastError: unknown = null;

  for (let index = 0; index < delaysMs.length; index += 1) {
    if (delaysMs[index] > 0) await sleepFn(delaysMs[index]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("ark-image-attempt-timeout"), attemptTimeoutMs);
    try {
      return await fetcher(url, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
      const rawMessage = error instanceof Error ? error.message : String(error);
      const message = controller.signal.aborted ? `ARK_IMAGE_ATTEMPT_TIMEOUT:${rawMessage}` : rawMessage;
      // Only retry errors that prove the TCP/DNS connection itself failed.
      // Do not automatically retry our own request timeout: the provider may
      // already have accepted the paid generation request by that point.
      const retryable = !controller.signal.aborted && isRetryableArkNetworkError(error);
      options.onAttemptFailure?.({ attempt: index + 1, retryable, message });
      if (controller.signal.aborted) throw new Error(message);
      if (!retryable || index === delaysMs.length - 1) throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("ARK_NETWORK_FAILED");
}
