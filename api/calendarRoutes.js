import express from 'express';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  googleCalendarIsConfigured,
  listCalendarEvents,
  updateCalendarEvent,
} from './googleCalendar.js';

const validDate = value => value && Number.isFinite(new Date(value).getTime());

const normalizeInput = body => ({
  title: String(body?.title || '').trim(),
  description: String(body?.description || '').trim(),
  location: String(body?.location || '').trim(),
  start: body?.start,
  end: body?.end,
  reminderMinutes: Math.max(0, Math.min(40320, Number(body?.reminderMinutes) || 30)),
  propertyId: body?.propertyId ? Number(body.propertyId) : null,
  clientName: String(body?.clientName || '').trim().slice(0, 120),
  brokerName: String(body?.brokerName || '').trim().slice(0, 120),
  allDay: Boolean(body?.allDay),
});

const validateEvent = input => {
  if (!input.title) return 'Informe o título do compromisso.';
  if (!validDate(input.start) || !validDate(input.end)) return 'Informe uma data e horários válidos.';
  if (new Date(input.end) <= new Date(input.start)) return 'O horário final deve ser posterior ao início.';
  return '';
};

export function createCalendarRouter(requireAuth) {
  const router = express.Router();
  router.use(requireAuth);
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });

  router.get('/status', (_req, res) => {
    res.json({ configured: googleCalendarIsConfigured(), timeZone: 'America/Sao_Paulo' });
  });

  router.get('/events', async (req, res) => {
    try {
      if (!googleCalendarIsConfigured()) return res.status(503).json({ error: 'Configure a integração com o Google Calendar no servidor.' });
      const { timeMin, timeMax } = req.query;
      if (!validDate(timeMin) || !validDate(timeMax) || new Date(timeMax) <= new Date(timeMin)) {
        return res.status(400).json({ error: 'Período da agenda inválido.' });
      }
      if (new Date(timeMax) - new Date(timeMin) > 370 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: 'Consulte no máximo um ano por vez.' });
      }
      res.json({ events: await listCalendarEvents({ timeMin, timeMax }) });
    } catch (error) {
      console.error('[CALENDAR] Erro ao listar eventos:', error);
      res.status(error.status || 500).json({ error: error.message || 'Falha ao carregar a agenda.' });
    }
  });

  router.post('/events', async (req, res) => {
    try {
      const input = normalizeInput(req.body);
      const validationError = validateEvent(input);
      if (validationError) return res.status(400).json({ error: validationError });
      res.status(201).json(await createCalendarEvent(input));
    } catch (error) {
      console.error('[CALENDAR] Erro ao criar evento:', error);
      res.status(error.status || 500).json({ error: error.message || 'Falha ao criar o compromisso.' });
    }
  });

  router.patch('/events/:eventId', async (req, res) => {
    try {
      const input = normalizeInput(req.body);
      const validationError = validateEvent(input);
      if (validationError) return res.status(400).json({ error: validationError });
      res.json(await updateCalendarEvent(req.params.eventId, input));
    } catch (error) {
      console.error('[CALENDAR] Erro ao atualizar evento:', error);
      res.status(error.status || 500).json({ error: error.message || 'Falha ao atualizar o compromisso.' });
    }
  });

  router.delete('/events/:eventId', async (req, res) => {
    try {
      await deleteCalendarEvent(req.params.eventId);
      res.status(204).end();
    } catch (error) {
      console.error('[CALENDAR] Erro ao excluir evento:', error);
      res.status(error.status || 500).json({ error: error.message || 'Falha ao excluir o compromisso.' });
    }
  });

  return router;
}
