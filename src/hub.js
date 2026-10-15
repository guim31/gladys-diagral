// -----------------------------------------------------------------------------
// The Diagral hub: one Diagral e-ONE alarm (one box), read on the container's
// own timer and, when Gladys Plus relays it, told of its events in real time
// by the webhook of the Diagral cloud.
//
//   - every 1 to 10 minutes (the configuration, 5 by default, as Home
//     Assistant): the state of the alarm (GET status) and its anomalies (GET
//     anomalies); the configuration (names of the alarm and of its groups,
//     partial modes, devices) at the start, on a scan and every 6 hours. Two
//     requests per read: Diagral publishes no quota, a 429 pauses the reads
//     (1 minute, then twice as long each time, up to 2 hours);
//   - the webhook (one per box at Diagral): an alarm fires the scene trigger
//     `alarm_triggered` and sets "Alarm in progress" at once — the API has no
//     other way to tell an alarm; an arming or a fault only triggers a read,
//     the API stays the reference (doctrine "trigger, not data" of the SDK).
//     An event is accepted once (same code, date, group and device), only
//     from the transmitter of the box, and an alarm older than 15 minutes
//     (a late delivery) fires nothing.
// The container refreshes itself: Gladys polls unreliably
// (GladysAssistant/Gladys#3198), onPoll is a fallback that never reads the
// cloud more often than the timer would. The alarm is read even before its
// device is added to Gladys: the widget and the scene triggers use it.
//
// States go through publishChangedStates (only the changes, plus a heartbeat
// every 6 hours: the front shows "no recent value" past 48 hours), and only
// once the user added the device.
//
// Logs: info keeps the lifecycle (connected, cloud lost and back, alarms,
// arming changes, faults appearing and clearing, webhook registered, user
// commands); a problem that repeats is logged once, and once when it clears;
// the rest goes to debug (LOG_LEVEL=debug). Never the password, the access
// code, the API key or its secret, the webhook address, nor a user name.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { createLogger } from '@gladysassistant/integration-sdk';
import { accountOf, missingSettings } from './config.js';
import {
  FEATURE_KEYS,
  alarmIds,
  alarmValues,
  buildAlarmDevice,
  faultLabel,
  faultsText,
  groupsText,
} from './devices.js';
import { DiagralClient, ERROR_KINDS } from './diagral/client.js';
import {
  ALARM_STATES,
  EVENT_TYPES,
  SETTLED_STATES,
  deviceLabelOf,
  parseAnomalies,
  parseConfiguration,
  parseNotification,
  parseStatus,
} from './diagral/model.js';
import { CONNECTION_TEXT, MESSAGES, STATE_NAMES, connectedReport, pick } from './texts.js';

const logger = createLogger({ name: 'diagral-hub' });

export const WIDGET_KEY = 'alarm';
export const WEBHOOK_KEY = 'events';

// Scene trigger keys (manifest `scene_triggers`): permanent once published.
export const TRIGGERS = Object.freeze({
  ALARM: 'alarm_triggered',
  MODE: 'alarm_mode_changed',
  FAULT: 'fault_reported',
});

export const HUB_TIMINGS = {
  configurationMs: 6 * 60 * 60_000,
  heartbeatMs: 6 * 60 * 60_000,
  // A read soon after a command or a webhook event (events come in bursts).
  followUpMs: 3_000,
  // During an exit delay, a read this often until the alarm is armed.
  armingMs: 30_000,
  // Paused reads after a 429: the first pause, doubled each time, capped.
  pauseMs: 60_000,
  maxPauseMs: 2 * 60 * 60_000,
  // A webhook alarm older than this is a late delivery: no scene fired.
  eventMaxAgeMs: 15 * 60_000,
  // The user of a webhook event names the next arming change within this.
  changedByMs: 3 * 60_000,
};

// Deduplication window of the webhook events.
const SEEN_EVENTS = 100;

