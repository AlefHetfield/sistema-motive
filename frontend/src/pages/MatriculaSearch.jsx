import { useEffect, useState } from 'react';
import { Search, MapPin, FileSearch, Copy, SlidersHorizontal, ChevronLeft, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { fetchMatriculaMetadata, searchMatriculas } from '../services/api';

const initialFilters = { street: '', number: '', neighborhood: '', city: 'sumare', lot: '', block: '', registration: '', fiscal: '', q: '' };
const inputClass = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';
const formatCount = value => Number(value).toLocaleString('pt-BR');

function Field({ name, label, placeholder, filters, onChange }) {
  return <label className="block text-sm font-medium text-gray-700" htmlFor={`matricula-${name}`}>
    {label}
    <input id={`matricula-${name}`} className={inputClass} value={filters[name]} maxLength={180}
      placeholder={placeholder} onChange={event => onChange(name, event.target.value)} autoComplete="off" />
  </label>;
}

export default function MatriculaSearch() {
  const [filters, setFilters] = useState(initialFilters);
  const [advanced, setAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [metadata, setMetadata] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metadataError, setMetadataError] = useState('');
  const [retry, setRetry] = useState(0);
  const hasQuery = Object.entries(filters).some(([key, value]) => key !== 'city' && value.trim());

  useEffect(() => {
    const controller = new AbortController();
    fetchMatriculaMetadata(controller.signal).then(data => {
      setMetadata(data);
      setMetadataError('');
    }).catch(err => { if (err.name !== 'AbortError') setMetadataError(err.message); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (!hasQuery) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await searchMatriculas({ ...filters, page }, controller.signal);
        if (!controller.signal.aborted) setResult(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, page, hasQuery, retry]);

  const change = (name, value) => {
    setFilters(current => ({ ...current, [name]: value }));
    setPage(1);
    setResult(null);
    setError('');
    setLoading(false);
  };
  const reset = () => {
    setFilters(initialFilters);
    setPage(1);
    setResult(null);
    setError('');
    setLoading(false);
  };
  const copy = async value => {
    try { await navigator.clipboard.writeText(value); toast.success('Copiado para a área de transferência.'); }
    catch { toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.'); }
  };
  const movePage = next => { setResult(null); setPage(next); };
  const fieldProps = { filters, onChange: change };

  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <section className="relative overflow-hidden rounded-3xl bg-secondary p-6 text-white md:p-8">
      <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border-[35px] border-white/5" />
      <div className="relative max-w-3xl">
        <div className="mb-4 flex items-center gap-2 text-sm text-white/75"><FileSearch size={18} /> Consulta de imóveis urbanos</div>
        <h2 className="text-2xl font-bold md:text-3xl">Do endereço à matrícula.</h2>
        <p className="mt-3 text-sm leading-6 text-white/75">Comece pelo nome da rua. Acrescente número, bairro ou lote e quadra para encontrar o imóvel certo.</p>
        {metadata && <div className="mt-5 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-white/10 px-3 py-2">{formatCount(metadata.total)} registros na base</span>
          <span className="rounded-full bg-white/10 px-3 py-2">Busca sem acentos e sem diferenciar maiúsculas</span>
        </div>}
      </div>
    </section>

    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6" aria-label="Filtros de busca">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Field name="street" label="Rua ou avenida" placeholder="Ex.: Rua Jatobá" {...fieldProps} />
        <Field name="number" label="Número do imóvel" placeholder="Ex.: 120 ou s/n" {...fieldProps} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field name="neighborhood" label="Bairro / loteamento" placeholder="Ex.: Jardim Basilicata" {...fieldProps} />
        <label className="block text-sm font-medium text-gray-700" htmlFor="matricula-city">Cidade
          <select id="matricula-city" className={inputClass} value={filters.city} onChange={event => change('city', event.target.value)}>
            <option value="">Todas as cidades</option>
            <option value="sumare">Sumaré</option>
            {(metadata?.cities || []).filter(city => city.value !== 'sumare').map(city => <option key={city.value} value={city.value}>{city.label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} aria-controls="matricula-advanced"
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:bg-primary/5">
          <SlidersHorizontal size={16} /> {advanced ? 'Ocultar filtros adicionais' : 'Lote, quadra e outras informações'}
        </button>
        <button type="button" onClick={reset} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-50"><RotateCcw size={15} /> Limpar busca</button>
      </div>
      <div id="matricula-advanced" hidden={!advanced}>
        <div className="mt-4 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field name="lot" label="Lote" placeholder="Ex.: 04-A" {...fieldProps} />
          <Field name="block" label="Quadra" placeholder="Ex.: 11" {...fieldProps} />
          <Field name="registration" label="Matrícula" placeholder="Número da matrícula" {...fieldProps} />
          <Field name="fiscal" label="Indicador fiscal" placeholder="Com ou sem pontuação" {...fieldProps} />
        </div>
        <div className="mt-4"><Field name="q" label="Informações complementares" placeholder="Busque palavras em qualquer campo da base" {...fieldProps} /></div>
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-500">Os resultados atualizam enquanto você digita. Os filtros são combinados; número, lote e quadra buscam o valor completo.</p>
    </section>

    {(error || metadataError) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <span>{error || metadataError}</span><button type="button" onClick={() => setRetry(value => value + 1)} className="font-semibold underline">Tentar novamente</button>
    </div>}

    <div aria-live="polite" aria-busy={loading}>
      {!hasQuery ? <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center md:p-12">
        <Search className="mx-auto mb-4 text-primary" size={32} />
        <h3 className="text-lg font-semibold text-gray-900">Qual imóvel você está procurando?</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">Informe uma rua ou use os filtros adicionais. Para imóveis sem número, combine bairro, lote e quadra.</p>
      </section> : !error && !result ? <div className="flex items-center justify-center gap-3 p-10 text-sm text-gray-500"><Loader2 className="animate-spin" size={20} /> Buscando matrículas…</div> : result && !error ? <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900">{formatCount(result.total)} {result.total === 1 ? 'registro encontrado' : 'registros encontrados'}</h3>
          {result.pages > 0 && <span className="text-sm text-gray-500">Página {result.page} de {formatCount(result.pages)}</span>}
        </div>
        {result.total > 1 && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Há mais de um registro compatível. Confira número, lote e quadra antes de escolher a matrícula.</p>}
        {result.suggestions.length > 1 && !filters.street && <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Refinar por rua:</span>
          {result.suggestions.map(street => <button type="button" key={street} onClick={() => change('street', street)} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:border-primary hover:text-primary">{street}</button>)}
        </div>}
        {result.total === 0 && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <FileSearch className="mx-auto mb-3 text-gray-400" size={30} />
          <h3 className="font-semibold text-gray-900">Nenhum registro com esses filtros</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500">Tente apenas parte do nome da rua, retire o número ou selecione todas as cidades. A base também tem endereços antigos e imóveis sem numeração.</p>
        </div>}
        <div className="grid gap-4 xl:grid-cols-2">
          {result.results.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/80 p-5">
              <div><p className="text-xs font-medium uppercase tracking-wider text-gray-500">Matrícula</p>
                <p className={`mt-1 font-bold ${item.matriculaDisponivel ? 'text-2xl text-primary' : 'text-lg text-amber-700'}`}>{item.matriculaDisponivel ? item.matricula : 'Não informada na base'}</p>
              </div>
              {item.matriculaDisponivel && <button type="button" onClick={() => copy(item.matricula)} aria-label={`Copiar matrícula ${item.matricula}`} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary"><Copy size={15} /> Copiar</button>}
            </div>
            <div className="p-5">
              <div className="flex items-start gap-2"><MapPin size={18} className="mt-0.5 shrink-0 text-primary" /><div className="min-w-0">
                <h4 className="break-words font-semibold text-gray-900">{item.endereco || 'Logradouro não informado'}{item.numero ? `, ${item.numero}` : ' · Número não informado'}</h4>
                <p className="mt-1 text-sm text-gray-500">{item.bairro || 'Bairro não informado'} · {item.cidade && item.cidade !== '0' ? item.cidade : 'Cidade não informada'}</p>
              </div></div>
              <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3">
                {[['Lote', item.lote], ['Quadra', item.quadra], ['Imóvel', item.imovel]].map(([label, value]) => <div key={label}><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-gray-800">{value || 'Não informado'}</dd></div>)}
              </dl>
              <details className="mt-4 text-sm text-gray-600"><summary className="cursor-pointer font-medium hover:text-primary">Ver dados do registro</summary>
                <dl className="mt-3 space-y-2 break-words text-xs"><div><dt className="inline font-semibold">Indicador fiscal: </dt><dd className="inline">{item.indicadorFiscal || 'Não informado'}</dd></div>
                  <div><dt className="inline font-semibold">Tipo: </dt><dd className="inline">{item.tipoImovel || 'Não informado'}</dd></div>
                  <div><dt className="inline font-semibold">Fonte: </dt><dd className="inline">{metadata?.source || 'Planilha importada'}, linha {item.sourceRow}</dd></div>
                </dl>
                <button type="button" onClick={() => copy(`Matrícula: ${item.matriculaDisponivel ? item.matricula : 'Não informada'}\nEndereço: ${item.endereco}, ${item.numero || 'Número não informado'}\nBairro: ${item.bairro}\nCidade: ${item.cidade}\nLote: ${item.lote}\nQuadra: ${item.quadra}\nIndicador fiscal: ${item.indicadorFiscal}`)} className="mt-3 flex items-center gap-2 rounded-lg py-2 font-medium text-primary"><Copy size={14} /> Copiar dados do imóvel</button>
              </details>
            </div>
          </article>)}
        </div>
        {result.pages > 1 && <nav aria-label="Paginação dos resultados" className="mt-6 flex items-center justify-center gap-4">
          <button type="button" disabled={result.page <= 1} onClick={() => movePage(result.page - 1)} className="flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm disabled:opacity-40"><ChevronLeft size={16} /> Anterior</button>
          <span className="text-sm text-gray-600">{result.page} / {formatCount(result.pages)}</span>
          <button type="button" disabled={result.page >= result.pages} onClick={() => movePage(result.page + 1)} className="flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm disabled:opacity-40">Próxima <ChevronRight size={16} /></button>
        </nav>}
      </> : null}
    </div>
    <p className="pb-4 text-xs leading-5 text-gray-500">Consulta à planilha fornecida{metadata ? `: ${metadata.source}` : ''}. Os dados refletem essa base, sem atualização automática pelo cartório. Registros com matrícula zero aparecem como não informados.</p>
  </div>;
}
