import { useEffect, useState } from 'react';
import { engineeringToday } from '../utils/engineeringValidity';

export default function useEngineeringToday() {
  const [today, setToday] = useState(engineeringToday);
  useEffect(() => {
    const refresh = () => setToday(engineeringToday());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}
