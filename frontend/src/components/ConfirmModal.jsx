import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, HelpCircle, Loader2, Trash2, X } from 'lucide-react';
import Button from './ui/Button';

const toneConfig = {
    red: { icon: Trash2, iconClass: 'bg-red-50 text-red-600 ring-red-50/70', variant: 'danger' },
    green: { icon: CheckCircle2, iconClass: 'bg-emerald-50 text-emerald-600 ring-emerald-50/70', variant: 'success' },
    orange: { icon: Archive, iconClass: 'bg-amber-50 text-amber-600 ring-amber-50/70', variant: 'warning' },
    purple: { icon: CheckCircle2, iconClass: 'bg-purple-50 text-purple-600 ring-purple-50/70', variant: 'primary' },
    blue: { icon: HelpCircle, iconClass: 'bg-primary/10 text-primary ring-primary/5', variant: 'primary' },
};

export default function ConfirmModal({
    isOpen,
    onClose,
    onCancel,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmColor = 'blue',
    warning,
}) {
    const [isConfirming, setIsConfirming] = useState(false);
    const confirmButtonRef = useRef(null);
    const closeModal = onClose || onCancel;
    const tone = toneConfig[confirmColor] || toneConfig.blue;
    const Icon = tone.icon;

    useEffect(() => {
        if (!isOpen) return undefined;
        const previousActiveElement = document.activeElement;
        const focusTimer = window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
        const handleKeyDown = event => {
            if (event.key === 'Escape' && !isConfirming) closeModal?.();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            previousActiveElement?.focus?.();
        };
    }, [closeModal, isConfirming, isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (isConfirming) return;
        setIsConfirming(true);
        try {
            await onConfirm?.();
            closeModal?.();
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
            <button type="button" className="absolute inset-0" disabled={isConfirming} onClick={() => closeModal?.()} aria-label="Cancelar ação" />
            <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-description" className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6">
                    <div className="flex gap-3">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-4 ${tone.iconClass}`}>
                            <Icon className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 id="confirm-modal-title" className="text-lg font-bold text-gray-900">{title}</h2>
                            <p id="confirm-modal-description" className="mt-1 text-sm leading-6 text-gray-500">{message}</p>
                        </div>
                    </div>
                    <button type="button" disabled={isConfirming} onClick={() => closeModal?.()} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40" aria-label="Fechar">
                        <X className="h-5 w-5" />
                    </button>
                </header>

                {warning && (
                    <div className="px-5 pt-5 sm:px-6">
                        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>{warning}</p>
                        </div>
                    </div>
                )}

                <footer className="mt-5 flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button disabled={isConfirming} onClick={() => closeModal?.()} variant="ghost">{cancelText}</Button>
                    <Button ref={confirmButtonRef} disabled={isConfirming} onClick={handleConfirm} variant={tone.variant}>
                        {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                        {isConfirming ? 'Processando...' : confirmText}
                    </Button>
                </footer>
            </div>
        </div>
    );
}
