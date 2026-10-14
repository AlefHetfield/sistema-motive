import { taskToday } from './taskDates.js';

export const STALLED_CLIENT_DAYS = 7;
const FINAL_STATUSES = ['Assinado-Movido', 'Assinado', 'Arquivado'];

export function daysInClientStatus(client, now = new Date()) {
  if (!client.status || !client.statusSince) return null;
  const since = new Date(client.statusSince);
  if (Number.isNaN(since.getTime()) || since > now) return null;
  const today = Date.parse(`${taskToday(now)}T00:00:00Z`);
  const start = Date.parse(`${taskToday(since)}T00:00:00Z`);
  return Math.max(0, Math.round((today - start) / 86400000));
}

export function isStalledClient(client, now = new Date()) {
  const days = daysInClientStatus(client, now);
  return !client.emEspera && !FINAL_STATUSES.includes(client.status)
    && days !== null && days >= STALLED_CLIENT_DAYS;
}
