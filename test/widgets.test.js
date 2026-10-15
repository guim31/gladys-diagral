// -----------------------------------------------------------------------------
// The `alarm` widget: content within the budget of the core (checked by the
// SDK's validateWidgetContent), the buttons the configuration allows, the
// confirmation of a disarming, the current mode marked by its icon.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { FakeCloud, fixture } from './helpers/fakeCloud.js';
import { BASE_CONFIG, createWorld } from './helpers/world.js';

const LANGS = ['en', 'fr', 'de', 'es'];

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const content = async (w, language = 'en') =>
  (await w.fake.widgetGet('alarm', { settings: {}, language, units: 'metric' })).data.content;
const buttons = (c) => c.components.filter((component) => component.type === 'button');

test('the content fits the budget of the core, in every language and state', async (t) => {
  const cloud = new FakeCloud();
  cloud.anomalies = fixture('anomalies');
  const w = await world(t, { cloud });
  for (const status of [
    'status-off',
    'status-tempo-group',
    'status-group-partial',
    'status-presence',
  ]) {
    cloud.status = fixture(status);
    await w.hub.refresh();
    for (const language of LANGS) {
      assert.deepEqual(
        validateWidgetContent(await content(w, language)),
        [],
        `${status} ${language}`,
      );
    }
  }
  cloud.online = false;
  await w.hub.refresh();
  assert.deepEqual(validateWidgetContent(await content(w)), []);
});

test('all buttons when arming and disarming are allowed; disarming asks to confirm', async (t) => {
  const w = await world(t);
  const c = await content(w, 'fr');
  assert.deepEqual(
    buttons(c).map((b) => [b.label, b.icon, b.action.key, b.action.confirm ?? false]),
    [
      ['Marche totale', 'lock', 'arm', false],
      ['Partielle 1', 'home', 'partial_1', false],
      ['Marche présence', 'moon', 'presence', false],
      ['Arrêt', 'check-circle', 'disarm', true],
    ],
  );
  assert.ok(
    buttons(c).every((b) => b.style !== 'primary'),
    'primary is invisible in dark mode',
  );
});

test('"Arm only": no disarm button; off: a caption instead of the buttons', async (t) => {
  const armOnly = await world(t, { config: { ...BASE_CONFIG, alarm_control: 'arm' } });
  assert.ok(!buttons(await content(armOnly)).some((b) => b.action.key === 'disarm'));
  const off = await world(t, { config: { ...BASE_CONFIG, alarm_control: 'off' } });
  const c = await content(off);
  assert.equal(buttons(c).length, 0);
  assert.match(c.components.at(-1).text, /Arming from Gladys is off/);
});

test('a button arms the alarm, then the widget marks the mode', async (t) => {
  const w = await world(t);
  const ack = await w.fake.widgetAction(
    'alarm',
    'presence',
    { command: 'presence' },
    { settings: {} },
  );
  assert.equal(ack.success, true);
  assert.equal(w.cloud.status.status, 'PRESENCE');
  const presence = buttons(await content(w)).find((b) => b.action.key === 'presence');
  assert.equal(presence.icon, 'check-circle');
  const refused = await w.fake.widgetAction('alarm', 'x', { command: 'groups' }, { settings: {} });
  assert.equal(refused.success, false, 'the widget never sends arbitrary groups');
});

test('an alarm without partial modes shows the second one, or none', async (t) => {
  const cloud = new FakeCloud();
  cloud.configuration = { ...cloud.configuration, partialGroup1: [] };
  const w = await world(t, { cloud });
  assert.ok(buttons(await content(w)).some((b) => b.action.key === 'partial_2'));
  cloud.configuration = { ...cloud.configuration, partialGroup2: [] };
  await w.fake.scanRequest();
  assert.ok(!buttons(await content(w)).some((b) => b.action.key.startsWith('partial')));
});
