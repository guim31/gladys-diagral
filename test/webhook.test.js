// -----------------------------------------------------------------------------
// The webhook of the Diagral cloud, relayed by Gladys Plus: registered at
// Diagral when Gladys Plus offers it (and replacing the address of another
// tool, Diagral keeps one per box), removed when Gladys Plus no longer does.
// An alarm fires `alarm_triggered` and sets "Alarm in progress" until the
// alarm is disarmed; an event is taken once, only from the box, and a late
// alarm fires nothing. Arming and fault events only trigger a read: the API
// stays the reference.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeCloud, fixture } from './helpers/fakeCloud.js';
import {
  BASE_CONFIG,
  NO_WEBHOOKS,
  PLUS_WEBHOOKS,
  WEBHOOK_URL,
  alarmIds,
  createAll,
  createWorld,
  eventsOf,
  settle,
  stateOf,
} from './helpers/world.js';

async function world(t, options = {}) {
  const w = await createWorld({ webhooks: PLUS_WEBHOOKS, ...options });
  t.after(() => w.app.stop());
  return w;
}

const post = (w, body) => w.fake.webhook('events', { method: 'POST', body: JSON.stringify(body) });

// The alarm of the fixture was posted at 21:42:03; the clock of the world reads 21:42:30.
const intrusion = () => fixture('webhook-alert-intrusion');

test('Gladys Plus available: the webhook is registered at Diagral for every event', async (t) => {
  const w = await world(t);
  assert.deepEqual(w.cloud.webhook, {
    transmitter_id: 'BOXSERIAL0001',
    webhook_url: WEBHOOK_URL,
    subscriptions: { anomaly: true, alert: true, state: true },
  });
  const saved = JSON.parse(readFileSync(join(w.dataDir, 'diagral-state.json'), 'utf8'));
  assert.ok(!JSON.stringify(saved).includes('open-api-key-123'), 'the address is not kept');
  assert.equal(saved.webhook.transmitter, 'BOXSERIAL0001');
  // Already registered: nothing written again at the next start.
  await w.app.stop();
  const again = await world(t, { cloud: w.cloud, dataDir: w.dataDir });
  assert.equal(
    again.cloud.count('POST', /subscription/) + again.cloud.count('PUT', /subscription/),
    1,
  );
});

test('the webhook of another tool is replaced (Diagral keeps one per box)', async (t) => {
  const cloud = new FakeCloud();
  cloud.webhook = fixture('webhook-subscription');
  const w = await world(t, { cloud });
  assert.equal(w.cloud.webhook.webhook_url, WEBHOOK_URL);
  assert.equal(w.cloud.count('PUT', /subscription/), 1);
});

test('without Gladys Plus nothing is registered; once removed, ours is deleted', async (t) => {
  const none = await world(t, { webhooks: NO_WEBHOOKS });
  assert.equal(none.cloud.webhook, null);
  assert.equal(none.cloud.count('POST', /subscription/), 0);

  const w = await world(t);
  assert.ok(w.cloud.webhook);
  await w.fake.webhookUpdated(NO_WEBHOOKS);
  await settle();
  assert.equal(w.cloud.webhook, null);
  // Another tool's webhook is never deleted.
  w.cloud.webhook = fixture('webhook-subscription');
  await w.fake.webhookUpdated(NO_WEBHOOKS);
  await settle();
  assert.ok(w.cloud.webhook);
});

test('an alarm: trigger, "Alarm in progress" until disarmed, widget in red', async (t) => {
  const cloud = new FakeCloud();
  cloud.status = fixture('status-group-total');
  const w = await world(t, { cloud, config: { ...BASE_CONFIG, language: 'fr' } });
  await createAll(w);
  assert.equal(stateOf(w, 'triggered'), 0, 'with the webhook, "no alarm" is a value');
  await post(w, intrusion());
  assert.equal(stateOf(w, 'triggered'), 1);
  assert.deepEqual(
    eventsOf(w, 'alarm_triggered').map((e) => e.data),
    [
      {
        alarm: alarmIds(w.gladys).device,
        kind: 'intrusion',
        device: 'Séjour',
        group: 'Rez-de-chaussée',
        code: 1130,
      },
    ],
  );
  const widget = await w.fake.widgetGet('alarm', { settings: {}, language: 'fr', units: 'metric' });
  assert.equal(widget.data.content.components[1].items[0].value, 'ALARME EN COURS');
  // Still armed: still in progress.
  await w.hub.refresh();
  assert.equal(stateOf(w, 'triggered'), 1);
  w.cloud.status = fixture('status-off');
  await w.hub.refresh();
  assert.equal(stateOf(w, 'triggered'), 0);
});

test('an event is taken once, only from this box, and a late alarm fires nothing', async (t) => {
  const w = await world(t);
  await createAll(w);
  await post(w, intrusion());
  await post(w, intrusion());
  assert.equal(eventsOf(w, 'alarm_triggered').length, 1, 'duplicate');
  await post(w, {
    ...intrusion(),
    transmitter_id: 'SOMEONEELSE01',
    date_time: '2026-10-14T21:42:10Z',
  });
  await post(w, { ...intrusion(), transmitter_id: undefined, date_time: '2026-10-14T21:42:11Z' });
  assert.equal(eventsOf(w, 'alarm_triggered').length, 1, 'other transmitter');
  await post(w, { ...intrusion(), date_time: '2026-10-14T21:00:00Z' });
  assert.equal(eventsOf(w, 'alarm_triggered').length, 1, 'late');
  // A restore code (3xxx) is not an alarm.
  await post(w, { ...intrusion(), alarm_code: '3391', date_time: '2026-10-14T21:42:20Z' });
  await w.fake.webhook('events', { method: 'POST', body: 'not json' });
  assert.equal(eventsOf(w, 'alarm_triggered').length, 1);
});

test('an arming event names the user in the next mode change', async (t) => {
  const w = await world(t);
  await createAll(w);
  await post(w, fixture('webhook-status-arming'));
  // The event itself sets no state: the read does.
  assert.equal(stateOf(w, 'state'), 'disarmed');
  w.cloud.status = fixture('status-presence');
  await w.hub.refresh();
  assert.deepEqual(
    eventsOf(w, 'alarm_mode_changed').map((e) => e.data),
    [{ alarm: alarmIds(w.gladys).device, mode: 'presence', changed_by: 'Camille' }],
  );
  // Too old to name the next one.
  w.clock.advance(10 * 60_000);
  w.cloud.status = fixture('status-off');
  await w.hub.refresh();
  assert.equal(eventsOf(w, 'alarm_mode_changed')[1].data.changed_by, null);
});

test('an event triggers a read soon after (doctrine: trigger, not data)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const w = await world(t, { timers: true });
  await createAll(w);
  const reads = () => w.cloud.count('GET', /\/status$/);
  const before = reads();
  w.cloud.anomalies = fixture('anomalies');
  await post(w, fixture('webhook-anomaly-battery'));
  await post(w, {
    ...fixture('webhook-anomaly-battery'),
    detail: { device_type: 'COMMAND', device_index: '2' },
  });
  t.mock.timers.tick(3_000);
  await settle(80);
  assert.equal(reads() - before, 1, 'one read for a burst');
  assert.equal(eventsOf(w, 'fault_reported').length, 3);
});
