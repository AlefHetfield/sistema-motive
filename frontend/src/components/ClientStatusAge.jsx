import { daysInClientStatus, isStalledClient } from '../utils/clientStatusAge';

export default function ClientStatusAge({ client }) {
  const days = daysInClientStatus(client);
  const stalled = isStalledClient(client);
  return (
    <p
      className={`mt-1 text-[11px] ${stalled ? 'font-semibold text-amber-700' : 'text-gray-500'}`}
      title={days === null
        ? 'Não há histórico suficiente para determinar o início deste status.'
        : `No status atual desde ${new Date(client.statusSince).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${client.emEspera ? '. Atendimento em espera.' : ''}`}
    >
      {days === null ? 'Tempo não registrado' : days === 0 ? 'Status atualizado hoje' : `${days} ${days === 1 ? 'dia' : 'dias'} sem mudança de status`}
    </p>
  );
}
