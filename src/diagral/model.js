// -----------------------------------------------------------------------------
// Answers of the Diagral cloud → plain objects. Pure functions, tested on the
// fixtures of test/fixtures/diagral (shapes of pydiagral's models and tests,
// values made up).
//
//   - configuration (GET systems/<serial>/configurations): the name of the
//     alarm, its groups, the groups of "partial 1", "partial 2" and
//     "presence", and the devices (sensors, commands, sirens, transmitters,
//     cameras, transceivers) with their labels;
//   - status (GET systems/<serial>/status): { status, activated_groups },
//     status one of OFF, GROUP, PRESENCE, TEMPO_GROUP, TEMPO_1, TEMPO_2;
//   - anomalies (GET systems/<serial>/anomalies): per kind of device, the
//     devices in fault with the names of their anomalies — the same names as
//     the flags of the configuration (radioAlert, powerSupplyAlert…);
//   - webhook notifications: { transmitter_id, alarm_code, alarm_description,
//     group_index, detail: { device_type, device_index, device_label },
//     user: { username, user_type }, date_time }.
// -----------------------------------------------------------------------------

// The state of the alarm, as Gladys shows it (feature `state`, scene trigger
// `alarm_mode_changed`). Values stored in Gladys: never change one.
export const ALARM_STATES = Object.freeze({
  DISARMED: 'disarmed',
  ARMING: 'arming',
  ARMED: 'armed',
  PARTIAL: 'partial',
  PRESENCE: 'presence',
});

// The states a scene can wait for: the end of an exit delay is the arming.
export const SETTLED_STATES = [
  ALARM_STATES.DISARMED,
  ALARM_STATES.ARMED,
  ALARM_STATES.PARTIAL,
  ALARM_STATES.PRESENCE,
];

// What the widget and the scene action can ask (src/diagral/client.js
// COMMAND_PATHS). Values stored in scenes: never change one.
export const COMMANDS = ['disarm', 'arm', 'presence', 'partial_1', 'partial_2', 'groups'];

// The kinds of alarms (scene trigger `alarm_triggered`).
export const ALARM_KINDS = ['intrusion', 'panic', 'fire', 'technical', 'other'];

// The kinds of faults (features and scene trigger `fault_reported`).
export const FAULT_KINDS = ['battery', 'tamper', 'link', 'other'];

// Anomaly names (and configuration flags) by kind of fault.
const FAULT_OF_ANOMALY = {
  powerSupplyAlert: 'battery',
  mainPowerSupplyAlert: 'battery',
  secondaryPowerSupplyAlert: 'battery',
  autoprotectionMechanicalAlert: 'tamper',
  autoprotectionWiredAlert: 'tamper',
  radioAlert: 'link',
  outOfOrderAlert: 'link',
  mediaGSMAlert: 'link',
  mediaRTCAlert: 'link',
  mediaADSLAlert: 'link',
  defaultMediaAlert: 'link',
};

export const faultKindOf = (name) => FAULT_OF_ANOMALY[name] ?? 'other';

// The kinds of devices of the configuration and of the anomalies.
const DEVICE_LISTS = ['sensors', 'commands', 'sirens', 'cameras', 'transmitters', 'transceivers'];

const asList = (value) => (Array.isArray(value) ? value : []);
const asIndexes = (value) =>
  asList(value)
    .map(Number)
    .filter((index) => Number.isInteger(index) && index > 0);
const label = (value) => (typeof value === 'string' ? value.trim() : '');

/** The configuration of the alarm. */
export function parseConfiguration(body) {
  const groups = asList(body?.groups)
    .map((group) => ({ index: Number(group?.index), name: label(group?.name) }))
    .filter((group) => Number.isInteger(group.index) && group.index > 0)
    .sort((a, b) => a.index - b.index);
  const devices = {};
  for (const list of DEVICE_LISTS) {
    devices[list] = asList(body?.[list])
      .map((device) => ({ index: Number(device?.index), label: label(device?.label) }))
      .filter((device) => Number.isInteger(device.index));
  }
  const firmwares = body?.alarm?.central?.firmwares ?? {};
  return {
    name: label(body?.alarm?.name),
    groups,
    partial1: asIndexes(body?.partialGroup1),
    partial2: asIndexes(body?.partialGroup2),
    presence: asIndexes(body?.presenceGroup),
    devices,
    firmware: [firmwares.CENTRAL, firmwares.CENTRALRADIO].filter(Boolean).join(' / ') || null,
  };
}

/**
 * The state of the alarm from its status and the configuration: GROUP with
 * every group of the system is a total arming, fewer groups a partial one.
 * Returns null for a status this code does not know.
 */
