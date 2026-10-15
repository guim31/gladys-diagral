// -----------------------------------------------------------------------------
// The HTTP seam of the Diagral client: one function, `request`, over the
// global fetch of Node 22+. The tests replace it with the fake cloud of
// test/helpers/fakeCloud.js; nothing else in the code touches the network.
//
//   request({ method, url, headers, json, timeoutMs }) → { status, headers, body: Buffer }
//
// `json` is sent as application/json. A network failure throws a
// NetworkError with a `code` (ENOTFOUND, ECONNREFUSED, TIMEOUT…).
// (Adapted from guim31/gladys-simplisafe.)
// -----------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
// The configuration of a large installation is a few dozen kilobytes; the
// sandbox has 256 MB.
const MAX_BYTES = 2 * 1024 * 1024;

export class NetworkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NetworkError';
    this.code = code;
  }
}

async function readBody(response, controller) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    chunks.push(Buffer.from(chunk));
    if (size > MAX_BYTES) {
      controller.abort();
      throw new NetworkError('TOO_LARGE', `Answer larger than ${MAX_BYTES} bytes`);
    }
  }
  return Buffer.concat(chunks);
}

/** The production request, over fetch. */
export async function httpRequest({
  method = 'GET',
  url,
  headers = {},
  json,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  timer.unref?.();
  const init = {
    method,
    headers: { Accept: 'application/json', ...headers },
    redirect: 'manual',
    signal: controller.signal,
  };
  if (json !== undefined) {
    init.body = JSON.stringify(json);
    init.headers['Content-Type'] = 'application/json';
  }
  try {
    let response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      if (controller.signal.aborted) {
        throw new NetworkError('TIMEOUT', `No answer within ${timeoutMs / 1000} s`);
      }
      const code = err.cause?.code ?? err.code ?? 'NETWORK';
      throw new NetworkError(code, code);
    }
    try {
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await readBody(response, controller),
      };
    } catch (err) {
      if (err instanceof NetworkError) throw err;
      throw new NetworkError('TIMEOUT', `Answer interrupted: ${err.name}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
