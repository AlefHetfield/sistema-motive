import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, UserRound, X } from 'lucide-react';
import { fetchClients, saveClientSimulation } from '../services/api';

export default function SaveSimulationModal({ simulationData, onClose, onSaved }) {
    const [clients, setClients] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        fetchClients()
            .then(data => active && setClients(Array.isArray(data) ? data : []))
            .catch(() => active && setError('Não foi possível carregar os clientes.'))
            .finally(() => active && setIsLoading(false));
        return () => { active = false; };
    }, []);

    const filteredClients = useMemo(() => {
        const query = search.trim().toLocaleLowerCase('pt-BR');
        if (!query) return clients.slice(0, 8);
        const digits = query.replace(/\D/g, '');
        return clients.filter(client => {
            const name = String(client.nome || '').toLocaleLowerCase('pt-BR');
            const cpf = String(client.cpf || '').replace(/\D/g, '');
            return name.includes(query) || (digits && cpf.includes(digits));
        }).slice(0, 8);
    }, [clients, search]);

    const handleSave = async () => {
        if (!selectedClient || isSaving) return;
        setIsSaving(true);
        setError('');
        try {
            const saved = await saveClientSimulation(selectedClient.id, simulationData);
            onSaved(saved, selectedClient);
        } catch (saveError) {
            setError(saveError.message || 'Não foi possível salvar a simulação.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
            <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar" />
            <div role="dialog" aria-modal="true" aria-labelledby="save-simulation-title" className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6">
                    <div>
                        <h2 id="save-simulation-title" className="text-lg font-bold text-gray-900">Salvar no cadastro do cliente</h2>
                        <p className="mt-1 text-sm text-gray-500">Selecione quem receberá esta simulação no histórico.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </header>

                <div className="space-y-4 p-5 sm:p-6">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                        <input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome ou CPF" className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                    </div>

                    <div className="max-h-72 space-y-2 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando clientes...</div>
                        ) : filteredClients.length ? filteredClients.map(client => {
                            const selected = selectedClient?.id === client.id;
                            return (
                                <button key={client.id} type="button" onClick={() => setSelectedClient(client)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-primary bg-primary/5 ring-2 ring-primary/10' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>{selected ? <Check className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</span>
                                    <span className="min-w-0"><span className="block truncate text-sm font-bold text-gray-800">{client.nome || 'Cliente sem nome'}</span><span className="mt-0.5 block truncate text-xs text-gray-400">{client.cpf || 'CPF não informado'} · {client.imovel || 'Imóvel não informado'}</span></span>
                                </button>
                            );
                        }) : <p className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500">Nenhum cliente encontrado.</p>}
                    </div>
                    {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
                </div>

                <footer className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6">
                    <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancelar</button>
                    <button type="button" disabled={!selectedClient || isSaving} onClick={handleSave} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#4a637a] disabled:cursor-not-allowed disabled:opacity-50">{isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar simulação</button>
                </footer>
            </div>
        </div>
    );
}
