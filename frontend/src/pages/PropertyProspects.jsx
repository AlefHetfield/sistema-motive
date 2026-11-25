import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ChevronLeft, ChevronRight, ClipboardList, FilePenLine, MapPin, Phone, Plus, Search, Star, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../components/ui/Button';
import { controlClass } from '../components/ui/styles';
import ProspectModal from '../components/prospects/ProspectModal';
import DeleteProspectDialog from '../components/prospects/DeleteProspectDialog';
import { useAuth } from '../context/AuthContext';
import { formatProspectPostalCode, prospectAddress, prospectPhone, prospectStages } from '../components/prospects/prospectFields';
import useProspectDialog from '../components/prospects/useProspectDialog';
import { prospectApi, prospectPhotoUrl } from '../services/prospectApi';

const initial = { items: [], total: 0, page: 1, pageSize: 24, cities: [], summary: {} };
const shortDate = value => new Date(value).toLocaleDateString('pt-BR');
const filterLabels = { SEARCHING: 'A localizar', CONTACT_FOUND: 'Localizados', IN_CONTACT: 'Em contato', CAPTURED: 'Captados', DISCARDED: 'Descartados' };

function PhotoPreview({ item, onClose }) {
  const id = useId(), ref = useRef(null);
  useProspectDialog(ref, onClose, false, id);
  return createPortal(<div className="mobile-safe-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-4"><div className="min-w-0"><h2 tabIndex={-1} id={id} className="text-base font-bold text-slate-900">Foto da captação</h2><p className="mt-1 break-words text-xs leading-5 text-slate-500">{prospectAddress(item)}</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar foto"><X size={20} /></Button></header><div className="min-h-0 overflow-auto bg-slate-50 p-3"><img src={prospectPhotoUrl(item)} alt={`Fachada de ${item.street}, ${item.number}`} className="mx-auto max-h-[70dvh] max-w-full rounded-xl object-contain" /></div></section>
  </div>, document.body);
}

