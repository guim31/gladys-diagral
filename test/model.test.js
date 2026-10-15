// -----------------------------------------------------------------------------
// Answers of the Diagral cloud → plain objects, on the fixtures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALARM_STATES,
  EVENT_TYPES,
  alarmKindOf,
  deviceLabelOf,
  faultKindOf,
  parseAnomalies,
  parseConfiguration,
  parseNotification,
  parseStatus,
} from '../src/diagral/model.js';
import { fixture } from './helpers/fakeCloud.js';

const configuration = parseConfiguration(fixture('configuration'));

test('the configuration: name, groups, partial modes, devices, firmware', () => {
  assert.equal(configuration.name, 'Maison');
  assert.deepEqual(
    configuration.groups.map((group) => [group.index, group.name]),
    [
      [1, 'Rez-de-chaussée'],
      [2, 'Étage'],
      [3, 'Garage'],
      [4, ''],
    ],
  );
  assert.deepEqual(configuration.partial1, [1]);
  assert.deepEqual(configuration.partial2, [1, 2]);
  assert.deepEqual(configuration.presence, [1, 3]);
  assert.equal(configuration.devices.sensors.length, 4);
  assert.equal(configuration.devices.commands[1].label, 'Télécommande');
  assert.equal(configuration.firmware, '6.3.2 / 11');
  assert.deepEqual(parseConfiguration({}).groups, []);
  assert.equal(parseConfiguration(null).firmware, null);
});

test('the status: off, exit delay, total, partial, presence', () => {
  const state = (name) => parseStatus(fixture(name), configuration).state;
  assert.equal(state('status-off'), ALARM_STATES.DISARMED);
  assert.equal(state('status-tempo-group'), ALARM_STATES.ARMING);
  assert.equal(state('status-group-total'), ALARM_STATES.ARMED);
  assert.equal(state('status-group-partial'), ALARM_STATES.PARTIAL);
  assert.equal(state('status-presence'), ALARM_STATES.PRESENCE);
  assert.deepEqual(parseStatus(fixture('status-group-partial'), configuration).groups, [1, 2]);
  // Home Assistant lowercases the words: both are accepted.
  assert.equal(
    parseStatus({ status: 'tempo_1', activated_groups: [1] }).state,
    ALARM_STATES.ARMING,
  );
  assert.equal(parseStatus({ status: 'TEMPO_2' }).state, ALARM_STATES.ARMING);
  // Without the configuration, GROUP is a total arming.
  assert.equal(parseStatus({ status: 'GROUP', activated_groups: [1] }).state, ALARM_STATES.ARMED);
  const unknown = parseStatus({ status: 'SOMETHING_NEW' });
  assert.equal(unknown.state, null);
  assert.equal(unknown.raw, 'SOMETHING_NEW');
});

test('the anomalies: one entry per device and name, with the kind of fault', () => {
  const faults = parseAnomalies(fixture('anomalies'), configuration);
  assert.deepEqual(
    faults.map((fault) => [fault.device, fault.name, fault.kind, fault.central]),
    [
      ['central', 'autoprotectionMechanicalAlert', 'tamper', true],
      ['Télécommande', 'powerSupplyAlert', 'battery', false],
      ['Porte garage', 'powerSupplyAlert', 'battery', false],
    ],
  );
  assert.deepEqual(parseAnomalies(null, configuration), []);
  // A device without label takes the one of the configuration.
  const [fault] = parseAnomalies(
    { sensors: [{ index: 2, anomaly_names: [{ id: 1, name: 'radioAlert' }] }] },
    configuration,
  );
  assert.equal(fault.device, 'Séjour');
  assert.equal(fault.kind, 'link');
});

test('every anomaly name of the configuration has a kind of fault', () => {
  const flags = new Set();
  const raw = fixture('configuration');
  for (const list of ['sensors', 'commands', 'sirens', 'transmitters']) {
    for (const device of raw[list]) Object.keys(device.anomalies).forEach((n) => flags.add(n));
  }
  Object.keys(raw.centralInformation.anomalies).forEach((n) => flags.add(n));
  const other = [...flags].filter((name) => faultKindOf(name) === 'other');
  assert.deepEqual(other.sort(), ['loopAlert', 'maskAlert', 'sensorAlert']);
  assert.equal(faultKindOf('somethingNew'), 'other');
});

test('the webhook notifications: alert, status, anomaly', () => {
  const alert = parseNotification(JSON.stringify(fixture('webhook-alert-intrusion')));
  assert.equal(alert.type, EVENT_TYPES.ALERT);
  assert.equal(alert.kind, 'intrusion');
  assert.equal(alert.code, 1130);
  assert.equal(alert.group, 1);
  assert.equal(alert.transmitter, 'BOXSERIAL0001');
  assert.equal(alert.at, Date.parse('2026-10-14T21:42:03.118254+00:00'));
  assert.equal(deviceLabelOf(alert, configuration), 'Séjour');

  const status = parseNotification(fixture('webhook-status-arming'));
  assert.equal(status.type, EVENT_TYPES.STATUS);
  assert.equal(status.user, 'Camille');
  assert.equal(status.group, null, 'NIGHT_MODE_GROUP_CODE is not a group number');
  assert.equal(status.device, null);

  const anomaly = parseNotification(
    Buffer.from(JSON.stringify(fixture('webhook-anomaly-battery'))),
  );
  assert.equal(anomaly.type, EVENT_TYPES.ANOMALY);
  assert.equal(anomaly.kind, null);

  assert.equal(parseNotification('not json'), null);
  assert.equal(parseNotification({}), null);
  assert.equal(parseNotification({ alarm_code: '9999' }).type, EVENT_TYPES.UNKNOWN);
  // The same event twice has the same key.
  assert.equal(
    parseNotification(fixture('webhook-alert-intrusion')).key,
    parseNotification(JSON.stringify(fixture('webhook-alert-intrusion'))).key,
  );
});

test('the kind of an alarm comes from its Contact ID code', () => {
  assert.equal(alarmKindOf(1130), 'intrusion');
  assert.equal(alarmKindOf(1139), 'intrusion');
  assert.equal(alarmKindOf(1141), 'intrusion');
  assert.equal(alarmKindOf(1120), 'panic');
  assert.equal(alarmKindOf(1122), 'panic');
  assert.equal(alarmKindOf(1110), 'fire');
  assert.equal(alarmKindOf(1154), 'technical');
  assert.equal(alarmKindOf(1159), 'technical');
  assert.equal(alarmKindOf(1344), 'other');
});
