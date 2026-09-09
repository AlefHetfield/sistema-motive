export function migrationDatabaseUrl(env) {
  const explicit = env.DIRECT_URL || env.DATABASE_URL_UNPOOLED;
  if (explicit) return explicit;
  if (!env.DATABASE_URL) return undefined;
  const url = new URL(env.DATABASE_URL);
  // Neon's direct endpoint is the same endpoint without the -pooler suffix.
  // Leave other providers and local databases untouched.
  if (url.hostname.endsWith('.neon.tech') && /^ep-[a-z0-9-]+-pooler\./i.test(url.hostname)) {
    url.hostname = url.hostname.replace('-pooler.', '.');
    url.searchParams.delete('pgbouncer');
    return url.toString();
  }
  return env.DATABASE_URL;
}
