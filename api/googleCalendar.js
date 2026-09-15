import crypto from 'crypto';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
let cachedToken = null;

const base64Url = value => Buffer.from(value).toString('base64url');

const calendarCredentials = () => ({
  email: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
  privateKey: (process.env.GOOGLE_CALENDAR_PRIVATE_KEY || process.env.GOOGLE_DRIVE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
  calendarId: process.env.GOOGLE_CALENDAR_ID,
});

export const googleCalendarIsConfigured = () => {
  const { email, privateKey, calendarId } = calendarCredentials();
  return Boolean(email && privateKey && calendarId);
};

const serviceAccountToken = async () => {
  const { email, privateKey } = calendarCredentials();
  if (!email || !privateKey) {
    const error = new Error('Configure as credenciais da conta de serviço do Google Calendar.');
    error.status = 503;
    throw error;
  }
  if (cachedToken?.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: email,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) {
    const error = new Error(result.error_description || 'Não foi possível autenticar no Google Calendar.');
    error.status = 502;
    throw error;
  }
  cachedToken = { value: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return cachedToken.value;
};

const calendarRequest = async (path, { method = 'GET', params = {}, body } = {}) => {
  const { calendarId } = calendarCredentials();
  if (!calendarId) {
    const error = new Error('Configure GOOGLE_CALENDAR_ID no servidor.');
    error.status = 503;
    throw error;
  }
  const url = new URL(`${CALENDAR_API}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const token = await serviceAccountToken();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const googleMessage = result.error?.message;
    const message = response.status === 404
      ? 'Calendário não encontrado. Confira o ID e compartilhe a agenda com a conta de serviço.'
      : response.status === 403
        ? 'A conta de serviço não tem permissão para acessar ou alterar este calendário.'
        : googleMessage || 'Não foi possível acessar o Google Calendar.';
    const error = new Error(message);
    error.status = response.status >= 400 && response.status < 500 ? 422 : 502;
    throw error;
  }
  return result;
};

const calendarPath = suffix => {
  const { calendarId } = calendarCredentials();
  return `calendars/${encodeURIComponent(calendarId)}/${suffix}`;
};

const normalizeEvent = event => ({
  id: event.id,
  title: event.summary || 'Sem título',
  description: event.description || '',
  location: event.location || '',
  start: event.start || {},
  end: event.end || {},
  status: event.status,
  htmlLink: event.htmlLink || '',
  recurringEventId: event.recurringEventId || null,
  propertyId: event.extendedProperties?.private?.propertyId || null,
  createdBySystem: event.extendedProperties?.private?.source === 'sistema-motive',
  creator: event.creator?.displayName || event.creator?.email || '',
  updatedAt: event.updated || null,
});

export const listCalendarEvents = async ({ timeMin, timeMax }) => {
  const result = await calendarRequest(calendarPath('events'), {
    params: {
      timeMin,
      timeMax,
      timeZone: DEFAULT_TIME_ZONE,
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: false,
      maxResults: 2500,
    },
  });
  return (result.items || []).map(normalizeEvent);
};

const buildEventPayload = input => {
  const timing = input.allDay
    ? { start: { date: input.start }, end: { date: input.end } }
    : {
        start: { dateTime: input.start, timeZone: DEFAULT_TIME_ZONE },
        end: { dateTime: input.end, timeZone: DEFAULT_TIME_ZONE },
      };
  return {
    summary: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    location: String(input.location || '').trim(),
    ...timing,
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: Number(input.reminderMinutes) || 30 }],
    },
    extendedProperties: {
      private: {
        source: 'sistema-motive',
        ...(input.propertyId ? { propertyId: String(input.propertyId) } : {}),
      },
    },
  };
};

export const createCalendarEvent = async input => normalizeEvent(await calendarRequest(calendarPath('events'), {
  method: 'POST',
  params: { sendUpdates: 'none' },
  body: buildEventPayload(input),
}));

export const updateCalendarEvent = async (eventId, input) => normalizeEvent(await calendarRequest(calendarPath(`events/${encodeURIComponent(eventId)}`), {
  method: 'PATCH',
  params: { sendUpdates: 'none' },
  body: buildEventPayload(input),
}));

export const deleteCalendarEvent = eventId => calendarRequest(calendarPath(`events/${encodeURIComponent(eventId)}`), {
  method: 'DELETE',
  params: { sendUpdates: 'none' },
});
