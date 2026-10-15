// -----------------------------------------------------------------------------
// Client of the Diagral e-ONE cloud API ("Emerald", the API of the Diagral
// e-ONE app), read from pydiagral (GPL-3.0: read to learn the protocol,
// nothing copied) and its Home Assistant integration.
//
//   https://appv3.tt-monitor.com/emerald/v1/
//
// Two kinds of requests:
//   - with the account (e-mail, password): POST users/authenticate/login
//     gives a short-lived bearer token, used only to create (POST
//     users/api_key) and delete (DELETE users/systems/<serial>/api_keys/<key>)
//     an API key for one box;
//   - with that API key: every read and command, signed by an HMAC-SHA256 of
//     "<timestamp>.<serial>.<api key>" with the secret of the key (headers
//     X-HMAC, X-TIMESTAMP, X-APIKEY), plus the access code of the alarm
//     (X-PIN-CODE) for the state and the commands.
// The key is created once and kept in /data (`onKeys`): the password only
// travels to create a new one. A key the cloud refuses is replaced once, the
// old one deleted; refused again, the error is ACCESS (serial or access code)
// and nothing is retried until the configuration changes.
//
// Errors carry a `kind` (ERROR_KINDS) and a message that never holds a
// password, a code, a key or the body of the answer (a 422 of this API echoes
// the input it refused). The `detail` of an answer stays on the error for the
// code that needs it ("No anomalies found"), never in a log.
// -----------------------------------------------------------------------------

import { createHmac } from 'node:crypto';
import { NetworkError, httpRequest } from './http.js';

export const BASE_URL = 'https://appv3.tt-monitor.com/emerald/v1';

export const ERROR_KINDS = Object.freeze({
  // The e-mail or the password is refused.
  AUTH: 'auth',
  // The API key works no more, even renewed: the serial or the access code.
  ACCESS: 'access',
  // A request the cloud finds malformed (400, 422).
  BAD_REQUEST: 'bad_request',
  NOT_FOUND: 'not_found',
  RATE_LIMITED: 'rate_limited',
  SERVER: 'server',
  NETWORK: 'network',
  // The answer is not what the API documents.
  PROTOCOL: 'protocol',
});

