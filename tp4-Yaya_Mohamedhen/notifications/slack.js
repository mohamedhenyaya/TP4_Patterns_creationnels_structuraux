// Nouveau canal ajouté SANS modifier channels.js : il suffit d'importer ce module.
import { Channel, registerChannel } from './channels.js';

export class SlackChannel extends Channel {
  send({ to, body }) {
    return `[SLACK #${to}] ${body}`;
  }
}

registerChannel('slack', SlackChannel);
