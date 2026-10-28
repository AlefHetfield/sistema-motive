import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Eye, FilePenLine, Filter, HardHat, MapPin, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../components/ui/Button';
import { EmptyState, LoadingState } from '../components/ui/FeedbackState';
import { controlClass, formLabelClass } from '../components/ui/styles';
import SearchInput from '../components/SearchInput';
import ConfirmModal from '../components/ConfirmModal';
import PropertyDetailsModal from '../components/properties/PropertyDetailsModal';
import EngineeringModal from '../components/engineering/EngineeringModal';
import { engineeringDate, engineeringMoney } from '../components/engineering/engineeringForm';
import { engineeringApi } from '../services/engineeringApi';
import EngineeringValidity from '../components/engineering/EngineeringValidity';
import useEngineeringToday from '../hooks/useEngineeringToday';

const emptyResponse = { items: [], total: 0, page: 1, pageSize: 20, cidades: [], summary: { total: 0, pendentes: 0, avaliadas: 0 } };
const isAppraised = item => item.valorAvaliado !== null && item.valorAvaliado !== undefined && item.valorAvaliado !== '';

function Appraisal({ item }) {
  return isAppraised(item) ? <span className="font-semibold text-emerald-700">{engineeringMoney(item.valorAvaliado)}</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800"><Clock3 size={12} aria-hidden="true" />Aguardando avaliação</span>;
}

function RowActions({ item, onEdit, onDelete, onPreview }) {
  return <div className="flex shrink-0 items-center gap-1">
    {item.propertyId && <Button variant="ghost" size="icon" title="Ver dados do imóvel vinculado" aria-label={`Ver dados do imóvel ${item.imovel}`} onClick={() => onPreview(item.propertyId)}><Eye size={17} aria-hidden="true" /></Button>}
    <Button variant="ghost" size="icon" title="Editar engenharia" aria-label={`Editar engenharia ${item.imovel}`} onClick={() => onEdit(item)}><FilePenLine size={17} aria-hidden="true" /></Button>
    <Button variant="ghost" size="icon" title="Excluir engenharia" aria-label={`Excluir engenharia ${item.imovel}`} onClick={() => onDelete(item)} className="text-red-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} aria-hidden="true" /></Button>
  </div>;
}

