// -----------------------------------------------------------------------------
// The hub through the very wiring of src/app.js, against the fake cloud and
// the SDK's fake Gladys: the start, the states, the arming changes and the
// faults (with their scene triggers), the commands as far as the
// configuration allows, the API key in /data, refused accounts.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FakeCloud, fixture } from './helpers/fakeCloud.js';
import {
  BASE_CONFIG,
  alarmIds,
  createAll,
  createWorld,
  eventsOf,
  settle,
  stateOf,
} from './helpers/world.js';

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('without settings: nothing is read, the configuration screen says what is missing', async (t) => {
  const w = await world(t, { config: { language: 'fr' } });
  assert.equal(w.cloud.requests.length, 0);
  assert.deepEqual(w.fake.discoveredDevices, []);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.fr, /numéro de série/);
  const widget = await w.fake.widgetGet('alarm', { settings: {}, language: 'fr', units: 'metric' });
  assert.match(widget.data.content.components[0].text, /Renseignez/);
});

test('the start: the alarm is discovered and its states sent once it is added', async (t) => {
  const w = await world(t);
  assert.equal(w.fake.connectionStatus.connected, true);
  const [device] = w.fake.discoveredDevices;
  assert.equal(device.external_id, alarmIds(w.gladys).device);
  assert.equal(device.name, 'Diagral alarm - Maison');
  assert.equal(device.model, 'Diagral e-ONE (6.3.2 / 11)');
  assert.equal(w.fake.states.length, 0, 'not added yet: no state');
  await createAll(w);
  assert.equal(stateOf(w, 'state'), 'disarmed');
  assert.equal(stateOf(w, 'online'), 1);
  assert.equal(stateOf(w, 'groups'), 'None');
  assert.equal(stateOf(w, 'faults'), 'None');
  assert.equal(stateOf(w, 'fault_count'), 0);
  assert.equal(stateOf(w, 'battery_low'), 0);
  assert.equal(stateOf(w, 'tamper'), 0);
  assert.equal(stateOf(w, 'link_fault'), 0);
  assert.equal(stateOf(w, 'triggered'), undefined, 'unknown without the webhook');
});

test('the API key is saved in /data (0600) and reused after a restart', async (t) => {
  const w = await world(t);
  const file = join(w.dataDir, 'diagral-state.json');
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(w.cloud.keys.has(saved.apiKey));
  assert.equal(statSync(file).mode & 0o777, 0o600);
  await w.app.stop();
  const again = await world(t, { cloud: w.cloud, dataDir: w.dataDir });
  assert.equal(again.fake.connectionStatus.connected, true);
  assert.equal(w.cloud.count('POST', /authenticate\/login/), 1, 'no new sign-in');
  assert.equal(w.cloud.created, 1);
});

test('an arming from a keypad: exit delay, then the trigger once armed', async (t) => {
  const w = await world(t);
  await createAll(w);
  w.cloud.status = fixture('status-tempo-group');
  await w.hub.refresh();
  assert.equal(stateOf(w, 'state'), 'arming');
  assert.equal(eventsOf(w, 'alarm_mode_changed').length, 0, 'an exit delay is not a mode');
  w.cloud.endExitDelay();
  await w.hub.refresh();
  assert.equal(stateOf(w, 'state'), 'armed');
  assert.equal(stateOf(w, 'groups'), 'Rez-de-chaussée, Étage, Garage, Group 4');
  assert.deepEqual(
    eventsOf(w, 'alarm_mode_changed').map((e) => e.data),
    [{ alarm: alarmIds(w.gladys).device, mode: 'armed', changed_by: null }],
  );
  await w.hub.refresh();
  assert.equal(eventsOf(w, 'alarm_mode_changed').length, 1, 'once');
  w.cloud.status = fixture('status-group-partial');
  await w.hub.refresh();
  assert.equal(stateOf(w, 'state'), 'partial');
  w.cloud.status = fixture('status-presence');
  await w.hub.refresh();
  w.cloud.status = fixture('status-off');
  await w.hub.refresh();
  assert.deepEqual(
    eventsOf(w, 'alarm_mode_changed').map((e) => e.data.mode),
    ['armed', 'partial', 'presence', 'disarmed'],
  );
});

