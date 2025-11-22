import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import PrivateRoute from './components/PrivateRoute';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientsList from './pages/ClientsList';
import PdfEditor from './pages/PdfEditor';
import ReceiptGenerator from './pages/ReceiptGenerator';
import CepSearch from './pages/CepSearch';
import Settings from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            {/* Rota inicial padrão após o login */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clients" element={<ClientsList />} />
            <Route path="pdf-editor" element={<PdfEditor />} />
            <Route path="receipt-generator" element={<ReceiptGenerator />} />
            <Route path="cep-search" element={<CepSearch />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Fallback para rotas não encontradas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