export class UserError extends Error {
  /** @param {object} text a multi-language message, shown to the user */
  constructor(text) {
    super(text.en);
    // The SDK sends `message` back to Gladys, which shows the user's language.
    this.message = text;
    this.text = text;
  }
}

/** The user-facing text of a failure of the cloud. */
export function failureText(err) {
  if (err instanceof UserError) return err.text;
  switch (err?.kind) {
    case ERROR_KINDS.AUTH:
      return CONNECTION_TEXT.authRefused;
    case ERROR_KINDS.ACCESS:
      return CONNECTION_TEXT.accessRefused;
    case ERROR_KINDS.RATE_LIMITED:
      return CONNECTION_TEXT.rateLimited;
    case ERROR_KINDS.NETWORK:
    case ERROR_KINDS.SERVER:
      return CONNECTION_TEXT.unreachable;
    default:
      return MESSAGES.failed;
  }
}

const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');

const asState = (externalId, value) =>
  value !== null && typeof value === 'object'
    ? { device_feature_external_id: externalId, text: value.text }
    : { device_feature_external_id: externalId, state: value };

/** "1, 3" or "1;3" or "1 3" → [1, 3]; null when something else is there. */
export function parseGroups(value) {
  const parts = String(value ?? '')
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (parts.length === 0 || !parts.every((part) => /^\d{1,2}$/.test(part))) return null;
  return [...new Set(parts.map(Number))].sort((a, b) => a - b);
}

