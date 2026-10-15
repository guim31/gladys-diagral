// -----------------------------------------------------------------------------
// The client of the Diagral cloud against the fake cloud: the account, the API
// key (created once, saved, renewed once when refused), the HMAC signature,
// the access code, and errors that never carry a secret.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiagralClient, ERROR_KINDS, signature } from '../src/diagral/client.js';
import { FakeCloud, PASSWORD, PIN, SERIAL, USERNAME } from './helpers/fakeCloud.js';

const ACCOUNT = { username: USERNAME, password: PASSWORD, serial: SERIAL, pinCode: PIN };

function client(cloud, { account = ACCOUNT, keys, saved = [] } = {}) {
  return new DiagralClient({
    account,
    keys,
    request: cloud.request,
    onKeys: async (value) => {
      saved.push(value);
    },
  });
}

test('the signature is the HMAC-SHA256 of "timestamp.serial.key" with the secret', () => {
  // Computed apart: python3 hmac.new(b'my-secret', b'1760000000.BOXSERIAL0001.my-key', sha256)
  assert.equal(
    signature({
      timestamp: '1760000000',
      serial: SERIAL,
      apiKey: 'my-key',
      secretKey: 'my-secret',
    }),
    'cd3b505dc984c357a86bf602faebc3451662d5e0d44bd46e5a83d6a69793df20',
  );
});

test('a first read creates an API key, saves it, then signs with it', async () => {
  const cloud = new FakeCloud();
  const saved = [];
  const c = client(cloud, { saved });
  assert.deepEqual(await c.status(), { status: 'OFF', activated_groups: [] });
  assert.equal(saved.length, 1);
  assert.ok(cloud.keys.has(saved[0].apiKey));
  assert.equal(cloud.keys.get(saved[0].apiKey), saved[0].secretKey);
  await c.configuration();
  await c.anomalies();
  // One sign-in for the key, never again.
  assert.equal(cloud.count('POST', /authenticate\/login/), 1);
  const status = cloud.requests.find((r) => r.path.endsWith('/status'));
  assert.equal(status.headers['X-PIN-CODE'], PIN);
  const configuration = cloud.requests.find((r) => r.path.endsWith('/configurations'));
  assert.equal(configuration.headers['X-PIN-CODE'], undefined, 'the code only where needed');
});

test('a saved key is used without signing in', async () => {
  const cloud = new FakeCloud();
  cloud.keys.set('saved-key', 'saved-secret');
  const c = client(cloud, { keys: { apiKey: 'saved-key', secretKey: 'saved-secret' } });
  await c.status();
  assert.equal(cloud.count('POST', /authenticate\/login/), 0);
});

test('a revoked key is replaced once, and the old one deleted', async () => {
  const cloud = new FakeCloud();
  const saved = [];
  const c = client(cloud, { saved });
  await c.status();
  const first = saved[0].apiKey;
  cloud.keys.delete(first);
  cloud.keys.set('stale-but-listed', 'x');
  await c.status();
  assert.equal(saved.length, 2);
  assert.notEqual(saved[1].apiKey, first);
  assert.ok(
    cloud.requests.some((r) => r.method === 'DELETE' && r.path.endsWith(`/api_keys/${first}`)),
  );
});

test('a key refused again is an ACCESS error (wrong code or serial), not a loop', async () => {
  const cloud = new FakeCloud();
  const c = client(cloud, { account: { ...ACCOUNT, pinCode: '0000' } });
  await assert.rejects(c.status(), (err) => err.kind === ERROR_KINDS.ACCESS);
  // One key at the first read, one renewal: two keys created, no more.
  assert.equal(cloud.created, 2);
  assert.equal(cloud.keys.size, 1, 'the replaced key is deleted');
});

test('a refused password is an AUTH error', async () => {
  const cloud = new FakeCloud();
  const c = client(cloud, { account: { ...ACCOUNT, password: 'wrong' } });
  await assert.rejects(c.status(), (err) => err.kind === ERROR_KINDS.AUTH);
  assert.equal(cloud.created, 0);
});

test('an account without this box is an ACCESS error', async () => {
  const cloud = new FakeCloud();
  const c = client(cloud, { account: { ...ACCOUNT, serial: 'OTHERSERIAL01' } });
  await assert.rejects(c.configuration(), (err) => err.kind === ERROR_KINDS.ACCESS);
});

test('no anomaly is a 404 that reads as null', async () => {
  const cloud = new FakeCloud();
  assert.equal(await client(cloud).anomalies(), null);
});

test('the commands post to their path, the groups in the body', async () => {
  const cloud = new FakeCloud();
  const c = client(cloud);
  assert.equal((await c.command('arm')).status, 'TEMPO_GROUP');
  assert.equal((await c.command('disarm')).status, 'OFF');
  assert.equal((await c.command('presence')).status, 'PRESENCE');
  assert.equal((await c.command('partial_2')).status, 'TEMPO_2');
  assert.deepEqual((await c.command('groups', [1, 3])).activated_groups, [1, 3]);
  const posted = cloud.requests.filter((r) => r.method === 'POST' && r.path.startsWith('systems/'));
  assert.deepEqual(
    posted.map((r) => r.path.split('/').pop()),
    ['start', 'stop', 'presence', 'partial_start_2', 'activate_group'],
  );
  assert.deepEqual(posted.at(-1).json, { groups: [1, 3] });
});

test('errors carry a kind and no secret, even when the answer echoes the input', async () => {
  const cloud = new FakeCloud();
  const c = client(cloud);
  // The fake cloud answers 422 with the input it refused, like this API does.
  const err = await c.command('groups', [9]).catch((error) => error);
  assert.equal(err.kind, ERROR_KINDS.BAD_REQUEST);
  cloud.online = false;
  const network = await c.status().catch((error) => error);
  assert.equal(network.kind, ERROR_KINDS.NETWORK);
  cloud.online = true;
  cloud.fail(/status/, 429, 1);
  assert.equal((await c.status().catch((error) => error)).kind, ERROR_KINDS.RATE_LIMITED);
  cloud.fail(/status/, 503, 1);
  assert.equal((await c.status().catch((error) => error)).kind, ERROR_KINDS.SERVER);
  for (const error of [err, network]) {
    for (const secret of cloud.secrets()) {
      assert.ok(!error.message.includes(secret), `"${error.message}" holds a secret`);
    }
  }
});

test('the webhook subscription: none, created, replaced, deleted', async () => {
  const cloud = new FakeCloud();
  const c = client(cloud);
  assert.equal(await c.webhook(), null);
  await c.setWebhook('https://example.com/a', { create: true });
  assert.deepEqual(cloud.webhook.subscriptions, { anomaly: true, alert: true, state: true });
  await c.setWebhook('https://example.com/b', { create: false });
  assert.equal((await c.webhook()).webhook_url, 'https://example.com/b');
  await c.deleteWebhook();
  assert.equal(cloud.webhook, null);
});

test('two reads at once create one key', async () => {
  const cloud = new FakeCloud();
  const c = client(cloud);
  await Promise.all([c.status(), c.configuration(), c.anomalies()]);
  assert.equal(cloud.created, 1);
});
