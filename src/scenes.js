// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`), registered per key by src/app.js.
// Scene triggers need no handler: the hub fires them (src/hub.js TRIGGERS).
//
//   set_alarm_mode — arm (fully, presence, partial 1 or 2, chosen groups) or
//   disarm the Diagral alarm, as far as the configuration allows ("Arming
//   from Gladys"). Output: the state the alarm went to (an exit delay, most
//   of the time, right after an arming).
// -----------------------------------------------------------------------------

import { COMMANDS } from './diagral/model.js';
import { UserError } from './hub.js';
import { MESSAGES } from './texts.js';

export const SCENE_ACTIONS = {
  async set_alarm_mode(hub, { fields = {} }) {
    const command = String(fields.mode ?? '');
    if (!COMMANDS.includes(command)) throw new UserError(MESSAGES.failed);
    hub.checkDevice(fields.alarm || null);
    const { state } = await hub.setMode(command, { groups: fields.groups, origin: 'scene' });
    return { state };
  },
};
