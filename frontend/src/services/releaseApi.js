import { API_BASE_URL } from '../config/api';

export async function releaseApi(path = '', { method = 'GET', body, signal, expectedUserId } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/releases${path}`, {
    method,
    credentials: 'include',
    signal,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(expectedUserId ? { 'X-Release-User': String(expectedUserId) } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if ((response.status === 401 || data.code === 'SESSION_CHANGED') && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('motive:preserve-note-draft'));
      window.dispatchEvent(new Event('motive:unauthorized'));
    }
    throw Object.assign(new Error(data.error || 'Não foi possível consultar as novidades.'), { status: response.status, code: data.code });
  }
  return response.status === 204 ? null : response.json();
}