export class DiagralError extends Error {
  constructor(kind, message, { status, detail } = {}) {
    super(message);
    this.name = 'DiagralError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

// The commands of the alarm and their path (POST systems/<serial>/<path>).
export const COMMAND_PATHS = Object.freeze({
  disarm: 'stop',
  arm: 'start',
  presence: 'presence',
  partial_1: 'partial_start_1',
  partial_2: 'partial_start_2',
  groups: 'activate_group',
});

/** The HMAC signature of a request (pydiagral: utils.generate_hmac_signature). */
export function signature({ timestamp, serial, apiKey, secretKey }) {
  return createHmac('sha256', secretKey).update(`${timestamp}.${serial}.${apiKey}`).digest('hex');
}

function detailOf(body) {
  const detail = body?.detail ?? body?.message;
  if (typeof detail === 'string') return detail;
  return detail === undefined ? undefined : JSON.stringify(detail);
}

export class DiagralClient {
  /**
   * @param {object} options
   * @param {{ username: string, password: string, serial: string, pinCode: string }} options.account
   * @param {{ apiKey?: string, secretKey?: string }} [options.keys] the key saved in /data
   * @param {(keys: { apiKey: string, secretKey: string } | null) => Promise<void>} [options.onKeys]
   * @param {Function} [options.request] HTTP seam (src/diagral/http.js)
   * @param {() => number} [options.now]
   */
  constructor({ account, keys = {}, onKeys = async () => {}, request = httpRequest, now }) {
    this.account = account;
    this.apiKey = keys.apiKey ?? null;
    this.secretKey = keys.secretKey ?? null;
    this.onKeys = onKeys;
    this.request = request;
    this.now = now ?? (() => Date.now());
    // Creating a key is serialized: two reads at once must not create two.
    this.creating = null;
  }

  get hasKey() {
    return Boolean(this.apiKey && this.secretKey);
  }

  // --- Transport ---------------------------------------------------------------

  async call(method, path, { headers = {}, json } = {}) {
    let response;
    try {
      response = await this.request({ method, url: `${BASE_URL}/${path}`, headers, json });
    } catch (err) {
      if (err instanceof NetworkError) {
        throw new DiagralError(ERROR_KINDS.NETWORK, `network: ${err.code}`);
      }
      throw err;
    }
    const { status } = response;
    let body = null;
    const raw = response.body?.toString('utf8') ?? '';
    if (raw.trim() !== '') {
      try {
        body = JSON.parse(raw);
      } catch {
        if (status < 400) {
          throw new DiagralError(ERROR_KINDS.PROTOCOL, `HTTP ${status}: not JSON`, { status });
        }
      }
    }
    if (status >= 200 && status < 300) return body;
    const options = { status, detail: detailOf(body) };
    const where = `${method} ${path.split('/')[0]}`;
    if (status === 401 || status === 403) {
      throw new DiagralError(ERROR_KINDS.ACCESS, `HTTP ${status} on ${where}`, options);
    }
    if (status === 404) {
      throw new DiagralError(ERROR_KINDS.NOT_FOUND, `HTTP 404 on ${where}`, options);
    }
    if (status === 429) {
      throw new DiagralError(ERROR_KINDS.RATE_LIMITED, `HTTP 429 on ${where}`, options);
    }
    if (status >= 500) {
      throw new DiagralError(ERROR_KINDS.SERVER, `HTTP ${status} on ${where}`, options);
    }
    throw new DiagralError(ERROR_KINDS.BAD_REQUEST, `HTTP ${status} on ${where}`, options);
  }

  // --- Account and API key -----------------------------------------------------

  /** A bearer token of the account. Refused credentials are an AUTH error. */
  async login() {
    const { username, password } = this.account;
    let body;
    try {
      body = await this.call('POST', 'users/authenticate/login?vendor=DIAGRAL', {
        json: { username, password },
      });
    } catch (err) {
      if ([ERROR_KINDS.ACCESS, ERROR_KINDS.BAD_REQUEST, ERROR_KINDS.NOT_FOUND].includes(err.kind)) {
        throw new DiagralError(ERROR_KINDS.AUTH, `sign-in refused (HTTP ${err.status})`, {
          status: err.status,
        });
      }
      throw err;
    }
    const token = body?.access_token;
    if (typeof token !== 'string' || token === '') {
      throw new DiagralError(ERROR_KINDS.PROTOCOL, 'sign-in answer without access_token');
    }
    return token;
  }

  /** Create an API key for the box (and delete `previous`, best effort). */
  async createKey(previous = null) {
    if (!this.creating) {
      this.creating = (async () => {
        const token = await this.login();
        const auth = { Authorization: `Bearer ${token}` };
        let body;
        try {
          body = await this.call('POST', 'users/api_key', {
            headers: auth,
            json: { serial_id: this.account.serial },
          });
        } catch (err) {
          // The account signs in but may not use this box: a wrong serial.
          if (
            [ERROR_KINDS.ACCESS, ERROR_KINDS.BAD_REQUEST, ERROR_KINDS.NOT_FOUND].includes(err.kind)
          ) {
            throw new DiagralError(ERROR_KINDS.ACCESS, `API key refused (HTTP ${err.status})`, {
              status: err.status,
            });
          }
          throw err;
        }
        if (typeof body?.api_key !== 'string' || typeof body?.secret_key !== 'string') {
          throw new DiagralError(ERROR_KINDS.PROTOCOL, 'API key answer without api_key/secret_key');
        }
        this.apiKey = body.api_key;
        this.secretKey = body.secret_key;
        await this.onKeys({ apiKey: this.apiKey, secretKey: this.secretKey });
        if (previous && previous !== this.apiKey) {
          await this.call(
            'DELETE',
            `users/systems/${encodeURIComponent(this.account.serial)}/api_keys/${encodeURIComponent(previous)}`,
            { headers: auth },
          ).catch(() => {});
        }
      })().finally(() => {
        this.creating = null;
      });
    }
    return this.creating;
  }

  /** Delete the key of this installation on the cloud and forget it. */
  async deleteKey() {
    const apiKey = this.apiKey;
    this.apiKey = null;
    this.secretKey = null;
    await this.onKeys(null);
    if (!apiKey) return;
    const token = await this.login();
    await this.call(
      'DELETE',
      `users/systems/${encodeURIComponent(this.account.serial)}/api_keys/${encodeURIComponent(apiKey)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  signedHeaders(withPin) {
    const timestamp = String(Math.floor(this.now() / 1000));
    const headers = {
      'X-HMAC': signature({
        timestamp,
        serial: this.account.serial,
        apiKey: this.apiKey,
        secretKey: this.secretKey,
      }),
      'X-TIMESTAMP': timestamp,
      'X-APIKEY': this.apiKey,
    };
    if (withPin) headers['X-PIN-CODE'] = this.account.pinCode;
    return headers;
  }

  /** A request signed with the API key; a refused key is replaced once. */
  async signed(method, path, { pin = false, json } = {}) {
    if (!this.hasKey) await this.createKey();
    const fullPath = `${path.replace('<serial>', encodeURIComponent(this.account.serial))}`;
    try {
      return await this.call(method, fullPath, { headers: this.signedHeaders(pin), json });
    } catch (err) {
      if (err.kind !== ERROR_KINDS.ACCESS) throw err;
    }
    // Revoked from the app, or created for another box: a new key, once.
    await this.createKey(this.apiKey);
    return this.call(method, fullPath, { headers: this.signedHeaders(pin), json });
  }

  // --- Reads -------------------------------------------------------------------

  configuration() {
    return this.signed('GET', 'systems/<serial>/configurations');
  }

  status() {
    return this.signed('GET', 'systems/<serial>/status', { pin: true });
  }

  /** The anomalies of the system; none is a 404 "No anomalies found". */
  async anomalies() {
    try {
      return await this.signed('GET', 'systems/<serial>/anomalies');
    } catch (err) {
      if (err.kind === ERROR_KINDS.NOT_FOUND) return null;
      throw err;
    }
  }

  // --- Commands ----------------------------------------------------------------

  /**
   * @param {keyof typeof COMMAND_PATHS} command
   * @param {number[]} [groups] for `groups`
   */
  command(command, groups) {
    const path = COMMAND_PATHS[command];
    if (!path) throw new DiagralError(ERROR_KINDS.BAD_REQUEST, `unknown command ${command}`);
    return this.signed('POST', `systems/<serial>/${path}`, {
      pin: true,
      json: command === 'groups' ? { groups } : undefined,
    });
  }

  // --- Webhook -----------------------------------------------------------------

  /** The webhook subscription of the box, or null when there is none. */
  async webhook() {
    try {
      return await this.signed('GET', 'webhooks/<serial>/subscription');
    } catch (err) {
      if (err.kind === ERROR_KINDS.NOT_FOUND) return null;
      throw err;
    }
  }

  /** Register (`create`) or replace the webhook address, for every kind of event. */
  setWebhook(url, { create }) {
    return this.signed(create ? 'POST' : 'PUT', 'webhooks/<serial>/subscription', {
      json: {
        webhook_url: url,
        subscribe_to_anomaly: true,
        subscribe_to_alert: true,
        subscribe_to_state: true,
      },
    });
  }

  deleteWebhook() {
    return this.signed('DELETE', 'webhooks/<serial>/subscription');
  }
}
