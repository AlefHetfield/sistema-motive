import { Prisma } from '@prisma/client';

export function attachStatusSince(clients, transitions) {
  const byClient = new Map(transitions.map(event => [event.clientId, event]));
  return clients.map(client => {
    const event = byClient.get(client.id);
    const statusSince = event && event.statusDepois === client.status
      ? (event.action === 'created' ? client.createdAt : event.createdAt)
      : null;
    return { ...client, statusSince };
  });
}

// Uma consulta para toda a lista; alterações de outros campos não reiniciam a etapa.
export async function withClientStatusSince(prisma, clients) {
  if (!clients.length) return [];
  const transitions = await prisma.$queryRaw`
    SELECT DISTINCT ON ("clientId") "clientId", "action", "statusDepois", "createdAt"
    FROM "activity_logs"
    WHERE "clientId" IN (${Prisma.join(clients.map(client => client.id))})
      AND ("action" = 'created' OR "statusAntes" IS DISTINCT FROM "statusDepois")
    ORDER BY "clientId", "createdAt" DESC, "id" DESC
  `;
  return attachStatusSince(clients, transitions);
}
