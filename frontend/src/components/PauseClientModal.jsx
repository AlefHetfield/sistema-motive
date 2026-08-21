import { useState } from 'react';
import { Calendar, Clock3, PauseCircle, X } from 'lucide-react';

const REASONS = [
    'Aguardando cliente',
    'Documentação pendente',
    'Dependência bancária',
    'Imóvel ou obra',
    'Decisão comercial',
    'Outro',
];

const getToday = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
};

const formatDateBR = (isoDate) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
};

const maskDateBR = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const parseDateBR = (value) => {
    if (!value) return '';
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
    return `${year}-${month}-${day}`;
};

export default function PauseClientModal({ client, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [resumeDate, setResumeDate] = useState('');
    const [dateText, setDateText] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!reason) {
            setError('Selecione o motivo da espera.');
            return;
        }

        const parsedDate = parseDateBR(dateText);
        if (dateText && !parsedDate) {
            setError('Informe uma data válida no formato DD/MM/AAAA.');
            return;
        }
        if (parsedDate && parsedDate < getToday()) {
            setError('A data prevista não pode estar no passado.');
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            await onConfirm(client, { reason, note: note.trim(), resumeDate: parsedDate || '' });
        } catch (submitError) {
            setError(submitError?.message || 'Não foi possível colocar o cliente em espera.');
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Fechar" />
            <form onSubmit={handleSubmit} className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex items-start justify-between border-b border-gray-100 p-6">
                    <div className="flex gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><PauseCircle size={22} /></div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Colocar em espera</h2>
                            <p className="mt-0.5 text-sm text-gray-500">{client.nome} continuará na etapa “{client.status}”.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50" aria-label="Fechar modal"><X size={20} /></button>
                </header>

                <div className="space-y-5 p-6">
                    <div>
                        <label htmlFor="wait-reason" className="mb-2 block text-sm font-semibold text-gray-700">Motivo da espera</label>
                        <select id="wait-reason" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} required className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                            <option value="">Selecione um motivo</option>
                            {REASONS.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="wait-note" className="mb-2 block text-sm font-semibold text-gray-700">Observação <span className="font-normal text-gray-400">(opcional)</span></label>
                        <textarea id="wait-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} placeholder="Registre o que precisa acontecer antes da retomada" className="w-full resize-none rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    </div>

                    <div>
                        <label htmlFor="resume-date-text" className="mb-2 block text-sm font-semibold text-gray-700">Previsão de retomada <span className="font-normal text-gray-400">(opcional)</span></label>
                        <div className="relative">
                            <Clock3 size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input id="resume-date-text" type="text" inputMode="numeric" maxLength={10} placeholder="DD/MM/AAAA" value={dateText} onChange={(event) => { const text = maskDateBR(event.target.value); setDateText(text); setResumeDate(parseDateBR(text) || ''); setError(''); }} className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-12 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                            <Calendar size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input type="date" aria-label="Selecionar previsão de retomada" min={getToday()} value={resumeDate} onChange={(event) => { setResumeDate(event.target.value); setDateText(formatDateBR(event.target.value)); setError(''); }} className="absolute right-0 top-0 h-full w-12 cursor-pointer opacity-0" />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">A data gera uma indicação visual; a retomada continua sendo confirmada manualmente.</p>
                    </div>

                    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                </div>

                <footer className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
                    <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
                    <button type="submit" disabled={isSaving || !reason} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"><PauseCircle size={17} />{isSaving ? 'Salvando...' : 'Colocar em espera'}</button>
                </footer>
            </form>
        </div>
    );
}
