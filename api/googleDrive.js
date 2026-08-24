import crypto from 'crypto';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
let cachedToken = null;

const base64Url = value => Buffer.from(value).toString('base64url');

export const extractDriveFolderId = value => {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^[\w-]{10,}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (!/(^|\.)drive\.google\.com$/i.test(url.hostname)) return null;
    return url.pathname.match(/\/folders\/([\w-]+)/i)?.[1] || url.searchParams.get('id');
  } catch {
    return null;
  }
};

export const normalizeDriveFolderUrl = value => {
  const id = extractDriveFolderId(value);
  return id ? `https://drive.google.com/drive/folders/${id}` : null;
};

const serviceAccountToken = async () => {
  const email = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) return null;
  if (cachedToken?.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: email,
    scope: DRIVE_SCOPE,
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
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error('Não foi possível autenticar a integração com o Google Drive.');
  cachedToken = { value: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return cachedToken.value;
};

const driveRequest = async (path, params = {}) => {
  const url = new URL(`${DRIVE_API}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const token = await serviceAccountToken();
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (token) return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (apiKey) {
    url.searchParams.set('key', apiKey);
    return fetch(url);
  }
  const error = new Error('Configure a integração com o Google Drive no servidor.');
  error.status = 503;
  throw error;
};

export const listDriveFolderImages = async folderUrl => {
  const folderId = extractDriveFolderId(folderUrl);
  if (!folderId) {
    const error = new Error('Informe um link válido de pasta do Google Drive.');
    error.status = 400;
    throw error;
  }

  const files = [];
  let pageToken = '';
  do {
    const response = await driveRequest('files', {
      q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: 'nextPageToken,files(id,name,mimeType,size,imageMediaMetadata(width,height))',
      orderBy: 'name_natural',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      ...(pageToken ? { pageToken } : {}),
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error?.message || 'Não foi possível acessar a pasta de fotos do Google Drive.');
      error.status = response.status === 403 || response.status === 404 ? 422 : 502;
      throw error;
    }
    files.push(...(result.files || []));
    pageToken = result.nextPageToken || '';
  } while (pageToken && files.length < 2000);

  return files.slice(0, 2000);
};

export const fetchDriveImage = async fileId => {
  if (!/^[\w-]{10,}$/.test(String(fileId || ''))) {
    const error = new Error('Imagem do Google Drive inválida.');
    error.status = 400;
    throw error;
  }
  const response = await driveRequest(`files/${fileId}`, { alt: 'media', supportsAllDrives: 'true' });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const error = new Error(result.error?.message || 'Não foi possível carregar a foto do Google Drive.');
    error.status = response.status === 403 || response.status === 404 ? 404 : 502;
    throw error;
  }
  return response;
};
