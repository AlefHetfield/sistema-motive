import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, ImageIcon, LoaderCircle, X } from 'lucide-react';
import { fetchPropertyDetails, propertyDriveImageUrl } from '../../services/api';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const missing = value => value == null || String(value).trim() === '';
const display = value => missing(value) ? 'Não informado' : String(value);
const number = value => missing(value) || !Number.isFinite(Number(value)) ? 'Não informado' : decimal.format(Number(value));
const money = value => missing(value) || !Number.isFinite(Number(value)) ? 'Não informado' : currency.format(Number(value));
const safeUrl = value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
};
const date = value => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Não informado';
};
const whatsapp = value => {
  if (missing(value)) return 'Não informado';
  const digits = String(value).replace(/\D/g, '');
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  return String(value);
};

function Field({ label, value, children, className = '' }) {
  return <div className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 ${className}`}>
    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
    <dd className="mt-1 select-text whitespace-pre-line break-words text-sm leading-6 text-slate-800">{children ?? display(value)}</dd>
  </div>;
}

function LinkField({ label, value, className = '' }) {
  const href = safeUrl(value);
  return <Field label={label} className={className}>
    {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-start gap-1.5 text-primary underline underline-offset-2 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><ExternalLink size={14} aria-hidden="true" className="mt-1 shrink-0" /><span className="min-w-0 break-all">{value}</span></a> : display(value)}
  </Field>;
}

export default function PropertyDetailsModal({ propertyId, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const closeRef = useRef(onClose);
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState({ propertyId, attempt: 0, property: null, error: '' });
  const [failedCover, setFailedCover] = useState('');
  const current = response.propertyId === propertyId && response.attempt === attempt;
  const property = current ? response.property : null;
  const error = current ? response.error : '';
  const loading = !property && !error;

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPropertyDetails(propertyId, { signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted) setResponse({ propertyId, attempt, property: result, error: '' });
      })
      .catch(reason => {
        if (!controller.signal.aborted) setResponse({ propertyId, attempt, property: null, error: reason.message || 'Não foi possível carregar os dados do imóvel.' });
      });
    return () => controller.abort();
  }, [propertyId, attempt]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus({ preventScroll: true });
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      // This dialog can open above TaskEditor, whose document listener also traps focus.
      event.stopImmediatePropagation();
      const dialog = dialogRef.current;
      const nodes = dialog?.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!nodes?.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const cover = property && (safeUrl(property.photoUrl) || (property.driveCoverFileId ? propertyDriveImageUrl(property.driveCoverFileId) : ''));
  return createPortal(
    <div className="mobile-safe-overlay fixed inset-0 z-[90] flex h-full items-center justify-center overflow-hidden bg-slate-950/40 p-3 backdrop-blur-[2px] sm:p-6">
      <button type="button" tabIndex={-1} onClick={onClose} aria-label="Fechar visualização do imóvel" className="absolute inset-0" />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative flex h-full min-h-0 w-full min-w-0 max-w-4xl max-h-[900px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Consulta do imóvel</p><h2 id={titleId} className="mt-1 text-xl font-bold text-slate-900">Dados do imóvel</h2></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Fechar dados do imóvel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><X size={20} /></button>
        </header>
        <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6" aria-busy={loading}>
          {loading && <p role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle size={18} aria-hidden="true" className="motion-safe:animate-spin" />Carregando dados do imóvel…</p>}
          {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-3 rounded-lg font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Tentar novamente</button></div>}
          {property && <>
            <section aria-label="Identificação e localização">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Identificação e localização</h3>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Código / referência" value={property.code} />
                <Field label="Título do imóvel" value={property.title} className="lg:col-span-3" />
                <Field label="Endereço" value={property.address} className="sm:col-span-2" />
                <Field label="Bairro" value={property.neighborhood} />
                <Field label="Cidade" value={property.city} />
              </dl>
            </section>
            <section aria-label="Características" className="border-t border-slate-100 pt-5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Características</h3>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Tipo" value={property.propertyType} />
                <Field label="Condição" value={property.condition} />
                <Field label="Status" value={property.status} />
                <Field label="Valor" value={money(property.price)} />
                <Field label="Área construída (m²)" value={number(property.area)} />
                <Field label="Terreno (m²)" value={number(property.landArea)} />
                {['Casa', 'Sobrado'].includes(property.propertyType) && <Field label="Configuração do terreno" value={property.landConfiguration} />}
                {property.propertyType === 'Apartamento' && <Field label="Andar" value={number(property.floor)} />}
                <Field label="Dormitórios" value={number(property.bedrooms)} />
                <Field label="Suítes" value={number(property.suites)} />
                <Field label="Banheiros" value={number(property.bathrooms)} />
                <Field label="Vagas" value={number(property.parkingSpaces)} />
                <Field label="Captador" value={property.captador} />
                <Field label="Disponibilidade confirmada em" value={date(property.lastAvailabilityCheck)} />
              </dl>
            </section>
            <section aria-label="Proprietário" className="border-t border-slate-100 pt-5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Proprietário</h3>
              <dl className="grid gap-4 sm:grid-cols-2"><Field label="Nome do proprietário" value={property.ownerName} /><Field label="WhatsApp do proprietário" value={whatsapp(property.ownerWhatsapp)} /></dl>
            </section>
            <section aria-label="Apresentação" className="border-t border-slate-100 pt-5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Apresentação</h3>
              <dl className="grid gap-4 sm:grid-cols-2">
                <LinkField label="Link do imóvel no site" value={property.sourceUrl} className="sm:col-span-2" />
                <LinkField label="Pasta de fotos no Google Drive" value={property.driveFolderUrl} className="sm:col-span-2" />
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:col-span-2">
                  <dt className="sr-only">Foto principal</dt>
                  <dd>{cover && failedCover !== cover ? <img src={cover} alt={`Foto do imóvel ${property.title || property.code || ''}`.trim()} className="max-h-72 w-full object-contain" onError={() => setFailedCover(cover)} /> : <div className="flex min-h-32 items-center justify-center gap-2 px-4 text-sm text-slate-400"><ImageIcon size={20} aria-hidden="true" />Nenhuma foto disponível</div>}</dd>
                </div>
                <Field label="Descrição" value={property.description} className="sm:col-span-2" />
                <Field label="Informações complementares" value={property.additionalInformation} className="sm:col-span-2" />
              </dl>
            </section>
          </>}
        </div>
        <footer className="flex shrink-0 justify-end border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6"><button type="button" onClick={onClose} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">Fechar</button></footer>
      </section>
    </div>,
    document.body,
  );
}
