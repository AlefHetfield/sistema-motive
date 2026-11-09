import { useEffect, useState } from 'react';
import { ArrowUpRight, HardHat, Loader2, Plus, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import useEngineeringToday from '../../hooks/useEngineeringToday';
import { engineeringApi } from '../../services/engineeringApi';
import { getEngineeringEntry } from '../../utils/engineeringEntry';
import { engineeringMoney } from './engineeringForm';
import EngineeringValidity from './EngineeringValidity';

export default function PropertyEngineeringSummary({ property, onOpen, onCreate, revision = 0, active = true }) {
  const propertyId = property?.id;
  const today = useEngineeringToday();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ key: null, item: null, total: 0, error: '' });
  const requestKey = JSON.stringify([propertyId, revision, retry]);

  useEffect(() => {
    if (!active || !propertyId) return;
    const controller = new AbortController();
    engineeringApi(`?propertyId=${propertyId}&pageSize=1`, { signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, item: response.items[0] || null, total: response.total, error: '' });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, item: null, total: 0, error: error.message });
      });
    return () => controller.abort();
  }, [active, propertyId, requestKey]);

  if (!active || !propertyId) return null;

  const loading = result.key !== requestKey;
  const item = result.item;
  const entry = item ? getEngineeringEntry(item) : null;

  return <section aria-label="Engenharia do imóvel" className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
      <HardHat size={17} className="shrink-0 text-primary" aria-hidden="true" />Engenharia
    </h3>
    {loading ? <p role="status" className="mt-3 flex items-center gap-2 text-xs text-slate-500">
      <Loader2 size={14} className="animate-spin" aria-hidden="true" />Consultando engenharia…
    </p> : result.error ? <div className="mt-3">
      <p role="alert" className="text-xs leading-5 text-red-600">{result.error}</p>
      <Button variant="ghost" size="sm" className="mt-1 px-0 text-primary" onClick={() => setRetry(value => value + 1)}>
        <RefreshCw size={13} aria-hidden="true" />Tentar novamente
      </Button>
    </div> : item ? <div className="mt-3 space-y-3">
      <div>
        <p className="break-words text-xs font-semibold leading-5 text-slate-700">{item.imovel}</p>
        {result.total > 1 && <p className="mt-1 text-[11px] leading-4 text-slate-500">{result.total} registros vinculados · pedido mais recente</p>}
      </div>
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Valor de entrada</p>
        <strong className={`mt-1 block break-words leading-6 ${entry === null ? 'text-xs font-medium text-slate-500' : 'text-lg font-bold text-primary'}`}>
          {entry === null ? 'Aguardando valores' : engineeringMoney(entry)}
        </strong>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0">
          <dt className="text-slate-500">Valor avaliado</dt>
          <dd className="mt-1.5 break-words font-semibold leading-5 text-slate-700">{engineeringMoney(item.valorAvaliado)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="mb-1.5 text-slate-500">Vencimento</dt>
          <dd><EngineeringValidity date={item.dataPedido} today={today} /></dd>
        </div>
      </dl>
      <Button variant="primarySoft" size="sm" className="w-full" onClick={() => onOpen(item)}>
        Ver engenharia<ArrowUpRight size={14} aria-hidden="true" />
      </Button>
    </div> : <div className="mt-3">
      <p className="text-xs leading-5 text-slate-500">Cadastre o pedido e acompanhe a avaliação deste imóvel.</p>
      <Button variant="primarySoft" size="sm" className="mt-3 w-full" onClick={() => onCreate(property)}>
        <Plus size={14} aria-hidden="true" />Cadastrar engenharia
      </Button>
    </div>}
  </section>;
}
