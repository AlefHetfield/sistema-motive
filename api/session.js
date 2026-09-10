import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? randomBytes(32).toString('hex') : '');
if (!secret) throw new Error('Configure SESSION_SECRET para assinar as sessões.');
const signature = value => createHmac('sha256', secret).update(value).digest('base64url');
export function encodeSession(payload) {
  const value = Buffer.from(JSON.stringify({ ...payload, expiresAt: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${value}.${signature(value)}`;
}
export function decodeSession(raw) {
  if (typeof raw !== 'string') return null;
  const [value, signed, extra] = raw.split('.');
  if (!value || !signed || extra) return null;
  const expected = Buffer.from(signature(value));
  const supplied = Buffer.from(signed);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const session = JSON.parse(Buffer.from(value, 'base64url').toString());
    return Number.isInteger(session.id) && session.id > 0 && session.expiresAt > Date.now() ? session : null;
  } catch { return null; }
}
