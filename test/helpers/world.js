// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, the fake Diagral cloud, a
// temporary /data and a manual clock, with the integration wired on top
// through registerHandlers. No periodic timer runs unless `timers: true`
// (with node:test mock timers): the tests read the cloud with
// `world.hub.refresh()` and post webhook events with `world.fake.webhook()`.
// -----------------------------------------------------------------------------

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import { FakeCloud, PASSWORD, PIN, SERIAL, USERNAME } from './fakeCloud.js';

// The integration logs its lifecycle; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

export const BASE_CONFIG = {
  username: USERNAME,
  password: PASSWORD,
  serial: SERIAL,
  pin_code: PIN,
  alarm_control: 'full',
  refresh_interval: '300',
  language: 'en',
};

export const WEBHOOK_URL =
  'https://api.gladysgateway.com/v1/api/external-integration/open-api-key-123/test-integration/events';

/** The Gladys Plus webhook state served by getWebhooks(). */
export const PLUS_WEBHOOKS = {
  available: true,
  webhooks: [{ key: 'events', mode: 'fire_and_forget', url: WEBHOOK_URL }],
};
export const NO_WEBHOOKS = {
  available: false,
  webhooks: [{ key: 'events', mode: 'fire_and_forget', url: null }],
};

/** A manual clock. */
export function createClock(start = Date.UTC(2026, 9, 14, 21, 42, 30)) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/** Let the handlers and the fake network settle. */
export async function settle(rounds = 40) {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/**
 * @param {object} [options]
 * @param {FakeCloud} [options.cloud]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {object} [options.webhooks] Gladys Plus webhook state
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers]
 * @param {object} [options.timings] HUB_TIMINGS overrides
 */
export async function createWorld({
  clock = createClock(),
  cloud = new FakeCloud(),
  config = BASE_CONFIG,
  devices = [],
  webhooks = NO_WEBHOOKS,
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-diagral-')),
  timings = {},
  timers = false,
} = {}) {
  const gladys = createFakeGladys({ config, devices, webhooks });
  const app = registerHandlers(gladys, {
    store: new Store(dataDir),
    request: cloud.request,
    timers,
    timings,
    now: clock.now,
  });
  const world = { gladys, fake: gladys.fake, cloud, app, hub: app.hub, clock, dataDir };
  if (connect) {
    await gladys.connect();
    await app.ready;
    await settle();
  }
  return world;
}

export const alarmIds = (gladys) => gladys.externalIds('alarm', SERIAL);

/** Add every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
  await settle();
}

/** The last state of a feature of the alarm. */
export const stateOf = (world, key) => world.fake.lastState(alarmIds(world.gladys).feature(key));

/** The scene events fired with a key. */
export const eventsOf = (world, key) => world.fake.sceneEvents.filter((event) => event.key === key);

export { SERIAL };
