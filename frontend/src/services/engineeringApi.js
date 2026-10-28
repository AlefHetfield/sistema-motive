import { API_BASE_URL } from '../config/api';

export async function engineeringApi(path = '', { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/engineerings${path}`, {
    method, credentials: 'include', signal,
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('motive:preserve-note-draft'));
      window.dispatchEvent(new Event('motive:unauthorized'));
    }
    throw Object.assign(new Error(data.error || 'Não foi possível acessar as engenharias.'), { status: response.status });
  }
  return response.status === 204 ? null : response.json();
}
