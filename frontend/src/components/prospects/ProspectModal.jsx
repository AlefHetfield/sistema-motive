import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, FileSearch, MapPin, Save, X } from 'lucide-react';
import Button from '../ui/Button';
import ConfirmModal from '../ConfirmModal';
import MatriculaStreetInput from '../MatriculaStreetInput';
import { controlClass, formLabelClass, textAreaClass } from '../ui/styles';
import { fetchMatriculaMetadata } from '../../services/api';
import { prospectApi } from '../../services/prospectApi';
import { prospectAddress, prospectStages } from './prospectFields';
import ProspectPhotoInput from './ProspectPhotoInput';
import useProspectDialog from './useProspectDialog';

const addressKeys = new Set(['street', 'number', 'complement', 'neighborhood', 'city', 'state']);
const empty = { street: '', number: '', complement: '', neighborhood: '', city: '', state: 'SP', stage: 'SEARCHING', registration: '', ownerName: '', ownerPhone: '', notes: '' };
const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const emptyStreets = [];

function Field({ id, label, value, onChange, maxLength, required, ...props }) {
  return <div><label htmlFor={id} className={formLabelClass}>{label}{required ? ' *' : ''}</label><input id={id} value={value} onChange={event => onChange(event.target.value)} className={controlClass} maxLength={maxLength} required={required} {...props} /></div>;
}

