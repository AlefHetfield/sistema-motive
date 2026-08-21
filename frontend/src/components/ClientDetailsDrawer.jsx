import { useEffect, useState } from 'react';
import {
    Archive,
    Banknote,
    Building2,
    Calendar,
    CheckCircle2,
    Clock3,
    FilePenLine,
    FileText,
    History,
    Home,
    MapPin,
    PauseCircle,
    PlayCircle,
    RotateCcw,
    Trash2,
    UserRound,
    UsersRound,
    X,
} from 'lucide-react';
import { fetchClientActivities } from '../services/api';

const SIGNED_STATUSES = ['Assinado', 'Assinado-Movido'];

const formatDate = (value, includeTime = false) => {
    if (!value) return 'Não informada';
    const options = includeTime
        ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' };
    return new Intl.DateTimeFormat('pt-BR', options).format(new Date(value));
};

const formatCurrency = (value) => value
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
    : 'Não informado';

const formatCpf = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 11) return value || 'Não informado';
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const statusLabel = (status) => SIGNED_STATUSES.includes(status) ? 'Assinado' : (status || 'Sem status');

const DetailItem = ({ icon, label, value }) => (
    <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm">
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-0.5 break-words text-sm font-medium text-gray-800">{value || 'Não informado'}</p>
        </div>
    </div>
);

const actionDescription = (activity) => {
    if (activity.action === 'created') return 'Cliente cadastrado';
    if (activity.action === 'deleted') return 'Cliente excluído';
    if (activity.action === 'paused') return 'Atendimento colocado em espera';
    if (activity.action === 'resumed') return 'Atendimento retomado';
    if (activity.action === 'status_changed') {
        return `${statusLabel(activity.statusAntes)} → ${statusLabel(activity.statusDepois)}`;
    }
    return 'Dados do cliente atualizados';
};