export function parseStatus(body, configuration) {
  const raw = String(body?.status ?? '').toUpperCase();
  const groups = [...new Set(asIndexes(body?.activated_groups))].sort((a, b) => a - b);
  let state;
  switch (raw) {
    case 'OFF':
      state = ALARM_STATES.DISARMED;
      break;
    case 'PRESENCE':
      state = ALARM_STATES.PRESENCE;
      break;
    case 'GROUP': {
      const all = (configuration?.groups ?? []).map((group) => group.index);
      const total = all.length === 0 || all.every((index) => groups.includes(index));
      state = total ? ALARM_STATES.ARMED : ALARM_STATES.PARTIAL;
      break;
    }
    default:
      // TEMPO_GROUP, TEMPO_1, TEMPO_2: the exit delay of an arming.
      state = raw.startsWith('TEMPO') ? ALARM_STATES.ARMING : null;
  }
  return { raw, state, groups };
}

/**
 * The anomalies of the system as a flat list: one entry per device and
 * anomaly name, with the kind of fault. `null` (no anomaly) gives [].
 */
export function parseAnomalies(body, configuration) {
  const faults = [];
  for (const [list, entries] of Object.entries(body ?? {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const index = Number.isInteger(Number(entry?.index)) ? Number(entry.index) : null;
      const known =
        index === null
          ? null
          : configuration?.devices?.[list]?.find((device) => device.index === index);
      const device =
        label(entry?.label) ||
        known?.label ||
        (list === 'central' ? 'central' : `${list} ${index ?? ''}`.trim());
      for (const anomaly of asList(entry?.anomaly_names)) {
        const name = label(anomaly?.name);
        if (!name) continue;
        faults.push({
          id: `${list}:${index ?? '-'}:${name}`,
          list,
          device,
          central: list === 'central',
          name,
          kind: faultKindOf(name),
        });
      }
    }
  }
  return faults.sort((a, b) => a.id.localeCompare(b.id));
}

// Alarm codes of the webhook notifications (Contact ID: 1 = new event,
// 3 = restore), as pydiagral sorts them.
const ALERT_CODES = new Set([
  1110, 1111, 1117, 1120, 1122, 1130, 1139, 1140, 1141, 1142, 1143, 1150, 1152, 1154, 1158, 1159,
  1344, 1391, 3391,
]);
const STATUS_CODES = new Set([1306, 1401, 1407, 3401, 3407]);
const ANOMALY_CODES = new Set([
  1137, 1144, 1301, 1302, 1351, 1352, 1355, 1381, 1384, 1570, 1573, 3137, 3144, 3301, 3351, 3352,
  3355, 3381, 3570,
]);

export const EVENT_TYPES = Object.freeze({
  ALERT: 'alert',
  STATUS: 'status',
  ANOMALY: 'anomaly',
  UNKNOWN: 'unknown',
});

/** The kind of an alarm from its Contact ID code (the hundreds of the event). */
export function alarmKindOf(code) {
  const event = code % 1000;
  if (event >= 130 && event < 150) return 'intrusion';
  if (event >= 120 && event < 130) return 'panic';
  if (event >= 110 && event < 120) return 'fire';
  if (event >= 150 && event < 170) return 'technical';
  return 'other';
}

/**
 * A webhook notification → { type, code, kind, at, group, device, user, transmitter, key },
 * or null when it is not one. `body` is the raw text or its JSON.
 */
export function parseNotification(body) {
  let data = body;
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    try {
      data = JSON.parse(String(body));
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const code = Number(data.alarm_code);
  if (!Number.isInteger(code)) return null;
  const type = ALERT_CODES.has(code)
    ? EVENT_TYPES.ALERT
    : STATUS_CODES.has(code)
      ? EVENT_TYPES.STATUS
      : ANOMALY_CODES.has(code)
        ? EVENT_TYPES.ANOMALY
        : EVENT_TYPES.UNKNOWN;
  const at = Date.parse(String(data.date_time ?? ''));
  const group = Number(data.group_index);
  const detail = data.detail && typeof data.detail === 'object' ? data.detail : {};
  const deviceType = label(detail.device_type).toLowerCase();
  const deviceIndex = Number(detail.device_index);
  return {
    type,
    code,
    kind: type === EVENT_TYPES.ALERT ? alarmKindOf(code) : null,
    description: label(data.alarm_description),
    at: Number.isFinite(at) ? at : null,
    group: Number.isInteger(group) && group > 0 ? group : null,
    device: deviceType
      ? {
          list: `${deviceType}s`,
          index: Number.isInteger(deviceIndex) ? deviceIndex : null,
          label: label(detail.device_label),
        }
      : null,
    user: label(data.user?.username) || null,
    transmitter: label(data.transmitter_id) || null,
    // The same event delivered twice has the same key.
    key: `${code}|${data.date_time ?? ''}|${data.group_index ?? ''}|${deviceType}|${detail.device_index ?? ''}`,
  };
}

/** The label of the device an event names, from the configuration when it has one. */
export function deviceLabelOf(event, configuration) {
  if (!event.device) return null;
  const known =
    event.device.index === null
      ? null
      : configuration?.devices?.[event.device.list]?.find(
          (device) => device.index === event.device.index,
        );
  return known?.label || event.device.label || null;
}
