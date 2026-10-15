// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake Gladys)
// and returns the hub, so index.js stays a few lines and the tests drive the
// very same wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { DiagralHub, WEBHOOK_KEY } from './hub.js';
import { SCENE_ACTIONS } from './scenes.js';
import { Store } from './store.js';
import { INIT_FAILED } from './texts.js';
import { WIDGETS } from './widgets.js';

const logger = createLogger({ name: 'diagral-app' });

// Manifest actions (`actions`) and their handlers: keys are permanent.
export const ACTIONS = {
  test_connection: (hub) => hub.testConnection(),
  renew_api_key: (hub) => hub.renewKey(),
};

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: store, request, timers, timings, now
 */
export function registerHandlers(gladys, options = {}) {
  const hub = new DiagralHub({
    gladys,
    store: options.store ?? new Store(),
    request: options.request,
    timers: options.timers ?? true,
    timings: options.timings,
    now: options.now,
  });

  // Resolved once the hub has started; every handler waits for it, so a
  // command arriving during the first read is not lost.
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let started = false;
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  gladys.on('connected', async () => {
    try {
      const config = normalizeConfig(await gladys.getConfig());
      if (started) {
        // A reconnection (Gladys restarted): send again what Gladys may have lost.
        await hub.resync(config);
        return;
      }
      started = true;
      await hub.start(config);
    } catch (err) {
      logger.error('Initialization failed', err);
      await gladys.setConnectionStatus(false, INIT_FAILED).catch(() => {});
    } finally {
      resolveReady();
    }
  });

  gladys.onScanRequest(whenReady(() => hub.rediscover()));

  // No feature can be set: the state of the alarm is read-only by design.
  gladys.onSetValue(
    whenReady((device, feature) => {
      throw new Error(`${feature?.external_id ?? 'This feature'} is read-only`);
    }),
  );

  // The hub reads the cloud on its own timer (GladysAssistant/Gladys#3198);
  // this only serves a Gladys that polls anyway, never faster than the timer.
  gladys.onPoll(
    whenReady(async () => {
      await hub.poll();
    }),
  );

  gladys.onDeviceCreated(whenReady(() => hub.onDeviceCreated()));

  gladys.onConfigUpdated(whenReady((newConfig) => hub.reconfigure(normalizeConfig(newConfig))));

  // Gladys Plus relays the events of the Diagral webhook (fire_and_forget).
  gladys.onWebhook(
    WEBHOOK_KEY,
    whenReady((request) => hub.handleWebhook(request)),
  );
  gladys.onWebhookUpdated(whenReady((webhooks) => hub.syncWebhook(webhooks)));

  for (const [key, handler] of Object.entries(ACTIONS)) {
    gladys.onAction(
      key,
      whenReady(() => handler(hub)),
    );
  }

  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(
      key,
      whenReady((fields) => handler(hub, { fields })),
    );
  }

  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(
      key,
      whenReady((request) => widget.get(hub, request)),
    );
    gladys.onWidgetAction(
      key,
      whenReady((actionKey, params, extra) => widget.action(hub, { actionKey, params, ...extra })),
    );
  }

  return {
    hub,
    ready,
    stop: () => hub.stop(),
  };
}
