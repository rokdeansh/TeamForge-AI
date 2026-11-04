import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';

export async function recordActivity({ workspace, actor, type, entityType, entity, recipients = [], details = {} }) {
  const [activity] = await Promise.all([
    Activity.create({ workspace, actor, type, entityType, entity, details }),
    ...[...new Set(recipients.map(String))].filter(id => id !== String(actor)).map(recipient => Notification.create({ recipient, workspace, actor, type, entityType, entity }))
  ]);
  return activity;
}