export default function ClientDetailsDrawer({
    client,
    activeTab,
    isAssistant,
    onClose,
    onEdit,
    onComplete,
    onArchive,
    onRestore,
    onDelete,
    onPause,
    onResume,
}) {
    const [activities, setActivities] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    useEffect(() => {
        const handleKeyDown = (event) => event.key === 'Escape' && onClose();
        document.addEventListener('keydown', handleKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    useEffect(() => {
        let active = true;
        fetchClientActivities(client.id)
            .then(data => active && setActivities(Array.isArray(data) ? data : []))
            .catch(() => active && setActivities([]))
            .finally(() => active && setIsLoadingHistory(false));
        return () => { active = false; };
    }, [client.id]);

    return (
        <div className="fixed inset-0 z-[9000]">
            <button type="button" className="absolute inset-0 bg-gray-950/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar detalhes" />
            <aside role="dialog" aria-modal="true" aria-labelledby="client-details-title" className="absolute inset-y-0 right-0 flex w-full max-w-xl animate-in slide-in-from-right flex-col bg-white shadow-2xl duration-200">
                <header className="border-b border-gray-100 px-5 py-5 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SIGNED_STATUSES.includes(client.status) ? 'bg-emerald-50 text-emerald-700' : client.status === 'Arquivado' ? 'bg-gray-100 text-gray-600' : 'bg-indigo-50 text-indigo-700'}`}>
                                    {statusLabel(client.status)}
                                </span>
                                {client.emEspera && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"><PauseCircle size={13} />Em espera</span>}
                                <span className="text-xs text-gray-400">Cliente #{client.id}</span>
                            </div>
                            <h2 id="client-details-title" className="truncate text-xl font-bold text-gray-900">{client.nome}</h2>
                            <p className="mt-1 text-sm text-gray-500">CPF {formatCpf(client.cpf)}</p>
                        </div>
                        <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Fechar painel">
                            <X size={20} />
                        </button>
                    </div>
                </header>

                <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-6">
                    {client.emEspera && (
                        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex gap-3">
                                <PauseCircle size={20} className="mt-0.5 shrink-0 text-amber-700" />
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-amber-950">Atendimento em espera</h3>
                                    <p className="mt-1 text-sm text-amber-900">{client.motivoEspera || 'Motivo não informado'}</p>
                                    {client.observacaoEspera && <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-amber-800">{client.observacaoEspera}</p>}
                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700">
                                        {client.dataRetomada && <span>Retomada prevista: {formatDate(client.dataRetomada)}</span>}
                                        {client.pausadoPor && <span>Por: {client.pausadoPor}</span>}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                    <section>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><Home size={17} className="text-primary" />Imóvel</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <DetailItem icon={<Building2 size={17} />} label="Empreendimento" value={client.imovel} />
                            <DetailItem icon={<MapPin size={17} />} label="Cidade" value={client.cidade} />
                            <DetailItem icon={<FileText size={17} />} label="Matrícula" value={client.matricula} />
                            <DetailItem icon={<Calendar size={17} />} label="Assinatura" value={client.dataAssinaturaContrato ? formatDate(client.dataAssinaturaContrato) : 'Não informada'} />
                        </div>
                    </section>

                    <section>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><UsersRound size={17} className="text-primary" />Atendimento</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <DetailItem icon={<UserRound size={17} />} label="Responsável" value={client.responsavel} />
                            <DetailItem icon={<UserRound size={17} />} label="Corretor" value={client.corretor} />
                            <DetailItem icon={<Building2 size={17} />} label="Agência" value={client.agencia} />
                            <DetailItem icon={<Clock3 size={17} />} label="Última alteração" value={client.ultimaAtualizacao ? formatDate(client.ultimaAtualizacao, true) : 'Não informada'} />
                        </div>
                    </section>

                    {!isAssistant && (
                        <section>
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><Banknote size={17} className="text-primary" />Financeiro</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <DetailItem icon={<Banknote size={17} />} label="Valor financiado" value={formatCurrency(client.valorFinanciado)} />
                                <DetailItem icon={<FileText size={17} />} label="Modalidade" value={client.modalidade} />
                                <DetailItem icon={<CheckCircle2 size={17} />} label="Remuneração" value={client.remuneracaoPaga ? 'Paga' : 'Pendente'} />
                                <DetailItem icon={<CheckCircle2 size={17} />} label="Comissão" value={!client.venda ? 'Não se aplica' : client.comissaoPaga ? 'Paga' : 'Pendente'} />
                            </div>
                        </section>
                    )}

                    <section>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><FileText size={17} className="text-primary" />Observações</h3>
                        <div className="min-h-20 whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                            {client.observacoes || 'Nenhuma observação registrada.'}
                        </div>
                    </section>

                    <section>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><History size={17} className="text-primary" />Histórico recente</h3>
                        {isLoadingHistory ? (
                            <div className="space-y-3">{[1, 2, 3].map(item => <div key={item} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}</div>
                        ) : activities.length ? (
                            <div className="space-y-1">
                                {activities.map((activity, index) => (
                                    <div key={activity.id} className="relative flex gap-3 pb-4">
                                        {index < activities.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-gray-200" />}
                                        <span className="relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white bg-primary ring-1 ring-primary/30" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800">{actionDescription(activity)}</p>
                                            <p className="mt-0.5 text-xs text-gray-400">{formatDate(activity.createdAt, true)} · {activity.userName}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Nenhuma atividade registrada.</p>
                        )}
                    </section>
                </div>

                <footer className="border-t border-gray-100 bg-white px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <button type="button" onClick={() => onDelete(client)} className="mr-auto rounded-lg p-2.5 text-red-500 hover:bg-red-50" title="Excluir cliente"><Trash2 size={18} /></button>
                        {activeTab === 'archived' && <button type="button" onClick={() => onRestore(client)} className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"><RotateCcw size={17} />Restaurar</button>}
                        {activeTab === 'signed' && <button type="button" onClick={() => onArchive(client)} className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50"><Archive size={17} />Arquivar</button>}
                        {activeTab === 'active' && (client.emEspera ? (
                            <button type="button" onClick={() => onResume(client)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><PlayCircle size={17} />Retomar</button>
                        ) : (
                            <button type="button" onClick={() => onPause(client)} className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"><PauseCircle size={17} />Em espera</button>
                        ))}
                        {activeTab === 'active' && !client.emEspera && client.status === 'Assinando Contrato' && <button type="button" onClick={() => onComplete(client)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><CheckCircle2 size={17} />Concluir</button>}
                        <button type="button" onClick={() => onEdit(client)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"><FilePenLine size={17} />Editar</button>
                    </div>
                </footer>
            </aside>
        </div>
    );
}