function ProspectCard({ item, onEdit, onPreview, onDelete, canDelete, onFavorite, favoritePending }) {
  const stage = prospectStages.find(option => option.value === item.stage) || prospectStages[0];
  return <article className="app-card min-w-0 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-primary/30">
    <div className="flex gap-3">
      {item.hasPhoto ? <button type="button" onClick={() => onPreview(item)} aria-label={`Ampliar foto de ${item.street}, ${item.number}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Camera className="absolute inset-0 m-auto text-slate-400" size={24} aria-hidden="true" /><img src={prospectPhotoUrl(item)} alt="" loading="lazy" className="relative h-full w-full object-cover" /></button> : <div className="flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400"><Camera size={23} aria-hidden="true" /><span className="text-[10px]">Sem foto</span></div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${stage.color}`}>{stage.label}</span>
          <Button size="icon" variant="ghost"
            className={`-mr-1 -mt-1 !h-9 !w-9 ${item.isFavorite ? '!bg-amber-50 !text-amber-700' : ''}`}
            aria-label={`Favorito: ${item.street}, ${item.number}`} aria-pressed={Boolean(item.isFavorite)}
            title={item.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            disabled={favoritePending} onClick={() => onFavorite(item)}>
            <Star size={17} fill={item.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </Button>
        </div>
        <button type="button" onClick={() => onEdit(item)} className="block w-full break-words text-left text-sm font-bold leading-5 text-slate-900 hover:text-primary hover:underline">{item.street}, {item.number}</button>
        <p className="mt-1 break-words text-xs leading-5 text-slate-500">{[item.complement, item.neighborhood, `${item.city} / ${item.state}`, item.postalCode && `CEP ${formatProspectPostalCode(item.postalCode)}`].filter(Boolean).join(' · ')}</p>
        <p className={`mt-1 text-xs ${item.registration ? 'font-semibold text-primary' : 'text-slate-400'}`}>{item.registration ? `Matrícula ${item.registration}` : 'Matrícula a pesquisar'}</p>
      </div>
    </div>
    <div className="mt-4 flex min-h-11 items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <div className="min-w-0"><p className="flex items-center gap-1.5 truncate text-xs font-semibold text-slate-700"><UserRound size={13} className="shrink-0" aria-hidden="true" />{item.ownerName || 'Proprietário a localizar'}</p>{item.ownerPhone && <a href={`tel:${item.ownerPhone}`} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Phone size={12} aria-hidden="true" />{prospectPhone(item.ownerPhone)}</a>}</div>
      {!item.ownerPhone && <Button size="sm" variant="primarySoft" onClick={() => onEdit(item, true)} className="!text-[11px]">Registrar contato</Button>}
    </div>
    {item.notes && <p title={item.notes} className="mt-3 line-clamp-2 break-words text-xs leading-5 text-slate-500">{item.notes}</p>}
    <footer className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2"><span className="min-w-0 truncate text-[10px] text-slate-400" title={`${item.createdByName} · ${shortDate(item.createdAt)}`}>{shortDate(item.createdAt)} · {item.createdByName}</span><div className="flex shrink-0 items-center gap-1"><Button size="sm" variant="ghost" onClick={() => onEdit(item)} aria-label={`Editar captação ${item.street}, ${item.number}`}><FilePenLine size={14} />Editar</Button>{canDelete && <Button size="icon" variant="dangerSoft" onClick={() => onDelete(item)} title="Excluir captação" aria-label={`Excluir captação ${item.street}, ${item.number}`}><Trash2 size={16} aria-hidden="true" /></Button>}</div></footer>
  </article>;
}

export default function PropertyProspects({ active = true, toolbarTarget }) {
  const { user } = useAuth();
  const [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [stage, setStage] = useState('active'), [city, setCity] = useState(''), [page, setPage] = useState(1);
  const [response, setResponse] = useState(initial), [request, setRequest] = useState({ key: null, error: '' });
  const [revision, setRevision] = useState(0), [editor, setEditor] = useState(null), [preview, setPreview] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoritePending, setFavoritePending] = useState(() => new Set());
  const [favoriteRevision, setFavoriteRevision] = useState(0);
  const requestKey = JSON.stringify([search, stage, city, page, revision, favoritesOnly, favoritesOnly ? favoriteRevision : 0]);
  const loading = request.key !== requestKey;
  const error = loading ? '' : request.error;
  useEffect(() => { const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: search, stage, city, page: String(page) });
    if (favoritesOnly) params.set('favorites', '1');
    prospectApi(`?${params}`, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      if (page > 1 && !data.items.length) { setPage(Math.max(1, Math.ceil(data.total / data.pageSize))); return; }
      setResponse(data);
      setRequest({ key: requestKey, error: '' });
    }).catch(reason => { if (!controller.signal.aborted) setRequest({ key: requestKey, error: reason.message }); });
    return () => controller.abort();
  }, [active, search, stage, city, page, favoritesOnly, requestKey]);
  const closeEditor = useCallback(() => setEditor(null), []);
  const closePreview = useCallback(() => setPreview(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);
  const edit = (item, focusContact = false) => setEditor({ item, focusContact });
  const add = () => setEditor({ item: null, focusContact: false });
  const toggleFavorite = async item => {
    if (favoritePending.has(item.id)) return;
    setFavoritePending(current => new Set(current).add(item.id));
    try {
      const { isFavorite } = await prospectApi(`/${item.id}/favorite`, {
        method: 'PATCH', body: { isFavorite: !item.isFavorite },
      });
      setResponse(current => ({
        ...current,
        items: current.items.map(entry => entry.id === item.id ? { ...entry, isFavorite } : entry),
      }));
      setFavoriteRevision(value => value + 1);
    } catch (reason) {
      toast.error(reason.message || 'Não foi possível salvar o favorito.');
    } finally {
      setFavoritePending(current => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };
  const actions = <Button className="min-h-11" onClick={add}><Plus size={16} />Nova captação</Button>;
  const pages = Math.max(1, Math.ceil(response.total / response.pageSize));
  return <div className="mx-auto w-full max-w-[1600px] space-y-4 p-4 pb-8 sm:p-6">
    {active && toolbarTarget && createPortal(actions, toolbarTarget)}
    <div><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardList size={20} className="text-primary" />Captação</h2><div className={toolbarTarget ? 'shrink-0 lg:hidden' : 'shrink-0'}>{actions}</div></div><p className="mt-1 text-sm leading-5 text-slate-500">Guarde a fachada e acompanhe a busca pelo proprietário.</p></div>
    <div aria-label="Panorama das captações" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-slate-500 sm:gap-x-5">
      {[['SEARCHING', 'Buscando proprietário'], ['CONTACT_FOUND', 'Contatos localizados'], ['CAPTURED', 'Captados']].map(([value, label]) => <button key={value} type="button" onClick={() => { setStage(current => current === value ? 'active' : value); setPage(1); }} aria-label={`${response.summary[value] || 0} ${label}`} aria-pressed={stage === value} className={`min-h-9 rounded-lg px-2 py-1 transition hover:bg-primary/5 ${stage === value ? 'bg-primary/10 text-primary' : ''}`}><strong className="mr-1.5 text-base font-bold text-slate-800">{response.summary[value] || 0}</strong><span className="sm:hidden">{filterLabels[value]}</span><span className="hidden sm:inline">{label}</span></button>)}
      <Button size="sm" variant={favoritesOnly ? 'primarySoft' : 'secondary'} className="sm:ml-auto"
        aria-pressed={favoritesOnly} onClick={() => { setFavoritesOnly(value => !value); setPage(1); }}>
        <Star size={15} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />Favoritas
      </Button>
    </div>
    <section aria-label="Filtros de captação" className="app-card grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_200px_180px]">
      <label className="relative col-span-2 min-w-0 sm:col-span-1"><span className="sr-only">Pesquisar captações</span><Search size={17} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input className={`${controlClass} !pl-10`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar endereço, CEP, matrícula ou proprietário…" maxLength={200} /></label>
      <label className="min-w-0"><span className="sr-only">Etapa das captações</span><select className={controlClass} value={stage} onChange={event => { setStage(event.target.value); setPage(1); }}><option value="active">Não descartadas</option>{prospectStages.map(option => <option value={option.value} key={option.value}>{filterLabels[option.value]}</option>)}<option value="all">Todas as etapas</option></select></label>
      <label><span className="sr-only">Cidade das captações</span><select className={controlClass} value={city} onChange={event => { setCity(event.target.value); setPage(1); }}><option value="">Todas as cidades</option>{response.cities.map(value => <option key={value}>{value}</option>)}</select></label>
    </section>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><Button size="sm" variant="secondary" onClick={() => setRevision(value => value + 1)}>Tentar novamente</Button></div>}
    <section aria-label="Lista de captações" aria-busy={loading}>
      {loading ? <p role="status" className="py-12 text-center text-sm text-slate-500">Carregando captações…</p> : !error && response.items.length ? (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {response.items.map(item => <ProspectCard key={item.id} item={item} onEdit={edit} onPreview={setPreview}
            onDelete={setDeleting} canDelete={user?.role === 'ADM' || (user?.id != null && item.createdById === user.id)}
            onFavorite={toggleFavorite} favoritePending={favoritePending.has(item.id)} />)}
        </div>
      ) : !error && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          {favoritesOnly ? <Star size={30} className="mx-auto text-primary" /> : <MapPin size={30} className="mx-auto text-primary" />}
          <h3 className="mt-3 font-bold text-slate-800">{favoritesOnly ? 'Nenhuma favorita nesta seleção' : search || city || stage !== 'active' ? 'Nenhuma captação com esses filtros' : 'Uma fachada pode ser sua próxima captação'}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {favoritesOnly ? 'Use a estrela nos cartões para guardar as captações mais interessantes.' : search || city || stage !== 'active' ? 'Ajuste a busca ou a etapa para encontrar o registro.' : 'Cadastre o endereço e uma foto. Depois, complete a matrícula e o contato do proprietário.'}
          </p>
          {!favoritesOnly && !search && !city && stage === 'active' && <Button variant="primarySoft" className="mt-5" onClick={add}><Plus size={16} />Registrar primeira captação</Button>}
        </div>
      )}
    </section>
    {!loading && !error && response.total > 0 && <footer className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>{response.total} registro(s) · Página {page} de {pages}</span><div className="flex gap-2"><Button size="icon" variant="secondary" aria-label="Captações anteriores" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></Button><Button size="icon" variant="secondary" aria-label="Próximas captações" disabled={page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></Button></div></footer>}
    {editor && <ProspectModal key={editor.item?.id || 'new'} item={editor.item} focusContact={editor.focusContact} onClose={closeEditor} onSaved={() => { setEditor(null); setRevision(value => value + 1); toast.success('Captação salva.'); }} />}
    {preview && <PhotoPreview item={preview} onClose={closePreview} />}
    {deleting && <DeleteProspectDialog item={deleting} onClose={closeDelete} onDeleted={() => { setDeleting(null); setRevision(value => value + 1); toast.success('Captação excluída.'); }} />}
  </div>;
}