export default function Engineerings() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [appraisal, setAppraisal] = useState('');
  const [validity, setValidity] = useState('');
  const today = useEngineeringToday();
  const [sort, setSort] = useState('recentes');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState(emptyResponse);
  const [request, setRequest] = useState({ key: null, error: '' });
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [preview, setPreview] = useState(null);
  const requestKey = JSON.stringify([search, city, appraisal, validity, sort, page, revision, today]);
  const loading = request.key !== requestKey;
  const error = loading ? '' : request.error;
  useEffect(() => {
    if (query.trim() === search) return;
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: '20', sort });
    if (search) params.set('q', search);
    if (city) params.set('cidade', city);
    if (appraisal) params.set('avaliacao', appraisal);
    if (validity) params.set('validade', validity);
    engineeringApi(`?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) {
        const lastPage = Math.max(1, Math.ceil(data.total / (data.pageSize || 20)));
        if (page > lastPage) setPage(lastPage);
        setResponse(data); setRequest({ key: requestKey, error: '' });
      } })
      .catch(reason => { if (!controller.signal.aborted) setRequest({ key: requestKey, error: reason.message }); });
    return () => controller.abort();
  }, [search, city, appraisal, validity, sort, page, revision, requestKey]);

  const items = response.items || [];
  const summary = response.summary || emptyResponse.summary;
  const hasFilters = Boolean(search || city || appraisal || validity || sort !== 'recentes');
  const filterCount = Number(Boolean(city)) + Number(Boolean(appraisal)) + Number(Boolean(validity)) + Number(sort !== 'recentes');
  const pages = Math.max(1, Math.ceil(response.total / (response.pageSize || 20)));
  const clearFilters = () => { setQuery(''); setSearch(''); setCity(''); setAppraisal(''); setValidity(''); setSort('recentes'); setPage(1); };
  const changeFilter = setter => event => { setter(event.target.value); setPage(1); };
  const edit = item => setEditor({ item });
  const saved = item => {
    toast.success(editor?.item ? 'Engenharia atualizada.' : 'Engenharia cadastrada.');
    setEditor(null); setPage(1); setRevision(value => value + 1);
    // The list stays governed by the current filters after a save.
    return item;
  };
  const remove = async () => {
    try {
      await engineeringApi(`/${deleting.id}`, { method: 'DELETE' });
      toast.success('Engenharia excluída.');
      if (items.length === 1 && page > 1) setPage(value => value - 1);
      setRevision(value => value + 1);
    } catch (reason) { toast.error(reason.message); }
  };
  return <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 lg:p-7">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h2 className="text-xl font-bold text-slate-900">Imóveis exclusivos</h2><p className="mt-1 text-sm text-slate-500">Acompanhe os pedidos de engenharia e os valores de avaliação.</p></div>
      <Button onClick={() => setEditor({ item: null })} className="w-full sm:w-auto"><Plus size={17} aria-hidden="true" />Nova engenharia</Button>
    </div>

    <section aria-label="Resumo das engenharias" className="grid grid-cols-3 gap-2 sm:gap-4">
      {[{ label: 'Cadastradas', value: summary.total, icon: HardHat, color: 'bg-primary/10 text-primary' }, { label: 'Aguardando avaliação', value: summary.pendentes, icon: Clock3, color: 'bg-amber-50 text-amber-700' }, { label: 'Avaliadas', value: summary.avaliadas, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700' }].map(metric => {
        const Icon = metric.icon;
        return <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-3 sm:flex sm:items-center sm:gap-3 sm:p-4"><span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg sm:mb-0 sm:h-10 sm:w-10 ${metric.color}`}><Icon size={18} aria-hidden="true" /></span><div><p className="text-xl font-bold leading-none text-slate-900 sm:text-2xl">{loading && !summary.total ? '—' : metric.value}</p><p className="mt-1.5 text-[11px] leading-4 text-slate-500 sm:text-xs">{metric.label}</p></div></div>;
      })}
    </section>

    <section aria-label="Pesquisar e filtrar engenharias" className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_180px_180px_220px_140px]">
        <div className="flex items-end gap-2 md:contents"><div className="min-w-0 flex-1"><label htmlFor="engineering-search" className={formLabelClass}>Pesquisar</label><SearchInput id="engineering-search" label="Pesquisar engenharias" placeholder="Buscar imóvel…" value={query} onChange={setQuery} onClear={() => { setQuery(''); setSearch(''); setPage(1); }} onSubmit={() => { setSearch(query.trim()); setPage(1); }} /></div><Button variant="secondary" className="h-11 px-3 md:hidden" aria-expanded={filtersOpen} aria-controls="engineering-filters" onClick={() => setFiltersOpen(value => !value)}><Filter size={16} aria-hidden="true" />Filtros{filterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] text-primary">{filterCount}</span>}</Button></div>
        <div id="engineering-filters" className={`${filtersOpen ? 'grid' : 'hidden'} gap-3 border-t border-slate-100 pt-3 md:contents`}>
        <div><label htmlFor="engineering-city" className={formLabelClass}>Cidade</label><select id="engineering-city" value={city} onChange={changeFilter(setCity)} className={controlClass}><option value="">Todas as cidades</option>{[...new Set([...(response.cidades || []), ...(city ? [city] : [])])].map(name => <option key={name} value={name}>{name}</option>)}</select></div>
        <div><label htmlFor="engineering-appraisal" className={formLabelClass}>Avaliação</label><select id="engineering-appraisal" value={appraisal} onChange={changeFilter(setAppraisal)} className={controlClass}><option value="">Todas as avaliações</option><option value="pendente">Aguardando avaliação</option><option value="avaliada">Avaliadas</option></select></div>
        <div><label htmlFor="engineering-validity" className={formLabelClass}>Validade</label><select id="engineering-validity" value={validity} onChange={changeFilter(setValidity)} className={controlClass}><option value="">Todas as validades</option><option value="validas">Válidas</option><option value="proximas">Próximas do vencimento</option><option value="vencidas">Vencidas</option></select></div>
        <div><label htmlFor="engineering-sort" className={formLabelClass}>Data do pedido</label><select id="engineering-sort" value={sort} onChange={changeFilter(setSort)} className={controlClass}><option value="recentes">Mais recentes</option><option value="antigos">Mais antigas</option></select></div>
        </div>
      </div>
      {hasFilters && <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><p className="text-xs text-slate-500" role="status">{loading ? 'Buscando…' : `${response.total} resultado(s)`}</p><button type="button" onClick={clearFilters} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><X size={14} aria-hidden="true" />Limpar filtros</button></div>}
    </section>

    {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-7 text-center"><p className="text-sm text-red-700">{error}</p><Button variant="secondary" className="mt-4" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} aria-hidden="true" />Tentar novamente</Button></div> : loading ? <LoadingState label="Carregando engenharias…" /> : !items.length ? <EmptyState icon={HardHat} title={hasFilters ? 'Nenhuma engenharia encontrada' : 'Comece pelos seus imóveis exclusivos'} description={hasFilters ? 'Ajuste a busca ou limpe os filtros para ver outros registros.' : 'Cadastre o imóvel, registre o pedido de engenharia e acompanhe o valor avaliado.'} action={<Button variant={hasFilters ? 'secondary' : 'primary'} onClick={hasFilters ? clearFilters : () => setEditor({ item: null })}>{hasFilters ? 'Limpar filtros' : <><Plus size={16} aria-hidden="true" />Cadastrar primeira engenharia</>}</Button>} /> : <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white xl:block">
        <table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Engenharias de imóveis exclusivos</caption><thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><tr><th scope="col" className="w-[24%] px-5 py-3.5">Imóvel / matrícula</th><th scope="col" className="w-[11%] px-3 py-3.5">Cidade</th><th scope="col" className="w-[10%] px-3 py-3.5">Pedido</th><th scope="col" className="w-[16%] px-3 py-3.5">Vencimento</th><th scope="col" className="w-[12%] px-3 py-3.5">Valor do imóvel</th><th scope="col" className="w-[15%] px-3 py-3.5">Valor avaliado</th><th scope="col" className="w-[12%] px-3 py-3.5 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map(item => <tr key={item.id} className="align-top transition hover:bg-slate-50/70"><td className="px-5 py-4"><button type="button" onClick={() => edit(item)} className="break-words text-left font-semibold leading-5 text-slate-800 hover:text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">{item.imovel}</button><p className="mt-1 break-words text-xs text-slate-500">{item.matricula ? `Matrícula ${item.matricula}` : 'Matrícula não informada'}</p>{item.property && <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary"><Building2 size={12} aria-hidden="true" />Vinculado ao mapa{item.property.code ? ` · ${item.property.code}` : ''}</p>}{item.descricao && <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-slate-500">{item.descricao}</p>}</td><td className="break-words px-3 py-4 text-slate-600">{item.cidade || 'Não informada'}</td><td className="px-3 py-4 text-slate-600">{engineeringDate(item.dataPedido)}</td><td className="px-3 py-4"><EngineeringValidity date={item.dataPedido} today={today} /></td><td className="break-words px-3 py-4 font-medium text-slate-700">{engineeringMoney(item.valorImovel)}</td><td className="break-words px-3 py-4"><Appraisal item={item} /></td><td className="px-2 py-2.5"><RowActions item={item} onEdit={edit} onDelete={setDeleting} onPreview={setPreview} /></td></tr>)}</tbody></table>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:hidden">{items.map(item => <article key={item.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><button type="button" onClick={() => edit(item)} className="break-words text-left text-sm font-semibold leading-5 text-slate-800 hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">{item.imovel}</button><p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} className="shrink-0" aria-hidden="true" /><span className="break-words">{item.cidade || 'Cidade não informada'}</span></p></div><Button variant="ghost" size="icon" aria-label={`Editar engenharia ${item.imovel}`} onClick={() => edit(item)}><FilePenLine size={17} aria-hidden="true" /></Button></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><div><dt className="text-slate-500">Matrícula</dt><dd className="mt-1 break-words font-medium text-slate-700">{item.matricula || 'Não informada'}</dd></div><div><dt className="text-slate-500">Pedido de engenharia</dt><dd className="mt-1 font-medium text-slate-700">{engineeringDate(item.dataPedido)}</dd></div><div><dt className="text-slate-500">Valor do imóvel</dt><dd className="mt-1 break-words font-semibold text-slate-700">{engineeringMoney(item.valorImovel)}</dd></div><div><dt className="text-slate-500">Valor avaliado</dt><dd className="mt-1 break-words"><Appraisal item={item} /></dd></div><div className="col-span-2"><dt className="mb-1.5 text-slate-500">Vencimento da engenharia</dt><dd><EngineeringValidity date={item.dataPedido} today={today} /></dd></div></dl>{item.descricao && <p className="mt-4 line-clamp-2 break-words text-xs leading-5 text-slate-500">{item.descricao}</p>}<footer className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">{item.propertyId ? <button type="button" onClick={() => setPreview(item.propertyId)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><Eye size={15} aria-hidden="true" />Ver imóvel vinculado</button> : <span className="text-[11px] text-slate-400">Sem vínculo com o mapa</span>}<Button variant="ghost" size="icon" aria-label={`Excluir engenharia ${item.imovel}`} className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(item)}><Trash2 size={16} aria-hidden="true" /></Button></footer></article>)}</div>
      <nav aria-label="Paginação de engenharias" className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">{response.total} registro(s) · Página {page} de {pages}</p><div className="flex gap-2"><Button variant="secondary" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18} /></Button><Button variant="secondary" size="icon" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight size={18} /></Button></div></nav>
    </>}
    {editor && <EngineeringModal key={editor.item?.id || 'new'} item={editor.item} onClose={() => setEditor(null)} onSaved={saved} />}
    {preview && <PropertyDetailsModal propertyId={preview} onClose={() => setPreview(null)} />}
    <ConfirmModal isOpen={Boolean(deleting)} title="Excluir engenharia?" message={`O registro de ${deleting?.imovel || 'engenharia'} será excluído.`} warning="O imóvel vinculado continuará disponível no mapa." confirmText="Excluir engenharia" confirmColor="red" onClose={() => setDeleting(null)} onConfirm={remove} />
  </div>;
}
