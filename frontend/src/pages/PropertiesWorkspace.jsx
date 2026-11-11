import { lazy, Suspense, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HardHat, MapPinned } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PrivateRoute from '../components/PrivateRoute';
import LoadingAnimation from '../components/LoadingAnimation';

const PropertiesMap = lazy(() => import('./PropertiesMap'));
const Engineerings = lazy(() => import('./Engineerings'));

export default function PropertiesWorkspace() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManageEngineerings = ['ADM', 'ASSISTENTE'].includes(user?.role);
  const activeTab = searchParams.get('tab') === 'engineerings' ? 'engineerings' : 'map';
  const [visitedTabs, setVisitedTabs] = useState({ [activeTab]: true });
  const [engineeringRevision, setEngineeringRevision] = useState(0);
  const [toolbarTarget, setToolbarTarget] = useState(null);

  // Retain each visited screen so switching tabs preserves its controls and map camera.
  if (!visitedTabs[activeTab]) {
    setVisitedTabs({ ...visitedTabs, [activeTab]: true });
  }

  const tabUrl = tab => {
    const params = new URLSearchParams(searchParams);
    params.delete('engineering');
    params.delete('newProperty');
    if (tab === 'engineerings') params.set('tab', 'engineerings');
    else params.delete('tab');
    return { pathname: '/properties-map', search: params.toString() };
  };

  const openEngineering = (key, id) => {
    setSearchParams(current => {
      const params = new URLSearchParams(current);
      params.delete('engineering');
      params.delete('newProperty');
      params.set('tab', 'engineerings');
      params.set(key, String(id));
      return params;
    });
  };

  if (activeTab === 'engineerings' && !canManageEngineerings) {
    return <PrivateRoute requiredRole={['ADM', 'ASSISTENTE']} />;
  }

  return <div className="flex h-full min-h-[400px] min-w-0 flex-col overflow-hidden">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 lg:px-5">
      <nav aria-label="Áreas de imóveis" className="flex min-w-0 flex-1 gap-1 lg:flex-none">
        {[{ value: 'map', label: 'Mapa', icon: MapPinned }, ...(canManageEngineerings ? [{ value: 'engineerings', label: 'Engenharias', icon: HardHat }] : [])].map(tab => {
          const Icon = tab.icon;
          return <Link key={tab.value} id={`properties-tab-${tab.value}`} to={tabUrl(tab.value)} aria-current={activeTab === tab.value ? 'page' : undefined}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30 sm:flex-none ${activeTab === tab.value ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
            <Icon size={17} aria-hidden="true" />{tab.label}
          </Link>;
        })}
      </nav>
      <div ref={setToolbarTarget} role="group" aria-label="Ações da área de imóveis" className="hidden shrink-0 items-center lg:flex" />
    </header>
    <section aria-labelledby="properties-tab-map" hidden={activeTab !== 'map'} className={`${activeTab === 'map' ? 'block' : 'hidden'} min-h-0 min-w-0 flex-1`}>
      {visitedTabs.map && <Suspense fallback={<LoadingAnimation message="Carregando mapa…" />}>
        <PropertiesMap active={activeTab === 'map'} toolbarTarget={toolbarTarget} engineeringRevision={engineeringRevision}
          onOpenEngineering={item => openEngineering('engineering', item.id)}
          onCreateEngineering={property => openEngineering('newProperty', property.id)} />
      </Suspense>}
    </section>
    {canManageEngineerings && <section aria-labelledby="properties-tab-engineerings" hidden={activeTab !== 'engineerings'} className={`${activeTab === 'engineerings' ? 'block' : 'hidden'} min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain`}>
      {visitedTabs.engineerings && <Suspense fallback={<LoadingAnimation message="Carregando engenharias…" />}>
        <Engineerings active={activeTab === 'engineerings'} toolbarTarget={toolbarTarget} onChanged={() => setEngineeringRevision(value => value + 1)} />
      </Suspense>}
    </section>}
  </div>;
}
