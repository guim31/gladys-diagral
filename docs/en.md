# Diagral e-ONE

## Overview

This integration links your **Diagral e-ONE** alarm to Gladys through the Diagral cloud, the one the
Diagral e-ONE app of your phone uses. Gladys sees:

- the **alarm state**: Disarmed, Exit delay, Fully armed, Partially armed, Presence mode;
- the **armed groups**, with the names given at installation;
- the **faults** of the detectors, keypads, remote controls, sirens and control panel: low batteries,
  tamper protection (a case opened or torn off), radio or transmission link fault;
- with **Gladys Plus**, the **alarms** in real time (intrusion, panic, fire, technical alarm).

Gladys can also **arm or disarm the alarm** from a widget or a scene, but only if you allow it: by
default, Gladys only shows the state.

Developed without the hardware: feedback welcome on
[github.com/guim31/gladys-diagral/issues](https://github.com/guim31/gladys-diagral/issues). This
integration is not affiliated with Diagral or Hager.

## Prerequisites

- A Diagral e-ONE alarm connected to the Internet by its **box**: a DIAG56AAX box (no longer sold), or
  the box built into a DIAG99AGX control panel. If the Diagral e-ONE app controls your alarm remotely,
  you are set.
- The **account of the Diagral e-ONE app**: e-mail address and password.
- The **serial number of the box**: 14 characters, on the label with a QR code **inside** the box. You
  have to open its cover (see the manual of the box).
- The **access code** you type in the app to see and control the alarm: the master code or a user
  code.
- Gladys 5.1 or later. For alarms in real time: a **Gladys Plus** subscription.

## Configuration

In Gladys, open **Integrations**, install **Diagral e-ONE** ("Install from GitHub" if it is not in the
catalog yet), then open its **Configuration** screen.

### Diagral account

- **E-mail address** and **Password**: those of the Diagral e-ONE app.
- **Serial number of the box**: the 14 characters of the label. Capitals, spaces and dashes do not
  matter.
- **Access code of the alarm**: Diagral asks for it at every read of the state, not only for the
  commands.

At the first connection, the integration creates an **API key** on the Diagral cloud, as the Home
Assistant integration does. Then every read uses this key: the password only goes back to Diagral to
create a new key.

### Arming from Gladys

- **Off (state only)**, the default: Gladys shows the state of the alarm, never changes it.
- **Arm only**: the widget and the scenes can arm the alarm, never disarm it.
- **Arm and disarm**: anyone using your dashboards and scenes can also disarm the alarm.

In every case, the alarm is **never driven like a switch, nor by voice**: its state is a read-only
feature. Disarming from the widget asks for a confirmation.

### Reading of the alarm

**Reading of the alarm** sets how often the state and the faults are read: every minute, 2 minutes,
**5 minutes** (the default, as Home Assistant) or 10 minutes. Each read makes two requests to the
Diagral cloud (state and faults); the configuration of the alarm (names, groups) is read again every
6 hours only. Diagral publishes no quota: stay reasonable. If Diagral asks to slow down, the reads
stop for one minute, then two, and so on up to two hours.

During an exit delay, the alarm is read every 30 seconds until it is armed.

### Language

**Language of the names and texts**: the language of the feature names and of the fault texts
(French by default). Gladys keeps the names chosen when the device is added.

### Gladys Plus webhook (real time)

The Diagral cloud can tell an event through a **webhook**: alarm, arming or disarming, new fault. As
Gladys is at your home, this webhook goes through **Gladys Plus**.

> **Warning: Diagral keeps only one webhook per box.** If Home Assistant, Jeedom or another software
> already receives the events of your alarm, ticking the option below replaces it: that other
> software will no longer receive anything from Diagral.

This is why the option **Real-time alarms (replaces another webhook)** is **off by default**. As long
as it is off, Gladys never reads, changes nor deletes the webhook of your box. To turn it on:

1. In Gladys Plus, create an Open API key (Settings → Open API).
2. Paste it in the "Gladys Plus webhooks" block of the Configuration screen of the integration: it
   lists "Diagral events (alarms, armings, faults)".
3. Tick **Real-time alarms (replaces another webhook)**: the integration registers the address at
   Diagral.

Untick the option or remove the key: the integration deletes its webhook at Diagral, but only if it is
still its own. The webhook of another software is never deleted.

**Without the option**, what stays and what is lost: the Diagral API has no event history. The state,
the armed groups and the faults are still read at the chosen pace (5 minutes by default), and the
arming and fault triggers work, with that delay. But an **alarm** is never seen: "Alarm in progress"
has no value and the trigger "Diagral alarm triggered" never fires. "Changed by" stays empty.

### Actions

- **Test the connection**: reads the state and the faults of the alarm and sums them up. Nothing is
  armed or disarmed.
- **Renew the API key**: creates a new API key on the Diagral cloud and deletes the previous one.
  Useful if you think it leaked, or if Diagral refuses it.

## The device

Once connected, the **Discover** tab offers a **Diagral alarm** device (followed by the name of your
alarm). Its features, all read-only:

- **Alarm state**: Disarmed, Exit delay, Fully armed, Partially armed, Presence mode. Fully armed arms
  every group; an arming with part of the groups is a partial one.
- **Alarm in progress**: 1 as soon as Diagral reports an alarm, until the alarm is disarmed. Only with
  the Gladys Plus webhook: without it, this feature has no value, as nothing can tell it.
- **Armed groups**: the names of the armed groups, or "None".
- **Faults**: the current faults, for example "(2) Porte garage: low batteries, Control panel:
  tamper".
- **Number of faults**: the same count, for the scenes.
- **Low batteries**: 1 when a device of the alarm reports low batteries or a power fault.
- **Tamper protection**: 1 when a device reports a tamper (case opened or torn off).
- **Link fault**: 1 when a device reports a radio or transmission link fault (GSM, phone line,
  Internet).
- **Diagral cloud**: 0 when the Diagral cloud no longer answers.

## The widget

The **Diagral alarm** widget shows the state of the alarm ("ALARM IN PROGRESS" in red during an
alarm), the armed groups and the faults. Depending on **Arming from Gladys**, it offers up to four
buttons: **Arm fully**, **Partial 1** (or **Partial 2** if your alarm has no partial 1), **Presence**
and **Disarm**, which asks for a confirmation. The current mode is marked with a tick.

## Scene triggers

- **Diagral alarm triggered**: the alarm went off. Filter: the kind of alarm (Intrusion, Panic, Fire,
  Technical (water, temperature…), Other). Variables: the kind of alarm, the detector, the group and
  the Diagral code. Needs the Gladys Plus webhook. An alarm received more than 15 minutes late fires
  nothing.
- **Diagral armed or disarmed**: the alarm changed mode, from a keypad, a remote control, the app or
  Gladys. Filter: the new mode (Disarmed, Fully armed, Partially armed, Presence mode). Variables: the
  new mode and "Changed by" (the name of the user when Diagral gives it through the webhook, "Gladys"
  for a command of Gladys). The end of an exit delay is the arming.
- **Diagral fault reported**: a new fault appeared. Filter: the kind of fault (Batteries or power,
  Tamper protection, Radio or transmission link, Other). Variables: the kind of fault, the device and
  the fault in words.

The faults already there when the integration starts fire nothing.

## Scene action

**Arm or disarm Diagral**, as far as "Arming from Gladys" allows:

- **Command**: Disarm, Arm fully, Presence, Partial 1, Partial 2 or Chosen groups;
- **Groups**: for "Chosen groups" only, the numbers of the groups separated by commas, for example
  `1,3`.

Output: "State after the command", most of the time an exit delay right after an arming.

## Scene examples

- **Intrusion**: trigger "Diagral alarm triggered", kind Intrusion → turn on every light, send a
  message "Intrusion detected by {{triggerEvent.data.device}}" and the picture of the entrance camera.
- **Leaving home**: when the last member of the family leaves home → action "Arm or disarm Diagral",
  command Arm fully ("Arm only" at least is needed).
- **Batteries to change**: trigger "Diagral fault reported", kind Batteries or power → message
  "Batteries to change: {{triggerEvent.data.fault}}".
- **Night**: trigger "Diagral armed or disarmed", mode Presence mode → lower the heating and turn off
  the television.

## Troubleshooting

- **"Diagral refused the e-mail address or the password"**: check them in the Diagral e-ONE app. The
  integration does not try again until the configuration changes, so as not to lock your account.
- **"Diagral refused the serial number of the box or the access code"**: check the 14 characters of
  the label and the code. A scan in the Discover tab tries again.
- **"The Diagral cloud does not answer"**: the integration keeps trying and writes it once in the
  logs. Does the Diagral e-ONE app work?
- **Nothing in real time**: is the option "Real-time alarms" ticked? Check also the Open API key in the "Gladys Plus webhooks" block. Another tool
  may have taken the webhook of your box back: Diagral keeps only one.
- **More details**: set the variable `LOG_LEVEL=debug`. The logs never hold the password, the code,
  the API key nor the webhook address.

## Limits

- Developed **without the hardware nor a Diagral account**: the connection to the real cloud could
  not be tried. The answers of the API come from the pydiagral library and the Home Assistant
  integration by Marc Guyard. Your feedback is precious.
- The Diagral cloud has no event history: alarms only arrive through the webhook (Gladys Plus),
  armings and faults also through the reads.
- Who armed or disarmed ("Changed by") is only known with the webhook.
- One webhook per box at Diagral: Gladys and another tool cannot use it at the same time.
- The detectors are not separate devices: the API does not give their state (door open, motion), only
  their faults.
- A security alarm stays your responsibility: do not rely on Gladys alone to be told of an intrusion.

## Data and security

- The password and the access code stay in the Gladys configuration. The API key and its secret are
  in `/data/diagral-state.json`, readable by the container only. The webhook address is not kept (only
  its fingerprint), as it holds your Open API key.
- The integration only talks to the Diagral cloud (`appv3.tt-monitor.com`) and to Gladys.
- A webhook event is only accepted from the transmitter of your box; armings and faults are always
  read again from the API before being shown.