export class DiagralHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store persistence (src/store.js)
   * @param {Function} [options.request] HTTP seam (src/diagral/http.js)
   * @param {boolean} [options.timers] the periodic read (off in most tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   */
  constructor({ gladys, store, request, timers = true, timings, now }) {
    this.gladys = gladys;
    this.store = store;
    this.request = request;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    this.config = null;
    this.client = null;
    this.configuration = null;
    this.configurationAt = -Infinity;
    // What is known of the alarm; null: not read yet.
    this.alarm = {
      online: false,
      state: null,
      raw: null,
      groups: [],
      faults: null,
      triggered: null,
    };
    this.discovered = false;
    this.lastReadAt = null;
    this.lastError = null;
    this.reading = null;
    this.timer = null;
    this.followUp = null;
    this.stopped = false;
    // Why the reads stopped until the configuration changes: an AUTH or
    // ACCESS error kind, null otherwise.
    this.refused = null;
    this.pausedUntil = 0;
    this.pauseStep = 0;
    this.connection = null;
    this.structure = null;
    this.webhookActive = false;
    this.seenEvents = [];
    this.lastUser = null;
    /** Problems already logged, by key: their repeats go to debug. */
    this.warned = new Set();
  }

  get language() {
    return this.config?.language ?? 'fr';
  }

  get serial() {
    return this.config?.serial ?? '';
  }

  get externalId() {
    return alarmIds(this.gladys, this.serial).device;
  }

  // --- Logs --------------------------------------------------------------------

  /** Log a problem once (`level` warn or info), its repeats at debug. */
  problem(key, message, level = 'warn') {
    if (this.warned.has(key)) {
      logger.debug(message);
      return;
    }
    this.warned.add(key);
    logger[level](message);
  }

  /** The problem `key` is gone: say so once, the next occurrence logs again. */
  resolved(key, message) {
    if (this.warned.delete(key) && message) {
      logger.info(message);
    }
  }

  // --- Lifecycle ---------------------------------------------------------------

  async start(config) {
    this.config = config;
    await this.store.load();
    this.client = this.createClient();
    this.schedule();
    if (!this.client) {
      logger.info('Diagral account not configured yet');
      await this.publishConnection();
      return;
    }
    await this.discover();
    await this.syncWebhook();
  }

  /** A client for the account of the configuration, null when it is incomplete. */
  createClient() {
    if (missingSettings(this.config).length > 0) return null;
    const account = accountOf(this.config);
    // A key created for another account or box is not reused.
    const keys =
      this.store.get('account') === account
        ? { apiKey: this.store.get('apiKey'), secretKey: this.store.get('secretKey') }
        : {};
    return new DiagralClient({
      account: {
        username: this.config.username,
        password: this.config.password,
        serial: this.config.serial,
        pinCode: this.config.pinCode,
      },
      keys,
      request: this.request,
      now: this.now,
      onKeys: async (created) => {
        if (created) {
          logger.info('API key created on the Diagral cloud');
          await this.store.update({ account, ...created });
        } else {
          await this.store.update({ account: undefined, apiKey: undefined, secretKey: undefined });
        }
      },
    });
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    const changed = this.credentialsChanged(config);
    this.config = config;
    this.gladys.forgetPublishedStates?.();
    this.connection = null;
    this.structure = null;
    if (changed) {
      await this.restart();
      return;
    }
    if (this.discovered) {
      await this.publishDevices();
      await this.publishAllStates();
    }
    await this.publishConnection();
    await this.syncWebhook();
  }

  credentialsChanged(config) {
    const previous = this.config;
    return (
      !previous ||
      ['username', 'password', 'serial', 'pinCode'].some((key) => previous[key] !== config[key])
    );
  }

  /** New credentials: a new client, everything read again. */
  async restart() {
    clearTimeout(this.followUp);
    this.client = this.createClient();
    this.refused = null;
    this.pausedUntil = 0;
    this.pauseStep = 0;
    this.lastError = null;
    this.warned.clear();
    this.discovered = false;
    this.configuration = null;
    this.configurationAt = -Infinity;
    this.alarm = { ...this.alarm, state: null, raw: null, groups: [], faults: null };
    this.schedule();
    if (!this.client) {
      await this.publishConnection();
      return;
    }
    await this.discover();
    await this.syncWebhook();
  }

  async reconfigure(config) {
    const previous = this.config;
    if (this.credentialsChanged(config)) {
      this.config = config;
      logger.info('Diagral account changed in the configuration');
      await this.restart();
      this.nudgeWidget();
      return;
    }
    this.config = config;
    if (previous?.refreshMs !== config.refreshMs) this.schedule();
    if (previous?.realtimeWebhook !== config.realtimeWebhook) await this.syncWebhook();
    if (previous?.language !== config.language && this.discovered) {
      // Names of a new device; Gladys keeps those of a device already added.
      this.structure = null;
      await this.publishDevices();
      await this.publishAllStates();
    }
    this.nudgeWidget();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.followUp);
    this.timer = null;
    this.followUp = null;
    await this.store.flush();
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.timersEnabled || this.stopped) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      try {
        await this.refresh();
      } catch (err) {
        logger.debug(`Read failed: ${err.message}`);
      } finally {
        this.schedule();
      }
    }, this.config?.refreshMs ?? 300_000);
    this.timer.unref?.();
  }

  /** A read soon (after a command, an event, during an exit delay), coalesced. */
  scheduleFollowUp(ms = this.timings.followUpMs) {
    if (!this.timersEnabled || this.stopped) return;
    clearTimeout(this.followUp);
    this.followUp = setTimeout(() => {
      this.followUp = null;
      this.refresh({ force: true }).catch((err) => logger.debug(`Read failed: ${err.message}`));
    }, ms);
    this.followUp.unref?.();
  }

  // --- Reading the cloud -------------------------------------------------------

  isCreated() {
    return (this.gladys.devices ?? []).some((device) => device.external_id === this.externalId);
  }

  canRead() {
    return Boolean(this.client) && !this.refused && !this.stopped;
  }

  /** Everything, configuration included: the start, a scan, a new account. */
  async discover() {
    if (!this.canRead()) {
      await this.publishConnection();
      return false;
    }
    const ok = await this.read({ full: true });
    if (ok) {
      this.discovered = true;
      await this.publishDevices();
      await this.publishAllStates();
    }
    await this.publishConnection();
    this.nudgeWidget();
    return ok;
  }

  /**
   * The periodic read. Coalesced with a read in progress; `force` reads even
   * within the pause of a 429 (a command or an event just came).
   */
  async refresh({ force = false } = {}) {
    if (!this.canRead()) return false;
    if (!this.discovered) return this.discover();
    if (!force && this.now() < this.pausedUntil) {
      logger.debug('Reads paused (Diagral asked to slow down)');
      return false;
    }
    const before = this.widgetSignature();
    const ok = await this.read({ full: false });
    if (ok) {
      await this.publishDevicesIfChanged();
      await this.publishAllStates();
    }
    // The widget is pulled again only when what it shows changed.
    if (this.widgetSignature() !== before) this.nudgeWidget();
    await this.publishConnection();
    return ok;
  }

  /** onPoll: a read if the timer has not done one recently, else the known states. */
  async poll() {
    const period = this.config?.refreshMs ?? 300_000;
    if (this.lastReadAt === null || this.now() - this.lastReadAt >= period * 0.9) {
      return this.refresh();
    }
    await this.publishAllStates();
    return true;
  }

  /** One read at a time: a periodic read joins the one in progress, a full one waits for it. */
  async read(options) {
    while (this.reading) {
      if (!options.full) return this.reading;
      await this.reading.catch(() => {});
    }
    this.reading = this.readCloud(options).finally(() => {
      this.reading = null;
    });
    return this.reading;
  }

  async readCloud({ full }) {
    const started = this.now();
    try {
      if (
        full ||
        !this.configuration ||
        started - this.configurationAt >= this.timings.configurationMs
      ) {
        this.configuration = parseConfiguration(await this.client.configuration());
        this.configurationAt = started;
      }
      const status = parseStatus(await this.client.status(), this.configuration);
      const faults = parseAnomalies(await this.client.anomalies(), this.configuration);
      this.lastReadAt = started;
      this.readSucceeded();
      await this.applyStatus(status);
      await this.applyFaults(faults);
      return true;
    } catch (err) {
      await this.readFailed(err);
      return false;
    }
  }

  readSucceeded() {
    this.lastError = null;
    this.pauseStep = 0;
    this.pausedUntil = 0;
    if (!this.alarm.online) {
      this.alarm.online = true;
      if (this.warned.has('cloud')) {
        this.resolved('cloud', 'The Diagral cloud answers again');
      } else {
        logger.info('Connected to the Diagral cloud');
      }
    }
    this.resolved('paused', 'Diagral accepts requests again');
  }

  async readFailed(err) {
    this.lastError = err;
    switch (err?.kind) {
      case ERROR_KINDS.AUTH:
      case ERROR_KINDS.ACCESS:
        // Trying again with the same settings could lock the account: the
        // reads stop until the configuration changes.
        this.refused = err.kind;
        logger.warn(
          err.kind === ERROR_KINDS.AUTH
            ? `Diagral refused the e-mail address or the password (${err.message}): check the configuration`
            : `Diagral refused the serial number or the access code (${err.message}): check the configuration`,
        );
        break;
      case ERROR_KINDS.RATE_LIMITED: {
        const pause = Math.min(this.timings.pauseMs * 2 ** this.pauseStep, this.timings.maxPauseMs);
        this.pauseStep += 1;
        this.pausedUntil = this.now() + pause;
        this.problem(
          'paused',
          `Diagral refused a read (${err.message}): reads paused, ${Math.round(pause / 60_000)} min first`,
        );
        return;
      }
      default:
        this.problem('cloud', `The Diagral cloud cannot be read (${err?.message ?? err})`);
    }
    if (this.alarm.online) {
      this.alarm.online = false;
      await this.sendStates(this.alarmStates([FEATURE_KEYS.ONLINE]));
    }
  }

  /** A new state of the alarm, from a read or the answer to a command. */
  async applyStatus(status, origin = null) {
    if (status.state === null) {
      this.problem(
        `status:${status.raw}`,
        `Unknown alarm status "${status.raw}": kept the last one`,
        'info',
      );
      return;
    }
    const previous = this.alarm.state;
    this.alarm.state = status.state;
    this.alarm.raw = status.raw;
    this.alarm.groups = status.groups;
    if (status.state === ALARM_STATES.ARMING) this.scheduleFollowUp(this.timings.armingMs);
    if (status.state === ALARM_STATES.DISARMED && this.alarm.triggered) {
      this.alarm.triggered = false;
      logger.info('Alarm stopped: the alarm is disarmed');
    }
    if (previous === null || previous === status.state) return;
    if (!SETTLED_STATES.includes(status.state)) return;
    // A command of the user already wrote its line.
    if (!origin) logger.info(`Alarm ${status.state}`);
    await this.fire(TRIGGERS.MODE, {
      alarm: this.externalId,
      mode: status.state,
      changed_by: this.recentUser(),
    });
  }

  /** The user named by a recent webhook event, if any. */
  recentUser() {
    if (!this.lastUser || this.now() - this.lastUser.at > this.timings.changedByMs) return null;
    return this.lastUser.name;
  }

  /** The anomalies of a read: new ones fire `fault_reported`. */
  async applyFaults(faults) {
    const previous = this.alarm.faults;
    this.alarm.faults = faults;
    if (previous === null) {
      if (faults.length > 0) logger.info(`${faults.length} fault(s) reported by the alarm`);
      return;
    }
    const before = new Set(previous.map((fault) => fault.id));
    const after = new Set(faults.map((fault) => fault.id));
    for (const fault of faults) {
      if (before.has(fault.id)) continue;
      logger.info(`New fault on the alarm: ${fault.name} (${fault.kind})`);
      await this.fire(TRIGGERS.FAULT, {
        alarm: this.externalId,
        kind: fault.kind,
        device: fault.central ? null : fault.device,
        fault: faultLabel(fault, this.language),
      });
    }
    for (const fault of previous) {
      if (!after.has(fault.id)) logger.info(`Fault cleared on the alarm: ${fault.name}`);
    }
  }

  // --- Devices -----------------------------------------------------------------

  buildDevices() {
    if (!this.discovered || !this.serial) return [];
    return [
      buildAlarmDevice(
        this.gladys,
        { serial: this.serial, configuration: this.configuration },
        this.language,
      ),
    ];
  }

  async publishDevices() {
    const devices = this.buildDevices();
    if (devices.length === 0) return;
    this.structure = JSON.stringify(devices);
    try {
      await this.gladys.publishDiscoveredDevices(devices);
    } catch (err) {
      this.structure = null;
      logger.warn(`Devices not published: ${err.message}`);
    }
  }

  async publishDevicesIfChanged() {
    if (JSON.stringify(this.buildDevices()) !== this.structure) {
      await this.publishDevices();
    }
  }

  async rediscover() {
    if (!this.client) {
      await this.publishConnection();
      return;
    }
    // A scan is the user asking: a refused account is tried again.
    this.refused = null;
    await this.discover();
  }

  async onDeviceCreated() {
    // The SDK forgot what it had published for this device: send it all now.
    await this.publishAllStates();
    this.nudgeWidget();
  }

  // --- States ------------------------------------------------------------------

  /** The states of the alarm (`keys`: some features only), when its device is added. */
  alarmStates(keys = null) {
    if (!this.serial || !this.isCreated()) return [];
    const ids = alarmIds(this.gladys, this.serial);
    const values = alarmValues(this.alarm, this.configuration, this.language);
    return Object.entries(values)
      .filter(([key]) => !keys || keys.includes(key))
      .map(([key, value]) => asState(ids.feature(key), value));
  }

  async publishAllStates() {
    await this.sendStates(this.alarmStates());
  }

  async sendStates(states) {
    if (states.length === 0) return;
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.resolved('states', 'States are accepted by Gladys again');
    } catch (err) {
      this.problem('states', `States not published: ${err.message}`);
    }
  }

  // --- Connection status -------------------------------------------------------

  connectionStatus() {
    if (!this.client) return { ok: false, text: CONNECTION_TEXT.notConfigured };
    if (this.refused === ERROR_KINDS.AUTH) return { ok: false, text: CONNECTION_TEXT.authRefused };
    if (this.refused === ERROR_KINDS.ACCESS) {
      return { ok: false, text: CONNECTION_TEXT.accessRefused };
    }
    if (this.warned.has('paused')) return { ok: false, text: CONNECTION_TEXT.rateLimited };
    if (!this.alarm.online || !this.discovered) {
      return { ok: false, text: CONNECTION_TEXT.unreachable };
    }
    return { ok: true, text: null };
  }

  async publishConnection() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) return;
    try {
      if (status.ok) await this.gladys.setConnectionStatus(true);
      else await this.gladys.setConnectionStatus(false, status.text);
      this.connection = key;
    } catch (err) {
      logger.debug(`Connection status not sent: ${err.message}`);
    }
  }

  nudgeWidget() {
    try {
      this.gladys.requestWidgetRefresh?.(WIDGET_KEY);
    } catch {
      // dropped while disconnected
    }
  }

  async fire(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
    } catch (err) {
      this.problem(`trigger:${key}`, `Scene trigger ${key} not sent: ${err.message}`);
    }
  }

  // --- Webhook -----------------------------------------------------------------

  /**
   * Register the Gladys Plus address of the webhook at Diagral, or remove the
   * one this integration registered when the option is off or Gladys Plus no
   * longer offers it. Diagral keeps one webhook per box: without the option
   * ("Receive alarms in real time"), the webhook of another software is never
   * read, replaced nor deleted, and ours is deleted only when it is still
   * ours. Best effort: without it, the reads still follow the alarm.
   */
  async syncWebhook(info = null) {
    if (!this.canRead() || !this.discovered) return;
    const saved = this.store.get('webhook');
    if (!this.config.realtimeWebhook) {
      this.webhookOff();
      if (saved) await this.removeOwnWebhook(saved);
      return;
    }
    let webhooks = info;
    if (!webhooks) {
      try {
        webhooks = await this.gladys.getWebhooks();
      } catch (err) {
        logger.debug(`Gladys Plus webhook state unknown: ${err.message}`);
        return;
      }
    }
    const url = webhooks?.available
      ? (webhooks.webhooks ?? []).find((webhook) => webhook.key === WEBHOOK_KEY)?.url
      : null;
    if (!url) {
      this.webhookOff();
      if (saved) await this.removeOwnWebhook(saved);
      return;
    }
    try {
      const current = await this.client.webhook();
      const subscriptions = current?.subscriptions ?? {};
      let answer = current;
      if (
        current?.webhook_url !== url ||
        !subscriptions.alert ||
        !subscriptions.state ||
        !subscriptions.anomaly
      ) {
        if (current?.webhook_url && sha256(current.webhook_url) !== saved?.hash) {
          // Diagral keeps one webhook per box: another tool loses its own.
          logger.info('A webhook registered at Diagral by another tool is replaced by Gladys Plus');
        }
        answer = await this.client.setWebhook(url, { create: !current });
        logger.info('Diagral events now arrive in real time through Gladys Plus');
      }
      await this.store.update({
        webhook: {
          hash: sha256(url),
          transmitter: answer?.transmitter_id ?? current?.transmitter_id ?? saved?.transmitter,
        },
      });
      this.webhookActive = true;
      this.resolved('webhook', 'Diagral webhook registered again');
      if (this.alarm.triggered === null) {
        // From now on an alarm is told: "no alarm" becomes a value.
        this.alarm.triggered = false;
        await this.publishAllStates();
      }
    } catch (err) {
      this.webhookActive = false;
      this.problem('webhook', `Diagral webhook not registered (${err.message}): reads only`);
    }
  }

  /** No more webhook: "no alarm" is no longer known, so it is no longer sent. */
  webhookOff() {
    this.webhookActive = false;
    if (this.alarm.triggered === false) this.alarm.triggered = null;
  }

  /** Delete the webhook at Diagral if it is still the one this integration registered. */
  async removeOwnWebhook(saved) {
    try {
      const current = await this.client.webhook();
      if (current?.webhook_url && sha256(current.webhook_url) === saved.hash) {
        await this.client.deleteWebhook();
        logger.info('Gladys Plus webhook removed at Diagral: reads only');
      }
      await this.store.update({ webhook: undefined });
    } catch (err) {
      this.problem('webhook', `Diagral webhook not removed (${err.message})`);
    }
  }

  /** Is this transmitter id the one of the box? */
  isOurs(transmitter) {
    const id = String(transmitter).toUpperCase();
    const saved = this.store.get('webhook')?.transmitter;
    return id === this.serial.toUpperCase() || (saved && id === String(saved).toUpperCase());
  }

  /** An event of the Diagral webhook, relayed by Gladys Plus. */
  async handleWebhook(request = {}) {
    const event = parseNotification(request.body);
    if (!event) {
      logger.debug('Webhook call without a Diagral event ignored');
      return;
    }
    if (!this.client || !event.transmitter || !this.isOurs(event.transmitter)) {
      // The address is the secret: an event of another box is a wrong one.
      logger.debug(`Webhook event ${event.code} of another transmitter ignored`);
      return;
    }
    if (this.seenEvents.includes(event.key)) {
      logger.debug(`Webhook event ${event.code} received twice`);
      return;
    }
    this.seenEvents.push(event.key);
    if (this.seenEvents.length > SEEN_EVENTS) this.seenEvents.shift();
    logger.debug(`Webhook event ${event.code} (${event.type})`);
    if (event.user) this.lastUser = { name: event.user, at: this.now() };

    const late = event.at !== null && this.now() - event.at > this.timings.eventMaxAgeMs;
    if (event.type === EVENT_TYPES.ALERT && event.code < 3000 && !late) {
      await this.alarmed(event);
    } else if (late) {
      logger.debug(`Webhook event ${event.code} arrived late: a read only`);
    }
    // The API is the reference: the state, the faults, the end of a delay.
    this.scheduleFollowUp();
  }

  async alarmed(event) {
    logger.info(`ALARM (${event.kind}) reported by Diagral, code ${event.code}`);
    this.alarm.triggered = true;
    await this.sendStates(this.alarmStates([FEATURE_KEYS.TRIGGERED]));
    this.nudgeWidget();
    const group = event.group
      ? (this.configuration?.groups.find((entry) => entry.index === event.group)?.name ??
        String(event.group))
      : null;
    await this.fire(TRIGGERS.ALARM, {
      alarm: this.externalId,
      kind: event.kind,
      device: deviceLabelOf(event, this.configuration),
      group,
      code: event.code,
    });
  }

  // --- Commands ----------------------------------------------------------------

  requireReady() {
    if (!this.client) throw new UserError(CONNECTION_TEXT.notConfigured);
    if (this.refused) throw new UserError(failureText({ kind: this.refused }));
  }

  /** The alarm a widget or a scene is about: none chosen, or this one. */
  checkDevice(externalId) {
    if (externalId && externalId !== this.externalId) throw new UserError(MESSAGES.unknownDevice);
  }

  /**
   * Arm or disarm, as far as the configuration allows.
   * @param {string} command one of COMMANDS (src/diagral/model.js)
   * @param {object} options
   * @param {string} [options.groups] the groups of the `groups` command, "1,3"
   * @param {string} options.origin for the log: 'widget', 'scene'
   */
  async setMode(command, { groups, origin }) {
    this.requireReady();
    if (!this.config.canArm) throw new UserError(MESSAGES.controlOff);
    if (command === 'disarm' && !this.config.canDisarm) throw new UserError(MESSAGES.disarmOff);
    if (!this.configuration) {
      // Not read yet (cloud down at the start): the command needs the groups.
      if (!(await this.discover())) throw new UserError(failureText(this.lastError));
    }
    let chosen;
    if (command === 'partial_1' || command === 'partial_2') {
      const partial =
        command === 'partial_1' ? this.configuration.partial1 : this.configuration.partial2;
      if (partial.length === 0) throw new UserError(MESSAGES.noPartial);
    }
    if (command === 'groups') {
      chosen = parseGroups(groups);
      const known = new Set(this.configuration.groups.map((group) => group.index));
      if (!chosen || !chosen.every((index) => known.has(index))) {
        throw new UserError(MESSAGES.badGroups);
      }
    }
    let answer;
    try {
      answer = await this.client.command(command, chosen);
    } catch (err) {
      logger.warn(`Alarm command ${command} refused: ${err.message}`);
      if (err.kind === ERROR_KINDS.AUTH || err.kind === ERROR_KINDS.ACCESS)
        await this.readFailed(err);
      throw new UserError(failureText(err));
    }
    logger.info(`Alarm command ${command} sent from the ${origin}`);
    // The end of the exit delay, read later, is this command too.
    this.lastUser = { name: 'Gladys', at: this.now() };
    const status = parseStatus(answer, this.configuration);
    if (status.state) {
      await this.applyStatus(status, origin);
      await this.publishAllStates();
      this.nudgeWidget();
    }
    this.scheduleFollowUp();
    return { state: this.alarm.state };
  }

  // --- Actions -----------------------------------------------------------------

  async testConnection() {
    this.requireReady();
    const ok = await this.discover();
    if (!ok) throw new UserError(failureText(this.lastError));
    await this.syncWebhook();
    return this.report();
  }

  report() {
    return connectedReport({
      name: this.configuration?.name ?? '',
      state: this.alarm.state,
      groups: this.configuration?.groups.length ?? 0,
      faults: this.alarm.faults?.length ?? 0,
    });
  }

  /** A new API key on the Diagral cloud; the previous one is deleted. */
  async renewKey() {
    if (!this.client) throw new UserError(CONNECTION_TEXT.notConfigured);
    this.refused = null;
    try {
      await this.client.createKey(this.client.apiKey);
    } catch (err) {
      await this.readFailed(err);
      await this.publishConnection();
      throw new UserError(failureText(err));
    }
    logger.info('API key of the Diagral cloud renewed by the user');
    await this.discover();
    return MESSAGES.keyRenewed;
  }

  // --- Widget ------------------------------------------------------------------

  /** A fingerprint of what the widget shows. */
  widgetSignature() {
    return JSON.stringify(this.view('en'));
  }

  /** What the widget shows of the alarm (null when there is nothing to show). */
  view(language = this.language) {
    if (!this.client || this.alarm.state === null) return null;
    const faults = this.alarm.faults ?? [];
    return {
      externalId: this.externalId,
      name: this.configuration?.name ?? '',
      state: this.alarm.state,
      stateLabel: pick(STATE_NAMES, language)[this.alarm.state],
      groups: groupsText(this.alarm.groups, this.configuration, language),
      armedGroups: this.alarm.groups.length,
      faults: faults.length,
      faultsText: faultsText(faults, language),
      triggered: this.alarm.triggered === true,
      online: this.alarm.online,
      canArm: Boolean(this.config?.canArm),
      canDisarm: Boolean(this.config?.canDisarm),
      partial1: (this.configuration?.partial1.length ?? 0) > 0,
      partial2: (this.configuration?.partial2.length ?? 0) > 0,
    };
  }
}
