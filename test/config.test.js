// -----------------------------------------------------------------------------
// Normalization of the configuration: defaults, trimmed fields, the serial as
// printed on the box, the access code, and what is missing.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, accountOf, missingSettings, normalizeConfig } from '../src/config.js';

test('defaults: state only, a read every 5 minutes, French names', () => {
  const config = normalizeConfig();
  assert.equal(config.alarmControl, 'off');
  assert.equal(config.canArm, false);
  assert.equal(config.canDisarm, false);
  assert.equal(config.refreshMs, 300_000);
  assert.equal(config.language, 'fr');
  assert.deepEqual(DEFAULT_CONFIG, {
    alarm_control: 'off',
    refresh_interval: '300',
    language: 'fr',
  });
  assert.deepEqual(missingSettings(config), ['username', 'password', 'serial', 'pin_code']);
});

test('the fields are cleaned; the password is kept as typed', () => {
  const config = normalizeConfig({
    username: '  Camille@Example.com ',
    password: ' spaced ',
    serial: ' boxserial-0001 ',
    pin_code: ' 1234 ',
    alarm_control: 'arm',
    refresh_interval: 60,
    language: 'xx',
  });
  assert.equal(config.username, 'Camille@Example.com');
  assert.equal(config.password, ' spaced ');
  assert.equal(config.serial, 'BOXSERIAL0001');
  assert.equal(config.pinCode, '1234');
  assert.equal(config.canArm, true);
  assert.equal(config.canDisarm, false);
  assert.equal(config.refreshMs, 60_000);
  assert.equal(config.language, 'fr');
  assert.deepEqual(missingSettings(config), []);
  assert.equal(accountOf(config), 'camille@example.com|BOXSERIAL0001');
});

test('"full" allows disarming; an unknown value falls back to the safe default', () => {
  assert.equal(normalizeConfig({ alarm_control: 'full' }).canDisarm, true);
  assert.equal(normalizeConfig({ alarm_control: 'yes' }).canArm, false);
  assert.equal(normalizeConfig({ refresh_interval: '5' }).refreshMs, 300_000);
});

test('an access code is digits only', () => {
  const base = { username: 'a@b.c', password: 'p', serial: 'S' };
  assert.deepEqual(missingSettings(normalizeConfig({ ...base, pin_code: '12a4' })), ['pin_code']);
  assert.deepEqual(missingSettings(normalizeConfig({ ...base, pin_code: 1234 })), ['pin_code']);
});
