import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { NoteSyncProvider } from '../../context/NoteSyncContext';
import './noteStyles.css';

export default function NoteSyncBoundary({ children }) {
  const { user } = useAuth();
  const [supported] = useState(() => Boolean(globalThis.indexedDB && globalThis.navigator?.locks));
  // Browsers without durable storage/coordination retain the blocking editor.
  return supported ? <NoteSyncProvider key={user?.id || 'guest'} userId={user?.id}>{children}</NoteSyncProvider> : children;
}
