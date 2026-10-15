# Diagral fixtures

Answers of the Diagral e-ONE cloud API (`https://appv3.tt-monitor.com/emerald/v1`) and
notifications of its webhook, as the tests of the integration replay them.

Their **shapes** (keys, nesting, value types, status words such as `OFF`, `GROUP`,
`TEMPO_GROUP`, `PRESENCE`, anomaly names such as `powerSupplyAlert`) follow the models and the
tests of [pydiagral](https://github.com/mguyard/pydiagral) and the documentation of its
[Home Assistant integration](https://github.com/mguyard/hass-diagral), by Marc Guyard. Both are
GPL-3.0: they were read to learn the protocol, nothing was copied from them.

Every **value** is made up: names, labels, serial numbers, keys, tokens, user names and dates.
No answer comes from a real installation.

| File                          | Request                                               |
| ----------------------------- | ----------------------------------------------------- |
| `login.json`                  | `POST users/authenticate/login?vendor=DIAGRAL`        |
| `api-key.json`                | `POST users/api_key`                                  |
| `configuration.json`          | `GET systems/<serial>/configurations`                 |
| `status-*.json`               | `GET systems/<serial>/status`, answer of the commands |
| `anomalies.json`              | `GET systems/<serial>/anomalies`                      |
| `webhook-subscription.json`   | `GET webhooks/<serial>/subscription`                  |
| `webhook-*.json` (the others) | bodies posted by Diagral to the webhook address       |
