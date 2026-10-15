// -----------------------------------------------------------------------------
// What the integration writes at the default level (info): the lifecycle
// only. A normal cycle — reads, polls, widget contents, webhook events that
// change nothing — writes nothing; a failure that repeats is logged once, and
// its end once. Never the password, the access code, the API key or its
// secret, a token, a signature, the webhook address, the e-mail address nor
// a user name — at any level, debug included.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_KEY } from '../src/hub.js';
import { FakeCloud, USERNAME, USER_NAME, fixture } from './helpers/fakeCloud.js';
import {
  BASE_CONFIG,
  PLUS_WEBHOOKS,
  WEBHOOK_URL,
  createAll,
  createWorld,
  settle,
} from './helpers/world.js';

/** Capture the lines of the SDK logger at a level. */
function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  const record =
    (stream) =>
    (...args) =>
      lines.push({
        stream,
        text: args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' '),
      });
  t.mock.method(console, 'log', record('out'));
  t.mock.method(console, 'error', record('err'));
  t.mock.method(console, 'warn', record('err'));
  return {
    lines,
    clear: () => lines.splice(0),
    texts: () => lines.map((line) => line.text.replace(/^\[[^\]]+\] /, '')),
  };
}

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('the start writes its lifecycle at info', async (t) => {
  const logs = captureLogs(t);
  await world(t, { webhooks: PLUS_WEBHOOKS });
  assert.deepEqual(logs.texts(), [
    '[INFO] [diagral-hub] API key created on the Diagral cloud',
    '[INFO] [diagral-hub] Connected to the Diagral cloud',
    '[INFO] [diagral-hub] Diagral events now arrive in real time through Gladys Plus',
  ]);
});

test('a normal cycle writes nothing at info', async (t) => {
  const logs = captureLogs(t);
  const cloud = new FakeCloud();
  cloud.anomalies = fixture('anomalies');
  const w = await world(t, { cloud, webhooks: PLUS_WEBHOOKS });
  await createAll(w);
  logs.clear();
  const [device] = w.fake.discoveredDevices;
  for (let i = 0; i < 3; i += 1) {
    w.clock.advance(300_000);
    await w.hub.refresh();
    await w.fake.poll(device);
    await w.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'fr', units: 'metric' });
    // An anomaly event already known: a read, nothing new.
    await w.fake.webhook('events', {
      method: 'POST',
      body: JSON.stringify(fixture('webhook-anomaly-battery')),
    });
    await w.fake.webhookUpdated(PLUS_WEBHOOKS);
  }
  await settle();
  assert.deepEqual(logs.texts(), []);
});

test('a cloud that stays down is logged once, and once when it is back', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  await createAll(w);
  logs.clear();
  w.cloud.online = false;
  for (let i = 0; i < 5; i += 1) {
    w.clock.advance(300_000);
    await w.hub.refresh();
  }
  w.cloud.online = true;
  w.clock.advance(300_000);
  await w.hub.refresh();
  await w.hub.refresh();
  assert.deepEqual(logs.texts(), [
    '[WARN] [diagral-hub] The Diagral cloud cannot be read (network: ENOTFOUND)',
    '[INFO] [diagral-hub] The Diagral cloud answers again',
  ]);
});

test('a user command is one line', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  await createAll(w);
  logs.clear();
  await w.fake.sceneAction('set_alarm_mode', { mode: 'presence' });
  await w.fake.widgetAction('alarm', 'disarm', { command: 'disarm' }, { settings: {} });
  assert.deepEqual(logs.texts(), [
    '[INFO] [diagral-hub] Alarm command presence sent from the scene',
    '[INFO] [diagral-hub] Alarm command disarm sent from the widget',
  ]);
});

test('no secret, address or user name in the logs, even at debug', async (t) => {
  const logs = captureLogs(t, 'debug');
  const cloud = new FakeCloud();
  cloud.webhook = fixture('webhook-subscription');
  const w = await world(t, { cloud, webhooks: PLUS_WEBHOOKS });
  await createAll(w);
  await w.fake.webhook('events', {
    method: 'POST',
    body: JSON.stringify(fixture('webhook-status-arming')),
  });
  await w.fake.webhook('events', {
    method: 'POST',
    body: JSON.stringify(fixture('webhook-alert-intrusion')),
  });
  await w.fake.sceneAction('set_alarm_mode', { mode: 'arm' });
  await w.fake.sceneAction('set_alarm_mode', { mode: 'groups', groups: '1,4' });
  // A 422 of this API echoes the input it refused.
  cloud.fail(/activate_group/, 422, 1);
  await w.fake.sceneAction('set_alarm_mode', { mode: 'groups', groups: '2' });
  await w.fake.action('renew_api_key', {});
  cloud.revokeKeys();
  await w.hub.refresh();
  await w.fake.action('test_connection', {});
  await w.fake.configUpdated({ ...BASE_CONFIG, pin_code: '000000' });
  await w.fake.configUpdated({ ...BASE_CONFIG, password: 'wrong password' });
  await settle();
  const text = logs.texts().join('\n');
  assert.ok(text.length > 0);
  for (const secret of [
    ...cloud.secrets(),
    'wrong password',
    '000000',
    WEBHOOK_URL,
    'open-api-key-123',
    'https://hook.example.com/other-tool',
    USERNAME,
    USER_NAME,
  ]) {
    assert.ok(!text.includes(secret), `the logs hold "${secret}"`);
  }
});
