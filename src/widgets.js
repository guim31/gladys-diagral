// -----------------------------------------------------------------------------
// The `alarm` dashboard widget: the state of the Diagral alarm, its armed
// groups and faults, and the arming buttons the configuration allows.
//
// Budget of the core: 8 components, 2 texts. Here: one heading, one status
// list, up to four buttons (or a caption when arming from Gladys is off). The
// current mode is marked by the check-circle icon, never by the `primary`
// style, invisible in dark mode (Gladys#3153). Disarming asks for a
// confirmation (`confirm: true`).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { UserError, WIDGET_KEY } from './hub.js';
import { ALARM_STATES } from './diagral/model.js';
import { COMMAND_NAMES, MESSAGES, commandDone, pick } from './texts.js';

// Texts of the widget, by language.
export const TEXT = {
  en: {
    title: 'Diagral',
    state: 'Alarm',
    alarm: 'ALARM IN PROGRESS',
    groups: 'Armed groups',
    faults: 'Faults',
    none: 'None',
    cloud: 'Diagral cloud',
    offline: 'Unreachable',
    controlOff: 'Arming from Gladys is off (configuration).',
    empty: 'Fill in your Diagral account in the configuration of the integration.',
  },
  fr: {
    title: 'Diagral',
    state: 'Alarme',
    alarm: 'ALARME EN COURS',
    groups: 'Groupes en marche',
    faults: 'Anomalies',
    none: 'Aucune',
    cloud: 'Cloud Diagral',
    offline: 'Injoignable',
    controlOff: 'Armement depuis Gladys désactivé (configuration).',
    empty: "Renseignez votre compte Diagral dans la configuration de l'intégration.",
  },
  de: {
    title: 'Diagral',
    state: 'Alarm',
    alarm: 'ALARM LÄUFT',
    groups: 'Eingeschaltete Gruppen',
    faults: 'Störungen',
    none: 'Keine',
    cloud: 'Diagral-Cloud',
    offline: 'Nicht erreichbar',
    controlOff: 'Einschalten über Gladys ist aus (Konfiguration).',
    empty: 'Gib dein Diagral-Konto in der Konfiguration der Integration ein.',
  },
  es: {
    title: 'Diagral',
    state: 'Alarma',
    alarm: 'ALARMA EN CURSO',
    groups: 'Grupos armados',
    faults: 'Anomalías',
    none: 'Ninguna',
    cloud: 'Nube Diagral',
    offline: 'Inaccesible',
    controlOff: 'El armado desde Gladys está desactivado (configuración).',
    empty: 'Indique su cuenta Diagral en la configuración de la integración.',
  },
};

const STATE_STYLE = {
  [ALARM_STATES.DISARMED]: { color: WIDGET_COLORS.NEUTRAL, icon: 'shield-off' },
  [ALARM_STATES.ARMING]: { color: WIDGET_COLORS.WARNING, icon: 'clock' },
  [ALARM_STATES.ARMED]: { color: WIDGET_COLORS.SUCCESS, icon: 'shield' },
  [ALARM_STATES.PARTIAL]: { color: WIDGET_COLORS.SUCCESS, icon: 'shield' },
  [ALARM_STATES.PRESENCE]: { color: WIDGET_COLORS.SUCCESS, icon: 'moon' },
};

// The state a command leads to, to mark the current one.
const STATE_OF_COMMAND = {
  arm: ALARM_STATES.ARMED,
  presence: ALARM_STATES.PRESENCE,
  disarm: ALARM_STATES.DISARMED,
};
const COMMAND_ICONS = {
  arm: 'lock',
  presence: 'moon',
  partial_1: 'home',
  partial_2: 'home',
  disarm: 'unlock',
};
// Action keys of the buttons: one per button (the core drops a duplicate key).
const ACTION_KEYS = {
  arm: 'arm',
  presence: 'presence',
  partial_1: 'partial_1',
  partial_2: 'partial_2',
  disarm: 'disarm',
};
export const WIDGET_COMMANDS = Object.keys(ACTION_KEYS);

const clip = (value, max = 40) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

function statusItems(view, t) {
  const style = STATE_STYLE[view.state];
  const items = view.triggered
    ? [{ label: t.state, value: t.alarm, color: WIDGET_COLORS.DANGER, icon: 'alert-triangle' }]
    : [{ label: t.state, value: clip(view.stateLabel), color: style.color, icon: style.icon }];
  if (view.armedGroups > 0 && view.state !== ALARM_STATES.DISARMED) {
    items.push({
      label: t.groups,
      value: clip(view.groups),
      color: WIDGET_COLORS.INFO,
      icon: 'layers',
    });
  }
  items.push({
    label: t.faults,
    value: view.faults > 0 ? clip(view.faultsText) : t.none,
    color: view.faults > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    icon: view.faults > 0 ? 'alert-circle' : 'check',
  });
  if (!view.online) {
    items.push({
      label: t.cloud,
      value: t.offline,
      color: WIDGET_COLORS.DANGER,
      icon: 'cloud-off',
    });
  }
  return items;
}

function buttons(view, language) {
  const names = pick(COMMAND_NAMES, language);
  // Four buttons at most: one partial mode, the first the alarm has.
  const partial = view.partial1 ? ['partial_1'] : view.partial2 ? ['partial_2'] : [];
  const commands = ['arm', ...partial, 'presence', ...(view.canDisarm ? ['disarm'] : [])];
  return commands.map((command) => ({
    type: 'button',
    label: names[command],
    // The current mode is marked by its icon (the primary style does not show in dark mode).
    icon: STATE_OF_COMMAND[command] === view.state ? 'check-circle' : COMMAND_ICONS[command],
    style: command === 'disarm' ? 'danger' : 'secondary',
    action: {
      key: ACTION_KEYS[command],
      params: { command },
      ...(command === 'disarm' ? { confirm: true } : {}),
    },
  }));
}

export function alarmContent(hub, { language = 'en' } = {}) {
  const t = TEXT[language] ?? TEXT.en;
  const view = hub.view(language);
  if (!view) {
    return { ttl_seconds: 60, components: [{ type: 'text', variant: 'body', text: t.empty }] };
  }
  const components = [
    { type: 'text', variant: 'heading', text: clip(view.name || t.title) },
    { type: 'status', items: statusItems(view, t) },
  ];
  if (view.canArm) components.push(...buttons(view, language));
  else components.push({ type: 'text', variant: 'caption', text: t.controlOff });
  return { ttl_seconds: 60, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (hub, request) => alarmContent(hub, request),
    async action(hub, { params = {} }) {
      const command = String(params.command ?? '');
      if (!WIDGET_COMMANDS.includes(command)) throw new UserError(MESSAGES.failed);
      await hub.setMode(command, { origin: 'widget' });
      return commandDone(command);
    },
  },
};
