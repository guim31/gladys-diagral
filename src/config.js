// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// The Diagral account (e-mail, password), the serial of the box and the
// access code live in the Gladys configuration; the API key the integration
// creates with them lives in /data (src/store.js).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Seconds between two reads of the alarm. Home Assistant reads every 5
// minutes and Diagral publishes no quota: 5 minutes by default, the Gladys
// Plus webhook brings arming, alarms and faults in real time anyway.
export const REFRESH_INTERVALS = ['60', '120', '300', '600'];

// What Gladys may do with the alarm: nothing (it shows the state), arm it,
// or arm and disarm it. Values stored in the configuration: never change one.
export const ALARM_CONTROLS = ['off', 'arm', 'full'];

export const DEFAULT_CONFIG = {
  alarm_control: 'off',
  refresh_interval: '300',
  language: 'fr',
};

const pickOption = (value, options, fallback) =>
  options.includes(String(value ?? '')) ? String(value) : fallback;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const control = pickOption(source.alarm_control, ALARM_CONTROLS, DEFAULT_CONFIG.alarm_control);
  return {
    username: text(source.username),
    // A password may begin or end with a space: kept as typed.
    password: typeof source.password === 'string' ? source.password : '',
    // The serial is printed in capitals on the label of the box; spaces and
    // dashes copied with it are dropped.
    serial: text(source.serial).replace(/[\s-]/g, '').toUpperCase(),
    pinCode: text(source.pin_code),
    alarmControl: control,
    canArm: control !== 'off',
    canDisarm: control === 'full',
    refreshMs:
      Number(
        pickOption(source.refresh_interval, REFRESH_INTERVALS, DEFAULT_CONFIG.refresh_interval),
      ) * 1000,
    language: pickOption(source.language, LANGUAGES, DEFAULT_CONFIG.language),
  };
}

/** What is missing before the account can be read: a list of config keys. */
export function missingSettings(config) {
  const missing = [];
  if (!config.username) missing.push('username');
  if (!config.password) missing.push('password');
  if (!config.serial) missing.push('serial');
  if (!/^\d{1,12}$/.test(config.pinCode)) missing.push('pin_code');
  return missing;
}

/** The account a stored API key belongs to: a new one needs a new key. */
export const accountOf = (config) => `${config.username.toLowerCase()}|${config.serial}`;
