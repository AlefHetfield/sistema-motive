import { randomUUID } from 'node:crypto';

const ACTIVE = new Set(['running', 'waiting', 'paused']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const instant = value => value ? new Date(value).getTime() : 0;
const ids = value => Array.isArray(value) ? value : [];
const envNumber = (name, fallback, minimum) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
};

export function retryAfterMilliseconds(value, now = Date.now()) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const seconds = /^\d+$/.test(text) ? Number(text) : null;
  const delay = seconds === null ? Date.parse(text) - now : seconds * 1000;
  return Number.isFinite(delay) && Number.isFinite(new Date(now + Math.max(0, delay)).getTime()) ? Math.max(0, delay) : null;
}

// A single persisted row coordinates every browser/user and every API instance.
// External HTTP runs outside the transaction; only its current lease can commit.
export function createPropertyListingRefresh(prisma, {
  preview, propertyData, now = () => Date.now(), coordinatorId = 1,
  intervalMs = envNumber('PROPERTY_LISTING_REFRESH_INTERVAL_MS', 2000, 250),
  backoffMs = envNumber('PROPERTY_LISTING_REFRESH_BACKOFF_MS', 30000, 1000),
  maxBackoffMs = 300000, maxAttempts = 3, leaseMs = 30000,
} = {}) {
  const snapshot = row => row?.runId ? {
    id: row.runId, status: row.status, total: row.total,
    processed: ids(row.updatedIds).length + ids(row.failed).length,
    updatedCount: ids(row.updatedIds).length, failed: ids(row.failed),
    pendingCount: ids(row.pendingIds).length,
    nextAttemptAt: instant(row.leaseUntil) > now() && row.status === 'running'
      ? new Date(Math.max(instant(row.nextAttemptAt), Math.min(instant(row.leaseUntil), now() + 2000))).toISOString()
      : row.nextAttemptAt?.toISOString() || null,
    delayReason: instant(row.leaseUntil) > now() && row.status === 'running' ? 'lease' : row.delayReason || null,
    message: row.message, retryAttempt: row.retryAttempt, maxAttempts,
  } : null;

  const locked = operation => prisma.$transaction(async tx => {
    await tx.propertyListingRefresh.upsert({ where: { id: coordinatorId }, create: { id: coordinatorId }, update: {} });
    await tx.$queryRaw`SELECT "id" FROM "property_listing_refresh" WHERE "id" = ${coordinatorId} FOR UPDATE`;
    const row = await tx.propertyListingRefresh.findUnique({ where: { id: coordinatorId } });
    return operation(tx, row);
  });
  const save = (tx, data) => tx.propertyListingRefresh.update({ where: { id: coordinatorId }, data });
  const current = async () => ({ job: snapshot(await prisma.propertyListingRefresh.findUnique({ where: { id: coordinatorId } })), updated: [] });
  const ownsLease = (row, claim) => row.runId === claim.runId && row.leaseToken === claim.leaseToken
    && instant(row.leaseUntil) > now() && ACTIVE.has(row.status);
  const delayFor = (error, attempt) => Math.max(intervalMs,
    Math.min(maxBackoffMs, backoffMs * 2 ** Math.min(attempt - 1, 20)),
    retryAfterMilliseconds(error.retryAfter, now()) ?? 0);

  async function start() {
    return locked(async (tx, row) => {
      if (ACTIVE.has(row.status)) return { job: snapshot(row), updated: [] };
      const candidates = await tx.property.findMany({
        where: { sourceUrl: { contains: 'motiveimoveis.com', mode: 'insensitive' } },
        orderBy: { id: 'asc' }, select: { id: true },
      });
      // Neither cancelling nor a fresh run is allowed to bypass the site's wait.
      const next = Math.max(now(), instant(row.nextAttemptAt), instant(row.leaseUntil));
      const waiting = next > now() && ['rate_limit', 'connection'].includes(row.delayReason);
      const updated = await save(tx, {
        runId: randomUUID(), status: candidates.length ? (waiting ? 'waiting' : 'running') : 'completed', total: candidates.length,
        pendingIds: candidates.map(property => property.id), updatedIds: [], failed: [], retryAttempt: 0,
        nextAttemptAt: candidates.length ? new Date(next) : row.nextAttemptAt,
        delayReason: candidates.length ? (waiting ? row.delayReason : 'interval') : row.delayReason,
        leaseToken: null, leaseUntil: row.leaseUntil, message: candidates.length ? '' : 'Nenhum imóvel com link do site para atualizar.',
      });
      return { job: snapshot(updated), updated: [] };
    });
  }

  async function control(action, jobId) {
    return locked(async (tx, row) => {
      if (!row.runId || row.runId !== jobId) return { job: snapshot(row), updated: [] };
      if (action === 'cancel') {
        if (!ACTIVE.has(row.status)) return { job: snapshot(row), updated: [] };
        return { job: snapshot(await save(tx, { status: 'cancelled', leaseToken: null, message: 'Atualização cancelada. As alterações já salvas foram mantidas.' })), updated: [] };
      }
      if (!['paused', 'cancelled'].includes(row.status) || !ids(row.pendingIds).length || instant(row.nextAttemptAt) > now()) return { job: snapshot(row), updated: [] };
      return { job: snapshot(await save(tx, { status: 'running', retryAttempt: 0, message: '', delayReason: 'interval', nextAttemptAt: new Date(Math.max(now(), instant(row.leaseUntil))) })), updated: [] };
    });
  }

  async function step(jobId) {
    const claim = await locked(async (tx, row) => {
      if (row.runId !== jobId || !['running', 'waiting'].includes(row.status)) return { result: { job: snapshot(row), updated: [] } };
      if (instant(row.leaseUntil) > now() || instant(row.nextAttemptAt) > now()) return { result: { job: snapshot(row), updated: [] } };
      const propertyId = ids(row.pendingIds)[0];
      if (!propertyId) return { result: { job: snapshot(await save(tx, { status: 'completed', message: '' })), updated: [] } };
      const leaseToken = randomUUID();
      await save(tx, { leaseToken, leaseUntil: new Date(now() + leaseMs), status: 'running', message: '' });
      const property = await tx.property.findUnique({ where: { id: propertyId } });
      return { runId: row.runId, leaseToken, propertyId, property };
    });
    if (claim.result) return claim.result;

    let previewResult;
    let listingFailure;
    try {
      if (!claim.property) throw fail('O imóvel foi removido durante a atualização.', 404);
      previewResult = await preview(claim.property.sourceUrl);
    } catch (error) { listingFailure = error; }

    try {
      return await locked(async (tx, row) => {
        if (!ownsLease(row, claim)) {
          // Even a cancelled/replaced request can teach us that the HOST is
          // throttled. Keep that wait globally without accepting stale data.
          if (listingFailure?.upstreamStatus === 429) {
            const next = new Date(Math.max(instant(row.nextAttemptAt), now() + delayFor(listingFailure, 1)));
            const active = ['running', 'waiting'].includes(row.status);
            row = await save(tx, {
              nextAttemptAt: next, delayReason: 'rate_limit',
              ...(active ? { status: 'waiting', message: 'O site limitou temporariamente as consultas. A atualização será retomada automaticamente.' } : {}),
            });
          }
          return { job: snapshot(row), updated: [] };
        }
        const release = { leaseToken: null, leaseUntil: null };
        if (listingFailure?.kind === 'connection') {
          const attempt = row.retryAttempt + 1;
          const delay = delayFor(listingFailure, attempt);
          const paused = attempt >= maxAttempts || [401, 403].includes(listingFailure.upstreamStatus);
          const next = new Date(now() + delay);
          const updated = await save(tx, {
            ...release, status: paused ? 'paused' : 'waiting', retryAttempt: attempt, nextAttemptAt: next,
            delayReason: listingFailure.upstreamStatus === 429 ? 'rate_limit' : 'connection',
            message: listingFailure.upstreamStatus === 429
              ? (paused ? 'O site continua limitando as consultas. O progresso foi salvo; retome após o período de espera.' : 'O site limitou temporariamente as consultas. A atualização será retomada automaticamente.')
              : (paused ? 'Não foi possível consultar o site após as tentativas. O progresso foi salvo para retomar.' : 'O site não respondeu. Uma nova tentativa será feita automaticamente.'),
          });
          return { job: snapshot(updated), updated: [] };
        }

        // Serialize against manual property edits before checking the link.
        await tx.$queryRaw`SELECT "id" FROM "properties" WHERE "id" = ${claim.propertyId} FOR UPDATE`;
        const latest = await tx.property.findUnique({ where: { id: claim.propertyId } });
        if (latest && latest.sourceUrl !== claim.property?.sourceUrl) {
          const updated = await save(tx, { ...release, status: 'running', message: '', delayReason: 'interval', retryAttempt: 0, nextAttemptAt: new Date(now() + intervalMs) });
          return { job: snapshot(updated), updated: [] };
        }
        const pending = ids(row.pendingIds).filter(id => id !== claim.propertyId);
        const finished = pending.length === 0;
        const bookkeeping = {
          ...release, pendingIds: pending, retryAttempt: 0, message: '',
          status: finished ? 'completed' : 'running', nextAttemptAt: new Date(now() + intervalMs),
          delayReason: finished ? null : 'interval',
        };
        if (listingFailure) {
          const failure = { id: claim.propertyId, code: claim.property?.code || null, title: claim.property?.title || 'Imóvel removido', error: listingFailure.message || 'Não foi possível ler o anúncio.' };
          const updated = await save(tx, { ...bookkeeping, failed: [...ids(row.failed), failure] });
          return { job: snapshot(updated), updated: [] };
        }

        // Preserve manual fields against edits made while the HTTP request ran.
        if (!latest) {
          const failure = { id: claim.propertyId, code: claim.property?.code || null, title: claim.property?.title || 'Imóvel removido', error: 'O imóvel foi removido durante a atualização.' };
          const updated = await save(tx, { ...bookkeeping, failed: [...ids(row.failed), failure] });
          return { job: snapshot(updated), updated: [] };
        }
        const property = await tx.property.update({ where: { id: claim.propertyId }, data: propertyData(previewResult, latest) });
        const updated = await save(tx, { ...bookkeeping, updatedIds: [...ids(row.updatedIds), property.id] });
        return { job: snapshot(updated), updated: [property] };
      });
    } catch (error) {
      console.error('Falha ao salvar progresso da atualização de imóveis:', error.code || error.name);
      // A failed property write must not consume its pending ID or masquerade as
      // a problem with that listing. The previous transaction rolled back.
      return locked(async (tx, row) => {
        if (!ownsLease(row, claim)) return { job: snapshot(row), updated: [] };
        const updated = await save(tx, {
          status: 'paused', leaseToken: null, leaseUntil: null, delayReason: 'storage',
          nextAttemptAt: new Date(now() + intervalMs),
          message: 'Não foi possível salvar a atualização. O progresso foi mantido; tente retomar em instantes.',
        });
        return { job: snapshot(updated), updated: [] };
      });
    }
  }

  return {
    current,
    async action(action, jobId) {
      if (!['start', 'step', 'resume', 'cancel'].includes(action)) throw fail('Ação de atualização inválida.');
      if (action === 'start') return start();
      if (typeof jobId !== 'string' || !jobId || jobId.length > 80) throw fail('Informe a atualização a continuar.');
      if (action === 'step') return step(jobId);
      return control(action, jobId);
    },
  };
}
