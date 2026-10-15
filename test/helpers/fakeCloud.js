// -----------------------------------------------------------------------------
// A fake Diagral e-ONE cloud behind the HTTP seam of src/diagral/http.js: the
// account, the API keys (with their HMAC signature checked like the cloud
// would), the state of the alarm and its commands, the anomalies and the
// webhook subscription. Every value is made up (test/fixtures/diagral).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { NetworkError } from '../../src/diagral/http.js';
import { signature } from '../../src/diagral/client.js';

export const SERIAL = 'BOXSERIAL0001';
export const USERNAME = 'camille@example.com';
export const PASSWORD = 'correct horse battery staple';
export const PIN = '480913';
export const USER_NAME = 'Camille';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/diagral/${name}.json`, import.meta.url), 'utf8'));

const reply = (status, body) => ({
  status,
  headers: { 'content-type': 'application/json' },
  body: Buffer.from(body === undefined ? '' : JSON.stringify(body)),
});

export class FakeCloud {
  constructor() {
    this.online = true;
    this.requests = [];
    this.password = PASSWORD;
    this.pin = PIN;
    this.serial = SERIAL;
    this.configuration = fixture('configuration');
    this.status = fixture('status-off');
    this.anomalies = null; // null: 404 "No anomalies found"
    this.tokens = new Set();
    this.keys = new Map(); // api key → secret
    this.created = 0;
    this.webhook = null;
    this.failures = [];
    this.request = this.request.bind(this);
  }

  /** The next `times` requests whose path matches answer `status`. */
  fail(match, status, times = Infinity) {
    this.failures.push({ match, status, times });
  }

  /** Revoke every API key (as deleting them from the app would). */
  revokeKeys() {
    this.keys.clear();
  }

  /** The exit delay ends. */
  endExitDelay() {
    if (this.status.status.startsWith('TEMPO')) {
      this.status = { status: 'GROUP', activated_groups: this.status.activated_groups };
    }
  }

  /** Every secret the cloud saw or gave: none may reach a log. */
  secrets() {
    return [
      PASSWORD,
      PIN,
      ...this.tokens,
      ...this.keys.keys(),
      ...this.keys.values(),
      ...this.requests.map((r) => r.headers['X-HMAC']).filter(Boolean),
    ];
  }

  count(method, pattern) {
    return this.requests.filter((r) => r.method === method && pattern.test(r.path)).length;
  }

  async request({ method = 'GET', url, headers = {}, json }) {
    const parsed = new URL(url);
    const path = `${parsed.pathname.replace(/^\/emerald\/v1\//, '')}${parsed.search}`;
    this.requests.push({ method, path, headers, json });
    if (!this.online) throw new NetworkError('ENOTFOUND', 'ENOTFOUND');
    const failure = this.failures.find((entry) => entry.times > 0 && entry.match.test(path));
    if (failure) {
      failure.times -= 1;
      return reply(failure.status, { detail: `failure injected (${failure.status})` });
    }
    return this.route(method, path, headers, json);
  }

  bearer(headers) {
    const token = String(headers.Authorization ?? '').replace(/^Bearer /, '');
    return this.tokens.has(token);
  }

  signed(headers, { pin = false } = {}) {
    const apiKey = headers['X-APIKEY'];
    const secretKey = this.keys.get(apiKey);
    if (!secretKey) return false;
    const expected = signature({
      timestamp: headers['X-TIMESTAMP'],
      serial: this.serial,
      apiKey,
      secretKey,
    });
    if (headers['X-HMAC'] !== expected) return false;
    return !pin || headers['X-PIN-CODE'] === this.pin;
  }

  route(method, path, headers, json) {
    const serial = encodeURIComponent(this.serial);
    if (method === 'POST' && path === 'users/authenticate/login?vendor=DIAGRAL') {
      if (json?.username !== USERNAME || json?.password !== this.password) {
        return reply(401, { detail: 'Invalid credentials' });
      }
      const token = `token-${this.tokens.size + 1}-${Math.random().toString(36).slice(2)}`;
      this.tokens.add(token);
      return reply(200, { access_token: token });
    }
    if (method === 'POST' && path === 'users/api_key') {
      if (!this.bearer(headers)) return reply(401, { detail: 'Unauthorized' });
      if (json?.serial_id !== this.serial) return reply(403, { detail: 'Not your system' });
      this.created += 1;
      const apiKey = `apikey-${this.created}-${Math.random().toString(36).slice(2)}`;
      const secretKey = `secret-${this.created}-${Math.random().toString(36).slice(2)}`;
      this.keys.set(apiKey, secretKey);
      return reply(200, { api_key: apiKey, secret_key: secretKey });
    }
    const keyMatch = path.match(/^users\/systems\/([^/]+)\/api_keys\/(.+)$/);
    if (method === 'DELETE' && keyMatch) {
      if (!this.bearer(headers)) return reply(401, { detail: 'Unauthorized' });
      this.keys.delete(decodeURIComponent(keyMatch[2]));
      return reply(200, {});
    }

    if (path === `systems/${serial}/configurations` && method === 'GET') {
      if (!this.signed(headers)) return reply(401, { detail: 'Invalid signature' });
      return reply(200, this.configuration);
    }
    if (path === `systems/${serial}/status` && method === 'GET') {
      if (!this.signed(headers, { pin: true })) return reply(401, { detail: 'Unauthorized' });
      return reply(200, this.status);
    }
    if (path === `systems/${serial}/anomalies` && method === 'GET') {
      if (!this.signed(headers)) return reply(401, { detail: 'Invalid signature' });
      if (!this.anomalies) return reply(404, { detail: 'No anomalies found' });
      return reply(200, this.anomalies);
    }
    const command = path.match(new RegExp(`^systems/${serial}/([a-z_0-9]+)$`));
    if (method === 'POST' && command) {
      if (!this.signed(headers, { pin: true })) return reply(401, { detail: 'Unauthorized' });
      const all = this.configuration.groups.map((group) => group.index);
      switch (command[1]) {
        case 'stop':
          this.status = { status: 'OFF', activated_groups: [] };
          break;
        case 'start':
          this.status = { status: 'TEMPO_GROUP', activated_groups: all };
          break;
        case 'presence':
          this.status = { status: 'PRESENCE', activated_groups: this.configuration.presenceGroup };
          break;
        case 'partial_start_1':
          this.status = { status: 'TEMPO_1', activated_groups: this.configuration.partialGroup1 };
          break;
        case 'partial_start_2':
          this.status = { status: 'TEMPO_2', activated_groups: this.configuration.partialGroup2 };
          break;
        case 'activate_group':
          if (!Array.isArray(json?.groups) || json.groups.some((g) => !all.includes(g))) {
            return reply(422, { detail: [{ msg: 'bad groups', input: json }] });
          }
          this.status = { status: 'TEMPO_GROUP', activated_groups: json.groups };
          break;
        default:
          return reply(404, { detail: 'Not Found' });
      }
      return reply(200, this.status);
    }

    if (path === `webhooks/${serial}/subscription`) {
      if (!this.signed(headers)) return reply(401, { detail: 'Invalid signature' });
      if (method === 'GET') {
        if (!this.webhook)
          return reply(404, { detail: `There is no subscription for ${this.serial}` });
        return reply(200, this.webhook);
      }
      if (method === 'POST' || method === 'PUT') {
        if (method === 'POST' && this.webhook) {
          return reply(400, { detail: 'Subscription already exists' });
        }
        if (method === 'PUT' && !this.webhook) {
          return reply(400, { detail: `There is no subscription for ${this.serial}` });
        }
        this.webhook = {
          transmitter_id: this.serial,
          webhook_url: json.webhook_url,
          subscriptions: {
            anomaly: json.subscribe_to_anomaly,
            alert: json.subscribe_to_alert,
            state: json.subscribe_to_state,
          },
        };
        return reply(200, this.webhook);
      }
      if (method === 'DELETE') {
        this.webhook = null;
        return reply(200, {});
      }
    }
    return reply(404, { detail: 'Not Found' });
  }
}
