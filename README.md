# Diagral e-ONE for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration for the **Diagral e-ONE** alarm (the
French alarm brand of the Hager group), through the Diagral cloud used by the Diagral e-ONE app: the
state of the alarm, its armed groups and faults, alarms in real time with Gladys Plus, and arming
from Gladys when you allow it.

> **Developed without the hardware: feedback welcome.** This integration was written from the code
> and the documentation of pydiagral and its Home Assistant integration, without a Diagral alarm nor
> account. Please report what works and what does not in the
> [issues](https://github.com/guim31/gladys-diagral/issues).
>
> Not affiliated with Diagral or Hager. Diagral and e-ONE are trademarks of their owners.

## Features

- **One device per alarm**: alarm state (disarmed, exit delay, fully armed, partially armed,
  presence mode), alarm in progress, armed groups, faults (text and number), low batteries, tamper
  protection, link fault, Diagral cloud reachable.
- **Real time with Gladys Plus**: the integration registers the Gladys Plus webhook at Diagral and
  receives alarms, armings and faults as they happen. Without Gladys Plus it reads the cloud on its
  own timer (1 to 10 minutes, 5 by default).
- **Scenes**: triggers "Diagral alarm triggered" (intrusion, panic, fire, technical), "Diagral armed
  or disarmed" (with who did it when Diagral says so), "Diagral fault reported" (batteries, tamper,
  link); action "Arm or disarm Diagral" (fully, presence, partial 1 or 2, chosen groups, disarm).
- **Dashboard widget**: state, armed groups, faults, and the arming buttons the configuration allows
  (disarm with confirmation).
- **Arming from Gladys is an option, off by default**: off, arm only, or arm and disarm. The alarm
  state is never a switch: no voice assistant can change it.
- Four languages: English, French, German, Spanish.

## Requirements

- A Diagral e-ONE alarm with its Internet **box** (DIAG56AAX, or the box built into a DIAG99AGX
  control panel), working with the Diagral e-ONE app.
- The e-mail address and password of the app, the 14-character **serial number** printed inside the
  box, and the **access code** of the alarm.
- Gladys Assistant **5.1.0** or later; a **Gladys Plus** subscription for alarms in real time.

## Installation

1. In Gladys, open **Integrations** → **Install from GitHub** and enter the address of this
   repository: `https://github.com/guim31/gladys-diagral` (or install **Diagral e-ONE** from the
   catalog once it is listed).
2. In **Configuration**, fill in the e-mail address, the password, the serial number of the box and
   the access code. Choose what Gladys may do in **Arming from Gladys** (off by default).
3. With Gladys Plus, paste an Open API key in the "Gladys Plus webhooks" block.
4. Open the **Discover** tab and add the alarm.

The user guide is in [`docs/en.md`](docs/en.md) (also in [French](docs/fr.md),
[German](docs/de.md) and [Spanish](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

- **API**: the "Emerald" API of the Diagral e-ONE app, `https://appv3.tt-monitor.com/emerald/v1`.
  The integration signs in once with the account to create an **API key** for the box (as pydiagral
  and Home Assistant do), keeps the key and its secret in `/data`, then signs every request with an
  HMAC-SHA256 of the key; the access code goes with the reads of the state and the commands. A key
  the cloud refuses is replaced once (the old one deleted); refused again, the reads stop until the
  configuration changes, so as not to lock the account.
- **Reads**: the state and the anomalies at each read (two requests), the configuration (names,
  groups, partial modes) every 6 hours; every 30 s during an exit delay. A 429 pauses the reads (1
  min, doubled up to 2 h). The integration refreshes itself (GladysAssistant/Gladys#3198), `onPoll`
  is a fallback.
- **Webhook**: Diagral keeps one webhook per box. When Gladys Plus offers its relay, the integration
  registers its address for alarms, states and anomalies (replacing another tool's), and deletes its
  own when the relay goes away. An alarm fires the scene trigger at once; arming and fault events only
  trigger a read (the API stays the reference). Events are taken once, only from the box's
  transmitter; an alarm more than 15 minutes late fires nothing.
- **States**: only the changes, plus a heartbeat every 6 hours.

## What could not be checked

- Everything against the real cloud: the session that wrote this integration could not reach
  `appv3.tt-monitor.com`, and has neither an alarm nor an account. The tests run on a fake cloud
  built from pydiagral's models, with made-up values. `scripts/probe.mjs` tries the real cloud: with
  no account, that a made-up one is refused; with an account, it reads the alarm (creating then
  deleting an API key) and prints the shape of every answer, never a value that identifies the home.
- The status words beyond those pydiagral tests (`OFF`, `GROUP`, `TEMPO_GROUP`, `TEMPO_1`,
  `TEMPO_2`, `PRESENCE`): an unknown one is logged once and the last state kept.
- The answer to a wrong access code (believed to be a 401 or 403), the format of the transmitter id
  of the webhook events (believed to be the serial of the box, checked against the subscription
  otherwise), the alarm codes (Contact ID, sorted as pydiagral does).
- The Gladys Plus webhook relay, end to end.

## Limitations

The Diagral cloud has no event history: alarms only arrive through the webhook, so "Alarm in
progress" and "Diagral alarm triggered" need Gladys Plus. The detectors are not devices of their own:
the API gives their faults, not their state. One webhook per box: Gladys and another tool cannot both
use it. No management of users, codes, automations (Diagral "rudes") or cameras.

## Development

```bash
npm install
npm test                # node --test, against the fake Gladys of the SDK and a fake Diagral cloud
npm run lint
npm run format:check
node scripts/probe.mjs  # the real cloud: a made-up account must be refused
```

Releases go through **Actions → Release**: it bumps the versions, moves the changelog section and
builds the image. A hand-pushed tag `vX.Y.Z` only builds the image and the GitHub Release: bump
`version` in `package.json` and in the manifest (with its `docker_image` tag) and commit before
tagging.

## Credits

- [mguyard/pydiagral](https://github.com/mguyard/pydiagral) and
  [mguyard/hass-diagral](https://github.com/mguyard/hass-diagral) by Marc Guyard (GPL-3.0): the
  endpoints, the API key and HMAC signature, the statuses, the anomalies, the webhook and its alarm
  codes. Read to learn the protocol; no code nor data was copied.
- The official [Diagral API documentation](https://appv3.tt-monitor.com/emerald/redoc) referenced by
  pydiagral.
- [guim31/gladys-simplisafe](https://github.com/guim31/gladys-simplisafe) for the structure of an
  alarm integration, built on [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
  from the official template.

## License

[Apache-2.0](LICENSE)
