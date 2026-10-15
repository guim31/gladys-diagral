// -----------------------------------------------------------------------------
// The Gladys device of a Diagral alarm, and the values of its features. Pure
// functions of the data parsed by src/diagral/model.js.
//
// One device per box (external id: its serial):
//   - state: text/select, always read-only — the alarm is armed from the
//     widget and the scene action, as the configuration allows, never like a
//     switch nor by a voice assistant;
//   - alarm in progress: input/binary, 1 from an alarm reported by the Gladys
//     Plus webhook until the alarm is disarmed. Without the webhook nothing
//     tells it (the state of the API has no "alarm"): no value is sent;
//   - armed groups (text), faults (text) and their number (counter), low
//     batteries, tamper protection and link fault (any device of the alarm);
//   - Diagral cloud: input/binary, 0 while the cloud cannot be read.
// Feature keys are permanent: never rename one.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { ALARM_STATES } from './diagral/model.js';
import { ANOMALY_NAMES, DEVICE_NAME, FEATURE_NAMES, STATE_NAMES, WORDS, pick } from './texts.js';

export const DEVICE_TYPE = 'alarm';

export const FEATURE_KEYS = Object.freeze({
  STATE: 'state',
  TRIGGERED: 'triggered',
  GROUPS: 'groups',
  FAULTS: 'faults',
  FAULT_COUNT: 'fault_count',
  BATTERY_LOW: 'battery_low',
  TAMPER: 'tamper',
  LINK_FAULT: 'link_fault',
  ONLINE: 'online',
});

// The core reads a device at most once a minute; the hub reads the cloud on
// its own timer anyway (GladysAssistant/Gladys#3198), onPoll is a fallback.
const POLLING = { should_poll: true, poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES };

// A text feature holds 255 characters in Gladys.
const MAX_TEXT = 200;

export const alarmIds = (gladys, serial) => gladys.externalIds(DEVICE_TYPE, serial);

function feature(ids, key, language, category, type, extra = {}) {
  return {
    name: pick(FEATURE_NAMES, language)[key],
    external_id: ids.feature(key),
    category,
    type,
    min: 0,
    max: 1,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    ...extra,
  };
}

const input = (ids, key, language) => feature(ids, key, language, C.INPUT, T.INPUT.BINARY);
// NOT NULL in Gladys even for a text feature: 0/0, as Zigbee2MQTT.
const text = (ids, key, language) =>
  feature(ids, key, language, C.TEXT, T.TEXT.TEXT, { max: 0, keep_history: false });

/** The device of the alarm. */
export function buildAlarmDevice(gladys, { serial, configuration }, language) {
  const ids = alarmIds(gladys, serial);
  const states = pick(STATE_NAMES, language);
  const base = pick(DEVICE_NAME, language);
  const name = configuration?.name ? `${base} - ${configuration.name}` : base;
  return {
    name: name.slice(0, 80),
    external_id: ids.device,
    model: configuration?.firmware ? `Diagral e-ONE (${configuration.firmware})` : 'Diagral e-ONE',
    ...POLLING,
    features: [
      feature(ids, FEATURE_KEYS.STATE, language, C.TEXT, T.TEXT.SELECT, {
        max: 0,
        supported_options: Object.values(ALARM_STATES).map((value, index) => ({
          value,
          label: states[value],
          sort_order: index,
        })),
      }),
      input(ids, FEATURE_KEYS.TRIGGERED, language),
      text(ids, FEATURE_KEYS.GROUPS, language),
      text(ids, FEATURE_KEYS.FAULTS, language),
      feature(ids, FEATURE_KEYS.FAULT_COUNT, language, C.COUNTER_SENSOR, T.SENSOR.INTEGER, {
        max: 100,
      }),
      feature(ids, FEATURE_KEYS.BATTERY_LOW, language, C.BATTERY_LOW, T.BATTERY_LOW.BINARY),
      feature(ids, FEATURE_KEYS.TAMPER, language, C.TAMPER, T.TAMPER.BINARY),
      input(ids, FEATURE_KEYS.LINK_FAULT, language),
      input(ids, FEATURE_KEYS.ONLINE, language),
    ],
  };
}

/** The names of the groups an arming covers: "Rez-de-chaussée, Groupe 3". */
export function groupsText(groups, configuration, language) {
  const words = pick(WORDS, language);
  if (!groups || groups.length === 0) return words.none;
  const names = new Map((configuration?.groups ?? []).map((group) => [group.index, group.name]));
  const full = groups.map((index) => names.get(index) || `${words.group} ${index}`).join(', ');
  return full.length > MAX_TEXT ? `${full.slice(0, MAX_TEXT - 1)}…` : full;
}

/** One fault for people: "Entrée : piles faibles". */
export function faultLabel(fault, language) {
  const device = fault.central ? pick(WORDS, language).central : fault.device;
  const what = pick(ANOMALY_NAMES, language)[fault.name] ?? fault.name;
  // French puts a space before the colon.
  return `${device}${language === 'fr' ? ' : ' : ': '}${what}`;
}

/** The faults as one text: the first ones, with the count when several. */
export function faultsText(faults, language) {
  if (faults.length === 0) return pick(WORDS, language).none;
  const all = faults.map((fault) => faultLabel(fault, language)).join(', ');
  const listed = faults.length > 1 ? `(${faults.length}) ${all}` : all;
  return listed.length > MAX_TEXT ? `${listed.slice(0, MAX_TEXT - 1)}…` : listed;
}

const bit = (value) => (value ? 1 : 0);

/**
 * The values of the features, by feature key: a number, `{ text }`, or absent
 * when unknown.
 * @param {object} alarm { online, state, groups, faults, triggered (null: unknown) }
 */
export function alarmValues(alarm, configuration, language) {
  const values = { [FEATURE_KEYS.ONLINE]: alarm.online ? 1 : 0 };
  if (alarm.state) {
    values[FEATURE_KEYS.STATE] = { text: alarm.state };
    values[FEATURE_KEYS.GROUPS] = { text: groupsText(alarm.groups, configuration, language) };
  }
  if (alarm.triggered !== null && alarm.triggered !== undefined) {
    values[FEATURE_KEYS.TRIGGERED] = bit(alarm.triggered);
  }
  if (alarm.faults) {
    const kinds = new Set(alarm.faults.map((fault) => fault.kind));
    values[FEATURE_KEYS.FAULTS] = { text: faultsText(alarm.faults, language) };
    values[FEATURE_KEYS.FAULT_COUNT] = Math.min(alarm.faults.length, 100);
    values[FEATURE_KEYS.BATTERY_LOW] = bit(kinds.has('battery'));
    values[FEATURE_KEYS.TAMPER] = bit(kinds.has('tamper'));
    values[FEATURE_KEYS.LINK_FAULT] = bit(kinds.has('link'));
  }
  return values;
}
