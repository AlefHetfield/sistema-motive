import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, HardHat, Link2, Save, X } from 'lucide-react';
import Button from '../ui/Button';
import { controlClass, formLabelClass, textAreaClass } from '../ui/styles';
import TaskPropertyPicker from '../TaskPropertyPicker';
import { engineeringApi } from '../../services/engineeringApi';
import { emptyEngineeringForm, engineeringDate, engineeringMoney, moneyInput, parseEngineeringMoney } from './engineeringForm';
import EngineeringMoneyInput from './EngineeringMoneyInput';
import EngineeringValidity from './EngineeringValidity';
import useEngineeringToday from '../../hooks/useEngineeringToday';
import { engineeringValidity } from '../../utils/engineeringValidity';

export default function EngineeringModal({ item, onClose, onSaved }) {
  const titleId = useId();
  const formId = useId();
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const closeRef = useRef(onClose);
  const savingRef = useRef(false);
  const [form, setForm] = useState(() => emptyEngineeringForm(item));
  const [property, setProperty] = useState(item?.property || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = useEngineeringToday();
  const { expiresOn } = engineeringValidity(form.dataPedido, today);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus({ preventScroll: true });
    const handleKey = event => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape' && !savingRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, []);
  const set = (name, value) => setForm(current => ({ ...current, [name]: value }));
  const selectProperty = selected => {
    setProperty(selected);
    setForm(current => ({ ...current, propertyId: selected?.id || null,
      ...(selected ? { imovel: selected.title.slice(0, 250), cidade: selected.city || current.cidade,
        valorImovel: selected.price == null ? current.valorImovel : moneyInput(selected.price) } : {}),
    }));
  };
  const save = async event => {
    event.preventDefault();
    if (savingRef.current) return;
    setError('');
    let payload;
    try {
      if (!form.imovel.trim()) { inputRef.current?.focus(); throw new Error('Informe o imóvel.'); }
      payload = { ...form, imovel: form.imovel.trim(), matricula: form.matricula.trim() || null,
        cidade: form.cidade.trim() || null, descricao: form.descricao.trim() || null,
        dataPedido: form.dataPedido || null,
        valorImovel: parseEngineeringMoney(form.valorImovel), valorAvaliado: parseEngineeringMoney(form.valorAvaliado),
      };
    } catch (reason) { setError(reason.message); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await engineeringApi(item ? `/${item.id}` : '', { method: item ? 'PATCH' : 'POST', body: payload });
      onSaved(saved);
    } catch (reason) { setError(reason.message); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return createPortal(<div className="mobile-safe-overlay fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><HardHat size={21} aria-hidden="true" /></span><div><h2 id={titleId} className="text-lg font-bold text-slate-900">{item ? 'Editar engenharia' : 'Nova engenharia'}</h2><p className="mt-0.5 text-xs text-slate-500">Controle do imóvel exclusivo e da avaliação.</p></div></div>
        <button type="button" disabled={saving} onClick={onClose} aria-label="Fechar engenharia" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"><X size={20} /></button>
      </header>
      <form id={formId} onSubmit={save} className="min-h-0 flex-1 overflow-y-auto">
        <fieldset disabled={saving} className="space-y-6 px-5 py-5 sm:px-6">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4" aria-label="Vínculo com o mapa">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Link2 size={16} aria-hidden="true" />Vincular imóvel do mapa <span className="text-xs font-normal text-slate-500">Opcional</span></h3>
            <p className="text-xs leading-5 text-slate-500">Ao selecionar, o nome, a cidade e o valor do imóvel são preenchidos. Os dados do mapa permanecem iguais.</p>
            <TaskPropertyPicker property={property} onSelect={selectProperty} showSelectedProperty={false} />
            {property && <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3"><Building2 size={19} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-slate-800">{property.code ? `${property.code} · ` : ''}{property.title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{property.city || 'Cidade não informada'} · {engineeringMoney(property.price)}</p><button type="button" onClick={() => selectProperty(null)} className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-red-600 underline underline-offset-2"><X size={13} aria-hidden="true" />Remover vínculo</button></div></div>}
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor={`${formId}-imovel`} className={formLabelClass}>Imóvel <span className="text-red-500">*</span></label><input ref={inputRef} id={`${formId}-imovel`} className={controlClass} value={form.imovel} onChange={event => set('imovel', event.target.value)} maxLength={250} required placeholder="Nome ou identificação do imóvel" /></div>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2"><div><label htmlFor={`${formId}-matricula`} className={formLabelClass}>Matrícula</label><input id={`${formId}-matricula`} className={controlClass} value={form.matricula} onChange={event => set('matricula', event.target.value)} maxLength={100} placeholder="Número da matrícula" /></div>
            <div><label htmlFor={`${formId}-cidade`} className={formLabelClass}>Cidade</label><input id={`${formId}-cidade`} className={controlClass} value={form.cidade} onChange={event => set('cidade', event.target.value)} maxLength={150} placeholder="Cidade do imóvel" /></div>
            <div><label htmlFor={`${formId}-dataPedido`} className={formLabelClass}>Data do pedido de engenharia</label><input type="date" id={`${formId}-dataPedido`} className={controlClass} value={form.dataPedido} onChange={event => set('dataPedido', event.target.value)} min="1900-01-01" max="9999-12-31" /></div>
            <div><label htmlFor={`${formId}-vencimento`} className={formLabelClass}>Vencimento da engenharia</label><input id={`${formId}-vencimento`} className={`${controlClass} bg-slate-50 text-slate-600`} value={expiresOn ? engineeringDate(expiresOn) : ''} readOnly placeholder="Vencimento não definido" aria-describedby={`${formId}-validade-hint`} /><p id={`${formId}-validade-hint`} className="mt-1.5 text-xs text-slate-500">180 dias corridos após o pedido.</p>{expiresOn && <div className="mt-2"><EngineeringValidity date={form.dataPedido} today={today} showDate={false} /></div>}</div></div>
            <div><label htmlFor={`${formId}-valorImovel`} className={formLabelClass}>Valor do imóvel (R$)</label><EngineeringMoneyInput id={`${formId}-valorImovel`} className={controlClass} value={form.valorImovel} onValueChange={value => set('valorImovel', value)} maxLength={24} placeholder="0,00" /></div>
            <div><label htmlFor={`${formId}-valorAvaliado`} className={formLabelClass}>Valor avaliado (R$)</label><EngineeringMoneyInput id={`${formId}-valorAvaliado`} className={controlClass} value={form.valorAvaliado} onValueChange={value => set('valorAvaliado', value)} maxLength={24} placeholder="Preencher após avaliação" /><p className="mt-1.5 text-xs text-slate-500">Deixe em branco enquanto aguarda a avaliação.</p></div>
            <div className="sm:col-span-2"><label htmlFor={`${formId}-descricao`} className={formLabelClass}>Descrição</label><textarea id={`${formId}-descricao`} rows={4} className={textAreaClass} value={form.descricao} onChange={event => set('descricao', event.target.value)} maxLength={10000} placeholder="Informações e observações sobre a engenharia" /></div>
          </div>
        </fieldset>
      </form>
      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" form={formId} loading={saving} loadingLabel="Salvando…"><Save size={16} aria-hidden="true" />Salvar engenharia</Button></footer>
    </section>
  </div>, document.body);
}
