import { useState } from 'react';
import { Calendar, CheckCircle2, Home, X } from 'lucide-react';

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
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;

    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
        date.getUTCFullYear() !== Number(year)
        || date.getUTCMonth() !== Number(month) - 1
        || date.getUTCDate() !== Number(day)
    ) return null;

    return `${year}-${month}-${day}`;
};

const CompleteProcessModal = ({ client, onClose, onConfirm }) => {
    const [signatureDate, setSignatureDate] = useState(getToday);
    const [dateText, setDateText] = useState(() => formatDateBR(getToday()));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        const parsedDate = parseDateBR(dateText);
        if (!parsedDate) {
            setError('Informe uma data válida no formato DD/MM/AAAA.');
            return;
        }
        if (parsedDate > getToday()) {
            setError('A data da assinatura não pode estar no futuro.');
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            await onConfirm(client, parsedDate);
        } catch (submitError) {
            setError(submitError?.message || 'Não foi possível concluir o processo.');
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Fechar" />
            <form onSubmit={handleSubmit} className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-100 p-6">
                    <div className="flex gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                            <CheckCircle2 size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Concluir processo</h2>
                            <p className="mt-0.5 text-sm text-gray-500">O cliente será movido para Assinados.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Fechar modal">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-5 p-6">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <p className="font-semibold text-gray-900">{client.nome}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                            <Home size={14} />
                            <span className="truncate">{client.imovel || 'Imóvel não informado'}</span>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="signature-date" className="mb-2 block text-sm font-semibold text-gray-700">Data da assinatura</label>
                        <div className="relative">
                            <Calendar size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                id="signature-date"
                                type="text"
                                inputMode="numeric"
                                placeholder="DD/MM/AAAA"
                                required
                                maxLength={10}
                                value={dateText}
                                onChange={(event) => {
                                    const nextText = maskDateBR(event.target.value);
                                    setDateText(nextText);
                                    setSignatureDate(parseDateBR(nextText) || '');
                                    setError('');
                                }}
                                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-12 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                            <Calendar size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="date"
                                aria-label="Selecionar data no calendário"
                                max={getToday()}
                                value={signatureDate}
                                onChange={(event) => {
                                    setSignatureDate(event.target.value);
                                    setDateText(formatDateBR(event.target.value));
                                    setError('');
                                }}
                                className="absolute right-0 top-0 h-full w-12 cursor-pointer opacity-0"
                            />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">A conclusão e a data serão salvas juntas.</p>
                    </div>

                    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
                    <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
                    <button type="submit" disabled={isSaving || !signatureDate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <CheckCircle2 size={17} />
                        {isSaving ? 'Concluindo...' : 'Concluir e mover'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CompleteProcessModal;
