# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Changed

- The real-time webhook is now an option, "Real-time alarms (replaces another webhook)", off by
  default: Diagral keeps one webhook per box, and registering Gladys' replaced the one of Home
  Assistant, Jeedom or any other software. Off, the integration never reads, changes nor deletes the
  webhook of the box, and only ever deletes its own.

### Added

- Connection to the Diagral e-ONE cloud with the account of the Diagral e-ONE app, the serial number
  of the box and the access code of the alarm. The integration creates its own API key and keeps it
  in `/data`. "Test the connection" and "Renew the API key" actions.
- One device per alarm: alarm state (disarmed, exit delay, fully armed, partially armed, presence
  mode), alarm in progress, armed groups, faults and their number, low batteries, tamper protection,
  link fault, Diagral cloud reachable.
- Alarms, armings and faults in real time through the Gladys Plus webhook, registered at Diagral by
  the integration; reads of the cloud on the integration's own timer (1 to 10 minutes, 5 by
  default).
- Scene triggers "Diagral alarm triggered", "Diagral armed or disarmed" and "Diagral fault reported";
  scene action "Arm or disarm Diagral" (fully, presence, partial 1 or 2, chosen groups, disarm).
- The "Diagral alarm" dashboard widget, with the arming buttons the configuration allows.
- "Arming from Gladys": off (default), arm only, or arm and disarm.
- English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-diagral/commits/main
