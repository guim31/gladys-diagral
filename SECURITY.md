# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes. In
particular:

- **Secrets**: the e-mail address, the password and the access code of the
  alarm live in the Gladys configuration (password and code as secret fields).
  The password only travels to Diagral to create an API key; the access code
  goes with every read of the state and every command, as the Diagral API
  requires. None of them, nor the API key, its secret, a token, a signature
  or the webhook address, is ever written to the logs.
- **`/data`**: one file, `diagral-state.json`, mode 0600, written atomically:
  the API key the integration created and its secret, the account and box
  they belong to, and for the webhook a SHA-256 of its address (the address
  holds the Gladys Plus Open API key, it is not kept) with the transmitter id
  Diagral returned. Whoever reads this file and knows the access code can
  read and command the alarm through the API until the key is renewed
  ("Renew the API key") or revoked.
- **Network**: HTTPS to the Diagral cloud only (`appv3.tt-monitor.com`).
  Webhook events come through the Gladys Plus relay; their address is the
  secret (Diagral does not sign them). The integration only accepts events of
  the transmitter of the box, takes each one once, and treats arming and
  fault events as a reason to read the API, never as data.
- **Commands**: arming and disarming from Gladys are off by default; the alarm
  state is read-only, so no voice assistant or generic device command can
  change it, and disarming from the widget asks for a confirmation.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
the Diagral cloud, apps, firmware and devices (report those to Diagral).
