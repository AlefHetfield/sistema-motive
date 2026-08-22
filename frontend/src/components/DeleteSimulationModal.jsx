import { useEffect } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DeleteSimulationModal({ simulation, clientName, isDeleting, onCancel, onConfirm }) {
    useEffect(() => {
        if (!simulation) return undefined;
        const handleKeyDown = event => {
            if (event.key === 'Escape' && !isDeleting) onCancel();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [simulation, isDeleting, onCancel]);

    if (!simulation) return null;

    const program = simulation.bank === 'CAIXA' && simulation.program !== 'SBPE'
        ? `MCMV - ${simulation.program}`
        : simulation.program;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
            <button type="button" className="absolute inset-0" disabled={isDeleting} onClick={onCancel} aria-label="Cancelar exclusão" />
            <div role="alertdialog" aria-modal="true" aria-labelledby="delete-simulation-title" aria-describedby="delete-simulation-description" className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6">
                    <div className="flex gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-4 ring-red-50/60"><AlertTriangle className="h-5 w-5" /></span>
                        <div>
                            <h2 id="delete-simulation-title" className="text-lg font-bold text-gray-900">Excluir simulação?</h2>
                            <p id="delete-simulation-description" className="mt-1 text-sm leading-5 text-gray-500">Ela será removida do histórico de {clientName || 'cliente'}.</p>
                        </div>
                    </div>
                    <button type="button" disabled={isDeleting} onClick={onCancel} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40" aria-label="Fechar"><X className="h-5 w-5" /></button>
                </header>

                <div className="space-y-4 p-5 sm:p-6">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${simulation.bank === 'CAIXA' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>{simulation.bank}</span><span className="text-xs font-semibold text-gray-600">{program} · {simulation.system}</span></div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Financiamento</p><p className="mt-1 text-sm font-bold text-gray-800">{currency.format(Number(simulation.financed))}</p></div>
                            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Parcela estimada</p><p className="mt-1 text-sm font-bold text-gray-800">{currency.format(Number(simulation.firstInstallment))}</p></div>
                        </div>
                    </div>
                    <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Esta ação não pode ser desfeita. O valor financiado atual do cadastro não será alterado.</p></div>
                </div>

                <footer className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <button type="button" disabled={isDeleting} onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-40">Cancelar</button>
                    <button type="button" disabled={isDeleting} onClick={onConfirm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-70">{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {isDeleting ? 'Excluindo...' : 'Excluir simulação'}</button>
                </footer>
            </div>
        </div>
    );
}
