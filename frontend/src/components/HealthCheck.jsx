import { useEffect, useState } from 'react';
import { getHealth } from '../services/api';

export default function HealthCheck() {
  const [status, setStatus] = useState({ loading: true });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getHealth();
        if (mounted) setStatus({ loading: false, ...res });
      } catch (err) {
        if (mounted) setStatus({ loading: false, ok: false, message: err.message });
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (status.loading) {
    return <span role="status" className="inline-flex min-h-9 items-center gap-2 text-xs text-gray-500"><span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />Verificando conexão</span>;
  }

  const ok = status.ok;
  const color = ok ? 'text-emerald-700' : 'text-red-700';
  const label = ok ? 'Conectado' : 'Sem conexão';

  return (
    <details className="relative shrink-0">
      <summary aria-label={`Conexão com o servidor: ${label}`} className={`inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden ${color}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />{label}
      </summary>
      <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-lg">
        <p className="font-semibold text-gray-900">Conexão com o servidor</p>
        <p className={`mt-1 ${color}`}>{ok ? 'Servidor disponível.' : 'Não foi possível acessar o servidor.'}</p>
        {status.database && <p className="mt-2 text-xs text-gray-500">Banco de dados: {status.database}</p>}
        {status.message && <p className="mt-2 break-words text-xs text-gray-500">{status.message}</p>}
      </div>
    </details>
  );
}
