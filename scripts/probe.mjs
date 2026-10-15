#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Probe of the real Diagral e-ONE cloud, with the very client of the
// integration (src/diagral/client.js). Run it where the network reaches
// appv3.tt-monitor.com — the coding sessions cannot.
//
//   node scripts/probe.mjs
//       A made-up account: the sign-in must be refused (AUTH). Proves the
//       address, the route and the shape of a refusal, with no account.
//
//   DIAGRAL_USERNAME=… DIAGRAL_PASSWORD=… DIAGRAL_SERIAL=… DIAGRAL_PIN=… \
//     node scripts/probe.mjs
//       A real account, READ-ONLY for the alarm: it creates an API key (as
//       the integration does), reads the configuration, the status, the
//       anomalies and the webhook subscription, then DELETES the key. Nothing
//       is armed or disarmed, no webhook is changed.
//
// What it prints: HTTP outcomes, error kinds, the status word, counts, and
// the SHAPE of each answer (keys and value types) — never a value that could
// identify the home: no name, label, serial, key, token, address or code.
// Behind a proxy, Node's fetch needs NODE_USE_ENV_PROXY=1 (Node 24).
// -----------------------------------------------------------------------------

import { DiagralClient } from '../src/diagral/client.js';
import { parseAnomalies, parseConfiguration, parseStatus } from '../src/diagral/model.js';

/** The shape of a JSON value: its keys and the types of its leaves. */
function shape(value, depth = 0) {
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : [shape(value[0], depth + 1), `…×${value.length}`];
  }
  if (value && typeof value === 'object') {
    if (depth > 4) return '{…}';
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v, depth + 1)]));
  }
  return value === null ? 'null' : typeof value;
}

const print = (label, value) => console.log(`${label}:`, JSON.stringify(value, null, 1));

async function step(label, fn) {
  try {
    const result = await fn();
    console.log(`✓ ${label}`);
    return result;
  } catch (err) {
    console.log(`✗ ${label}: ${err.kind ?? err.name} — ${err.message}`);
    return undefined;
  }
}

const real = Boolean(process.env.DIAGRAL_USERNAME);
const account = {
  username: process.env.DIAGRAL_USERNAME ?? 'probe-gladys@example.com',
  password: process.env.DIAGRAL_PASSWORD ?? 'not-a-real-password',
  serial: (process.env.DIAGRAL_SERIAL ?? 'PROBE000000000').toUpperCase(),
  pinCode: process.env.DIAGRAL_PIN ?? '0000',
};

const client = new DiagralClient({ account, onKeys: async () => {} });

if (!real) {
  console.log('Made-up account: the sign-in must be refused.');
  const err = await client.login().then(
    () => null,
    (error) => error,
  );
  if (!err) {
    console.log('✗ UNEXPECTED: the made-up account was accepted');
    process.exit(1);
  }
  const ok = err.kind === 'auth';
  console.log(`${ok ? '✓ refused as expected' : '✗ not a refusal'}: ${err.kind} — ${err.message}`);
  process.exit(ok ? 0 : 1);
}

console.log('Real account, read-only for the alarm. The API key is deleted at the end.');
try {
  await step('API key created', () => client.createKey());
  const raw = await step('configuration', () => client.configuration());
  if (raw) {
    print('configuration shape', shape(raw));
    const configuration = parseConfiguration(raw);
    print('configuration (counts)', {
      groups: configuration.groups.length,
      partial1: configuration.partial1.length,
      partial2: configuration.partial2.length,
      presence: configuration.presence.length,
      devices: Object.fromEntries(
        Object.entries(configuration.devices).map(([k, v]) => [k, v.length]),
      ),
    });
    const status = await step('status', () => client.status());
    if (status) {
      print('status shape', shape(status));
      const parsed = parseStatus(status, configuration);
      print('status', { word: parsed.raw, state: parsed.state, groups: parsed.groups.length });
    }
    const anomalies = await step('anomalies', () => client.anomalies());
    print('anomalies shape', anomalies === null ? 'none (404)' : shape(anomalies));
    if (anomalies) {
      print(
        'anomaly names',
        parseAnomalies(anomalies, configuration).map((f) => [f.list, f.name, f.kind]),
      );
    }
    const webhook = await step('webhook subscription', () => client.webhook());
    print('webhook', webhook === null ? 'none (404)' : shape(webhook));
  }
} finally {
  await step('API key deleted', () => client.deleteKey());
}