test('the state found at the start fires nothing', async (t) => {
  const cloud = new FakeCloud();
  cloud.status = fixture('status-group-total');
  cloud.anomalies = fixture('anomalies');
  const w = await world(t, { cloud });
  assert.equal(w.fake.sceneEvents.length, 0);
});

test('a new fault fires `fault_reported` once; the features follow', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, language: 'fr' } });
  await createAll(w);
  w.cloud.anomalies = fixture('anomalies');
  await w.hub.refresh();
  await w.hub.refresh();
  assert.deepEqual(
    eventsOf(w, 'fault_reported').map((e) => [e.data.kind, e.data.device, e.data.fault]),
    [
      ['tamper', null, 'Centrale : autoprotection'],
      ['battery', 'Télécommande', 'Télécommande : piles faibles'],
      ['battery', 'Porte garage', 'Porte garage : piles faibles'],
    ],
  );
  assert.equal(stateOf(w, 'fault_count'), 3);
  assert.equal(stateOf(w, 'battery_low'), 1);
  assert.equal(stateOf(w, 'tamper'), 1);
  assert.equal(stateOf(w, 'link_fault'), 0);
  assert.equal(
    stateOf(w, 'faults'),
    '(3) Centrale : autoprotection, Télécommande : piles faibles, Porte garage : piles faibles',
  );
  w.cloud.anomalies = null;
  await w.hub.refresh();
  assert.equal(stateOf(w, 'fault_count'), 0);
  assert.equal(stateOf(w, 'faults'), 'Aucun');
  assert.equal(eventsOf(w, 'fault_reported').length, 3);
});

test('arming from Gladys is off by default: the scene action refuses', async (t) => {
  const { alarm_control: _ignored, ...config } = BASE_CONFIG;
  const w = await world(t, { config });
  const ack = await w.fake.sceneAction('set_alarm_mode', { mode: 'arm' });
  assert.equal(ack.success, false);
  assert.match(JSON.stringify(ack.error), /Arming from Gladys is off/);
  assert.equal(w.cloud.count('POST', /^systems\//), 0);
});

test('"Arm only" arms but never disarms', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, alarm_control: 'arm' } });
  assert.equal((await w.fake.sceneAction('set_alarm_mode', { mode: 'presence' })).success, true);
  const ack = await w.fake.sceneAction('set_alarm_mode', { mode: 'disarm' });
  assert.equal(ack.success, false);
  assert.match(JSON.stringify(ack.error), /Disarming from Gladys is not allowed/);
  assert.equal(w.cloud.status.status, 'PRESENCE');
});

test('the scene action: every command, its output, the trigger names Gladys', async (t) => {
  const w = await world(t);
  await createAll(w);
  const run = (fields) => w.fake.sceneAction('set_alarm_mode', fields);
  assert.deepEqual(await run({ mode: 'arm' }), {
    success: true,
    data: { outputs: { state: 'arming' } },
  });
  assert.equal(stateOf(w, 'state'), 'arming');
  assert.deepEqual((await run({ mode: 'presence' })).data.outputs, { state: 'presence' });
  assert.deepEqual((await run({ mode: 'partial_1' })).data.outputs, { state: 'arming' });
  assert.deepEqual((await run({ mode: 'groups', groups: '1, 3' })).data.outputs, {
    state: 'arming',
  });
  assert.deepEqual(w.cloud.status.activated_groups, [1, 3]);
  assert.deepEqual((await run({ mode: 'disarm', alarm: alarmIds(w.gladys).device })).data.outputs, {
    state: 'disarmed',
  });
  assert.deepEqual(
    eventsOf(w, 'alarm_mode_changed').map((e) => [e.data.mode, e.data.changed_by]),
    [
      ['presence', 'Gladys'],
      ['disarmed', 'Gladys'],
    ],
  );
  // An arming from Gladys confirmed by a later read is still Gladys'.
  await run({ mode: 'arm' });
  w.cloud.endExitDelay();
  await w.hub.refresh();
  assert.deepEqual(eventsOf(w, 'alarm_mode_changed').at(-1).data.changed_by, 'Gladys');
});

