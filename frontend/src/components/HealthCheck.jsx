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
    return <div className="text-sm text-gray-500">Verificando status da API…</div>;
  }

  const ok = status.ok;
  const color = ok ? 'text-green-600' : 'text-red-600';
  const label = ok ? 'Online' : `Offline${status.status ? ` (${status.status})` : ''}`;

  return (
    <div className="mb-4 p-3 border rounded-md bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">Status da API</span>
        <span className={`font-semibold ${color}`}>{label}</span>
      </div>
      {status.database && (
        <div className="mt-2 text-sm text-gray-700">DB: {status.database}</div>
      )}
      {status.message && (
        <div className="mt-2 text-xs text-gray-500">{status.message}</div>
      )}
    </div>
  );
}
