import { useEffect, useMemo, useState } from 'react';
import { prospectApi } from '../../services/prospectApi';

export default function useProspectPostalCode({ street, number, city, neighborhood }, enabled) {
  const address = useMemo(() => {
    if (!enabled || street.trim().length < 3 || !number.trim() || city.trim().length < 3) return null;
    return {
      street: street.trim(), number: number.trim(), city: city.trim(),
      neighborhood: neighborhood.trim(), state: 'SP',
    };
  }, [enabled, street, number, city, neighborhood]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await prospectApi('/lookup-postal-code', {
          method: 'POST', body: address, signal: controller.signal,
        });
        if (!controller.signal.aborted) setResult({ address, ...data });
      } catch {
        if (!controller.signal.aborted) setResult({ address, status: 'unavailable' });
      }
    }, 650);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address]);

  if (!address) return { status: 'idle' };
  return result?.address === address ? result : { status: 'loading' };
}