test('the scene action refuses wrong groups, an empty partial mode and another device', async (t) => {
  const cloud = new FakeCloud();
  cloud.configuration = { ...cloud.configuration, partialGroup2: [] };
  const w = await world(t, { cloud });
  const run = (fields) => w.fake.sceneAction('set_alarm_mode', fields);
  for (const groups of [undefined, '', '1,9', 'a,b', '1;;x']) {
    const ack = await run({ mode: 'groups', groups });
    assert.equal(ack.success, false, String(groups));
    assert.match(JSON.stringify(ack.error), /existing groups/);
  }
  assert.match(JSON.stringify((await run({ mode: 'partial_2' })).error), /no group/);
  assert.match(
    JSON.stringify((await run({ mode: 'arm', alarm: 'ext:test-integration:alarm:OTHER' })).error),
    /Unknown device/,
  );
  assert.equal((await run({ mode: 'bogus' })).success, false);
  assert.equal(cloud.count('POST', /^systems\//), 0);
});

test('a refused password stops the reads until the configuration changes', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, password: 'wrong' } });
  assert.match(w.fake.connectionStatus.message.en, /refused the e-mail address or the password/);
  const requests = w.cloud.requests.length;
  for (let i = 0; i < 3; i += 1) await w.hub.refresh();
  assert.equal(w.cloud.requests.length, requests, 'no new attempt: the account could be locked');
  await w.fake.configUpdated({ ...BASE_CONFIG });
  await settle();
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('a refused access code is said, and a scan tries again', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, pin_code: '1111' } });
  assert.match(w.fake.connectionStatus.message.en, /serial number of the box or the access code/);
  const created = w.cloud.created;
  await w.hub.refresh();
  assert.equal(w.cloud.created, created, 'no new key per read');
  w.cloud.pin = '1111';
  await w.fake.scanRequest();
  await settle();
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('a new account or box gets its own key; the language renames new devices', async (t) => {
  const w = await world(t);
  const first = w.hub.client.apiKey;
  await w.fake.configUpdated({ ...BASE_CONFIG, language: 'de' });
  await settle();
  assert.equal(w.hub.client.apiKey, first, 'same account: same key');
  assert.equal(w.fake.discoveredDevices[0].name, 'Diagral-Alarmanlage - Maison');
  w.cloud.serial = 'BOXSERIAL0002';
  await w.fake.configUpdated({ ...BASE_CONFIG, serial: 'boxserial-0002' });
  await settle();
  assert.notEqual(w.hub.client.apiKey, first);
  assert.equal(w.fake.connectionStatus.connected, true);
  assert.equal(w.fake.discoveredDevices[0].external_id, 'ext:test-integration:alarm:BOXSERIAL0002');
});

test('a cloud down: online 0, said on the configuration screen, then back', async (t) => {
  const w = await world(t);
  await createAll(w);
  w.cloud.online = false;
  await w.hub.refresh();
  assert.equal(stateOf(w, 'online'), 0);
  assert.equal(stateOf(w, 'state'), 'disarmed', 'the last state stays');
  assert.match(w.fake.connectionStatus.message.en, /does not answer/);
  w.cloud.online = true;
  await w.hub.refresh();
  assert.equal(stateOf(w, 'online'), 1);
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('a 429 pauses the reads, doubled each time', async (t) => {
  const w = await world(t);
  w.cloud.fail(/status/, 429, 2);
  await w.hub.refresh();
  assert.match(w.fake.connectionStatus.message.en, /slow down/);
  const requests = w.cloud.requests.length;
  w.clock.advance(30_000);
  await w.hub.refresh();
  assert.equal(w.cloud.requests.length, requests, 'paused');
  w.clock.advance(31_000);
  await w.hub.refresh();
  w.clock.advance(61_000);
  await w.hub.refresh();
  assert.equal(w.cloud.requests.length, requests + 1, 'two minutes the second time');
  w.clock.advance(60_000);
  await w.hub.refresh();
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('the test action reports the alarm; the renewal replaces the key', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, language: 'fr' } });
  const ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /Connecté : Maison, Arrêt, 4 groupe\(s\), 0 anomalie\(s\)/);
  const first = w.hub.client.apiKey;
  const renewed = await w.fake.action('renew_api_key', {});
  assert.equal(renewed.success, true);
  assert.notEqual(w.hub.client.apiKey, first);
  assert.ok(!w.cloud.keys.has(first), 'the previous key is deleted');
  assert.equal(w.cloud.keys.size, 1);
});

test('a feature cannot be set', async (t) => {
  const w = await world(t);
  await createAll(w);
  const [device] = w.fake.discoveredDevices;
  const ack = await w.fake.setValue(device, device.features[0], 1);
  assert.equal(ack.success, false);
});
