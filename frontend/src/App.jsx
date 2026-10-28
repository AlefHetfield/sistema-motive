import { lazy, Suspense } from 'react';
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

import PrivateRoute from './components/PrivateRoute';
import LoadingAnimation from './components/LoadingAnimation';
import useMobileLayout from './hooks/useMobileLayout';
import NoteSyncBoundary from './components/notes/NoteSyncBoundary';

const AppLayout = lazy(() => import('./components/AppLayout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClientsList = lazy(() => import('./pages/ClientsList'));
const Engineerings = lazy(() => import('./pages/Engineerings'));
const PdfEditor = lazy(() => import('./pages/PdfEditor'));
const ReceiptGenerator = lazy(() => import('./pages/ReceiptGenerator'));
const MatriculaSearch = lazy(() => import('./pages/MatriculaSearch'));
const Settings = lazy(() => import('./pages/Settings'));
const HousingSimulator = lazy(() => import('./pages/HousingSimulator'));
const ContractGenerator = lazy(() => import('./pages/ContractGenerator'));
const PropertiesMap = lazy(() => import('./pages/PropertiesMap'));
const Tasks = lazy(() => import('./pages/Tasks'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const Notes = lazy(() => import('./pages/Notes'));

// A data router lets the note editor protect pending changes on links and browser Back.
const router = createBrowserRouter(createRoutesFromElements(
  <>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
      <Route index element={<Navigate to="/pdf-editor" replace />} />
      <Route path="dashboard" element={<PrivateRoute requiredRole="ADM"><Dashboard /></PrivateRoute>} />
      <Route path="clients" element={<PrivateRoute><ClientsList /></PrivateRoute>} />
      <Route path="engineerings" element={<PrivateRoute requiredRole={['ADM', 'ASSISTENTE']}><Engineerings /></PrivateRoute>} />
      <Route path="pdf-editor" element={<PdfEditor />} />
      <Route path="receipt-generator" element={<ReceiptGenerator />} />
      <Route path="contract-generator" element={<ContractGenerator />} />
      <Route path="properties-map" element={<PropertiesMap />} />
      <Route path="simulador" element={<HousingSimulator />} />
      <Route path="matriculas" element={<MatriculaSearch />} />
      <Route path="tasks" element={<Tasks />} />
      <Route path="notes" element={<Notes />} />
      <Route path="agenda" element={<CalendarPage />} />
      <Route path="settings" element={<Settings />} />
      <Route path="users" element={<PrivateRoute requiredRole="ADM"><Navigate to="/settings?tab=users" replace /></PrivateRoute>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </>
));

function AppContent() {
  const mobile = useMobileLayout();
  const { resolvedTheme } = useTheme();

  return (
    <AuthProvider>
        <Toaster 
          position={mobile ? 'top-center' : 'top-right'}
          theme={resolvedTheme}
          richColors
          expand={true}
          closeButton
          duration={3000}
        />
        <Suspense fallback={<LoadingAnimation fullScreen message="Carregando página..." />}>
          <NoteSyncBoundary><RouterProvider router={router} /></NoteSyncBoundary>
        </Suspense>
    </AuthProvider>
  );
}

function App() {
  return <ThemeProvider><AppContent /></ThemeProvider>;
}

export default App;