export default function ProspectModal({ item, focusContact = false, onClose, onSaved }) {
  const formId = useId();
  const [form, setForm] = useState(() => Object.fromEntries(Object.keys(empty).map(key => [key, item?.[key] ?? empty[key]])));
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState(undefined);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [metadataError, setMetadataError] = useState(false);
  const [lookup, setLookup] = useState(null);
  const [notice, setNotice] = useState('');
  const [looking, setLooking] = useState(false);
  const dialogRef = useRef(null), requestRef = useRef(null), automaticRef = useRef(null), savingRef = useRef(false);
  const close = useCallback(() => { if (saving || processing) return; if (dirty) setConfirmDiscard(true); else onClose(); }, [dirty, saving, processing, onClose]);
  useProspectDialog(dialogRef, close, saving || processing || confirmDiscard, `${formId}-${focusContact ? 'ownerName' : 'street'}`);
  useEffect(() => {
    const controller = new AbortController();
    fetchMatriculaMetadata(controller.signal).then(setMetadata).catch(reason => { if (reason.name !== 'AbortError') setMetadataError(true); });
    return () => { controller.abort(); requestRef.current?.abort(); };
  }, []);
  const change = (key, value) => {
    setDirty(true);
    if (addressKeys.has(key) || key === 'registration') {
      requestRef.current?.abort(); setLooking(false); setLookup(null); setNotice('');
    }
    const clearAutomatic = addressKeys.has(key) && automaticRef.current && form.registration === automaticRef.current;
    if (clearAutomatic || key === 'registration') automaticRef.current = null;
    setForm(current => ({ ...current, [key]: value, ...(clearAutomatic ? { registration: '' } : {}) }));
  };
  const searchRegistration = async (page = 1) => {
    requestRef.current?.abort();
    if (![form.street, form.number, form.city].every(value => value.trim())) { setNotice('Preencha rua, número e cidade para buscar a matrícula.'); return; }
    const controller = new AbortController(); requestRef.current = controller;
    setLooking(true); setNotice('');
    try {
      const result = await prospectApi('/lookup-registration', { method: 'POST', signal: controller.signal, body: { ...Object.fromEntries([...addressKeys].map(key => [key, form[key]])), page } });
      if (controller.signal.aborted) return;
      setLookup(result);
      if (result.automatic && !form.registration.trim()) {
        setForm(current => ({ ...current, registration: result.automatic })); automaticRef.current = result.automatic; setDirty(true);
        setNotice('Matrícula encontrada e preenchida. Confira os dados antes de salvar.');
      } else if (result.unsupported) setNotice('A base disponível é de cidades de SP. Para este endereço, preencha a matrícula manualmente.');
      else if (!result.total) setNotice('Nenhum registro encontrado para este endereço. Você pode preencher a matrícula manualmente.');
      else setNotice(result.total > 1 ? 'Há mais de um registro. Confira o endereço, lote e quadra antes de escolher.' : 'Confira o registro abaixo para usar a matrícula.');
    } catch (reason) { if (!controller.signal.aborted) { setLookup(null); setNotice(reason.message); } }
    finally { if (!controller.signal.aborted) setLooking(false); }
  };
  const save = async event => {
    event.preventDefault();
    if (savingRef.current || processing || looking) return;
    setError(''); savingRef.current = true; setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
      if (item) body.version = item.version;
      if (photoDataUrl !== undefined) body.photoDataUrl = photoDataUrl;
      const saved = await prospectApi(item ? `/${item.id}` : '', { method: item ? 'PATCH' : 'POST', body });
      onSaved(saved);
    } catch (reason) { setError(reason.message); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const field = (name, label, maxLength, options = {}) => <Field id={`${formId}-${name}`} label={label} value={form[name]} onChange={value => change(name, value)} maxLength={maxLength} {...options} />;

  return createPortal(<>
    <div className="mobile-safe-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} tabIndex={-1} className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Captação de imóveis</p><h2 id={`${formId}-title`} className="mt-1 text-lg font-bold text-slate-900">{item ? 'Editar captação' : 'Nova captação'}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Registre o endereço agora. Complete o contato do proprietário depois.</p></div><button type="button" onClick={close} disabled={saving || processing} aria-label="Fechar captação" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X size={20} /></button></header>
        <form id={formId} onSubmit={save} className="min-h-0 flex-1 overflow-y-auto">
          <fieldset disabled={saving} className="space-y-6 px-5 py-5 sm:px-6">
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <ProspectPhotoInput item={item} disabled={saving} onChange={value => { setPhotoDataUrl(value); setDirty(true); }} onProcessing={setProcessing} />
            <section aria-label="Endereço do imóvel" className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><MapPin size={16} />Onde fica o imóvel</h3>
              <div className="grid gap-4 sm:grid-cols-[1fr_120px]"><MatriculaStreetInput inputId={`${formId}-street`} value={form.street} city={form.city} streets={metadata?.streets || emptyStreets} onChange={value => change('street', value)} inputClass={`${controlClass} mt-1.5`} required hint="Digite o nome da rua ou escolha uma sugestão. Informe o número no campo ao lado." />{field('number', 'Número', 40, { required: true, placeholder: '123 ou s/n' })}</div>
              {metadataError && <p className="text-xs text-slate-500">As sugestões não carregaram. Você pode digitar o endereço normalmente.</p>}
              <div className="grid gap-4 sm:grid-cols-2">{field('neighborhood', 'Bairro', 160, { placeholder: 'Bairro ou loteamento' })}{field('complement', 'Complemento', 120, { placeholder: 'Casa, apartamento, bloco…' })}</div>
              <div className="grid grid-cols-[1fr_90px] gap-4">{field('city', 'Cidade', 120, { required: true, placeholder: 'Ex.: Sumaré', list: `${formId}-cities` })}<div><label htmlFor={`${formId}-state`} className={formLabelClass}>UF *</label><select id={`${formId}-state`} className={controlClass} value={form.state} onChange={event => change('state', event.target.value)}>{ufs.map(uf => <option key={uf}>{uf}</option>)}</select></div></div>
              <datalist id={`${formId}-cities`}>{(metadata?.cities || []).map(city => <option key={city.value} value={city.label} />)}</datalist>
            </section>
            <section aria-label="Matrícula do imóvel" className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-end gap-3"><div className="min-w-[160px] flex-1">{field('registration', 'Número da matrícula', 100, { placeholder: 'Preencha ou busque pelo endereço' })}</div><Button variant="secondary" onClick={() => searchRegistration()} loading={looking} loadingLabel="Buscando…" disabled={!form.street.trim() || !form.number.trim() || !form.city.trim()}><FileSearch size={16} />Buscar matrícula</Button></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Consulta a mesma base de matrículas do sistema. O preenchimento manual fica sempre disponível.</p>
              {notice && <p role="status" className="mt-3 text-sm leading-5 text-primary">{notice}</p>}
              {lookup?.results?.length > 0 && <div className="mt-3 space-y-2">
                {lookup.results.map(candidate => <article key={candidate.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold text-slate-800">{candidate.registration ? `Matrícula ${candidate.registration}` : 'Matrícula não informada na base'}</p><p className="mt-1 text-xs leading-5 text-slate-600">{[`${candidate.street}, ${candidate.number}`, candidate.neighborhood, candidate.city].filter(Boolean).join(' · ')}</p><p className="text-xs leading-5 text-slate-500">{[candidate.lot && `Lote ${candidate.lot}`, candidate.block && `Quadra ${candidate.block}`, candidate.fiscal && `Fiscal ${candidate.fiscal}`].filter(Boolean).join(' · ')}</p></div>{candidate.registration && <Button variant={form.registration === candidate.registration ? 'successSoft' : 'primarySoft'} size="sm" onClick={() => { setForm(current => ({ ...current, registration: candidate.registration })); automaticRef.current = candidate.registration; setDirty(true); setNotice('Matrícula selecionada. Confira os dados antes de salvar.'); }}>{form.registration === candidate.registration ? <><CheckCircle2 size={14} />Selecionada</> : 'Usar matrícula'}</Button>}</div></article>)}
                {lookup.pages > 1 && <div className="flex items-center justify-end gap-2 text-xs text-slate-500"><span>Página {lookup.page} de {lookup.pages}</span><Button size="icon" variant="secondary" aria-label="Matrículas anteriores" disabled={looking || lookup.page <= 1} onClick={() => searchRegistration(lookup.page - 1)}><ChevronLeft size={16} /></Button><Button size="icon" variant="secondary" aria-label="Próximas matrículas" disabled={looking || lookup.page >= lookup.pages} onClick={() => searchRegistration(lookup.page + 1)}><ChevronRight size={16} /></Button></div>}
              </div>}
            </section>
            <section aria-label="Contato do proprietário" className="space-y-4"><div><h3 className="text-sm font-bold text-slate-800">Contato do proprietário</h3><p className="mt-1 text-xs text-slate-500">Pode deixar em branco enquanto procura o contato.</p></div><div className="grid gap-4 sm:grid-cols-2">{field('ownerName', 'Nome do proprietário', 160, { placeholder: 'Preencher quando localizar' })}{field('ownerPhone', 'Telefone / WhatsApp', 30, { placeholder: '(19) 99999-9999', type: 'tel', autoComplete: 'off' })}</div><div><label className={formLabelClass} htmlFor={`${formId}-stage`}>Etapa da captação</label><select id={`${formId}-stage`} className={controlClass} value={form.stage} onChange={event => change('stage', event.target.value)}>{prospectStages.map(stage => <option key={stage.value} value={stage.value}>{stage.label}</option>)}</select></div></section>
            <div><label htmlFor={`${formId}-notes`} className={formLabelClass}>Observações</label><textarea id={`${formId}-notes`} className={textAreaClass} rows={3} maxLength={4000} value={form.notes} onChange={event => change('notes', event.target.value)} placeholder="Como reconhecer a casa, conversas com vizinhos, próximas tentativas…" /></div>
            {form.street && <p className="break-words text-xs leading-5 text-slate-500">{prospectAddress(form)}</p>}
          </fieldset>
        </form>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6"><Button variant="secondary" onClick={close} disabled={saving || processing}>Cancelar</Button><Button type="submit" form={formId} loading={saving} loadingLabel="Salvando…" disabled={processing || looking}><Save size={16} />Salvar captação</Button></footer>
      </section>
    </div>
    <ConfirmModal isOpen={confirmDiscard} title="Descartar alterações?" message="As alterações desta captação ainda não foram salvas." confirmText="Descartar alterações" cancelText="Continuar preenchendo" confirmColor="orange" onClose={() => setConfirmDiscard(false)} onConfirm={onClose} />
  </>, document.body);
}
