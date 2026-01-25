# Exemplos de Integração - Toast Notifications

Este arquivo contém exemplos prontos para copiar e colar ao integrar Toast notifications em outros componentes.

## 1. Componente de Login

```javascript
// frontend/src/pages/Login.jsx

import { useToast } from '../hooks/useToast';

const Login = () => {
  const notify = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        notify.error(error.message || 'Email ou senha incorretos');
        return;
      }

      const data = await response.json();
      notify.success(`Bem-vindo, ${data.user.nome}! 👋`);
      // ... redirect logic
    } catch (error) {
      notify.error('Erro ao conectar ao servidor');
    }
  };

  return (/* ... */);
};
```

## 2. Dashboard - Sincronização de Dados

```javascript
// frontend/src/pages/Dashboard.jsx

import { useToast } from '../hooks/useToast';

const Dashboard = () => {
  const notify = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetch('/api/dashboard').then(r => r.json());
        setData(result);
        notify.success('Dashboard carregado com sucesso! 📊');
      } catch (error) {
        notify.error('Erro ao carregar dashboard');
      }
    };

    loadData();
  }, []);

  return (/* ... */);
};
```

## 3. Settings - Atualizar Configurações

```javascript
// frontend/src/pages/Settings.jsx

import { useToast } from '../hooks/useToast';

const Settings = () => {
  const notify = useToast();

  const handleSaveSettings = async (newSettings) => {
    const toastId = notify.loading('Salvando configurações...');
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        notify.dismiss(toastId);
        notify.success('Configurações atualizadas com sucesso! ⚙️');
      } else {
        notify.dismiss(toastId);
        notify.error('Erro ao salvar configurações');
      }
    } catch (error) {
      notify.dismiss(toastId);
      notify.error('Erro ao conectar ao servidor');
    }
  };

  return (/* ... */);
};
```

## 4. ClientsList - Ações em Massa

```javascript
// frontend/src/pages/ClientsList.jsx

import { useToast } from '../hooks/useToast';

const ClientsList = () => {
  const notify = useToast();

  const handleExportClients = async () => {
    notify.promise(
      async () => {
        const response = await fetch('/api/clients/export');
        if (!response.ok) throw new Error('Erro ao exportar');
        // ... download logic
      },
      {
        loading: 'Exportando clientes...',
        success: 'Clientes exportados com sucesso! 📥',
        error: 'Erro ao exportar clientes'
      }
    );
  };

  const handleDeleteClient = async (clientId, clientName) => {
    try {
      await fetch(`/api/clients/${clientId}`, { method: 'DELETE' });
      notify.success(`Cliente ${clientName} deletado com sucesso! 🗑️`);
    } catch (error) {
      notify.error('Erro ao deletar cliente');
    }
  };

  return (/* ... */);
};
```

## 5. UserManagement - Gerenciar Usuários

```javascript
// frontend/src/pages/UserManagement.jsx

import { useToast } from '../hooks/useToast';

const UserManagement = () => {
  const notify = useToast();

  const handleChangeUserRole = async (userId, newRole) => {
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      });
      notify.success(`Cargo alterado para ${newRole} ✅`);
    } catch (error) {
      notify.error('Erro ao atualizar cargo do usuário');
    }
  };

  const handleResetPassword = async (userId, userEmail) => {
    notify.promise(
      async () => {
        await fetch(`/api/users/${userId}/reset-password`, { method: 'POST' });
      },
      {
        loading: 'Enviando email de redefinição...',
        success: `Email enviado para ${userEmail}! 📧`,
        error: 'Erro ao enviar email'
      }
    );
  };

  return (/* ... */);
};
```

## 6. PdfEditor - Edição de PDF

```javascript
// frontend/src/pages/PdfEditor.jsx

import { useToast } from '../hooks/useToast';

const PdfEditor = () => {
  const notify = useToast();

  const handleUploadPdf = async (file) => {
    if (file.size > 10 * 1024 * 1024) {
      notify.warning('Arquivo muito grande. Máximo 10MB');
      return;
    }

    notify.promise(
      async () => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/pdf/upload', {
          method: 'POST',
          body: formData
        });
        if (!response.ok) throw new Error('Erro ao enviar');
      },
      {
        loading: 'Enviando PDF...',
        success: `${file.name} enviado com sucesso! 📤`,
        error: 'Erro ao enviar PDF'
      }
    );
  };

  const handleDownloadPdf = (fileName) => {
    notify.success(`${fileName} baixado com sucesso! ✅`);
  };

  return (/* ... */);
};
```

## 7. CepSearch - Busca de CEP

```javascript
// frontend/src/pages/CepSearch.jsx

import { useToast } from '../hooks/useToast';

const CepSearch = () => {
  const notify = useToast();

  const handleSearchCep = async (cep) => {
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      notify.warning('CEP inválido. Digite 8 números');
      return;
    }

    try {
      const response = await fetch(`https://brasilapi.com.br/api/address/search?cep=${cleanCep}`);
      const data = await response.json();
      
      if (data.length === 0) {
        notify.error('CEP não encontrado');
        return;
      }

      notify.success(`${data[0].city} encontrado! 📍`);
      setAddress(data[0]);
    } catch (error) {
      notify.error('Erro ao buscar CEP');
    }
  };

  return (/* ... */);
};
```

## 8. ChangePasswordModal - Mudar Senha

```javascript
// frontend/src/components/ChangePasswordModal.jsx

import { useToast } from '../hooks/useToast';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const notify = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      notify.warning('As senhas não correspondem');
      return;
    }

    if (newPassword.length < 8) {
      notify.warning('A senha deve ter no mínimo 8 caracteres');
      return;
    }

    try {
      await fetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      notify.success('Senha alterada com sucesso! 🔐');
      onClose();
    } catch (error) {
      notify.error('Erro ao alterar senha');
    }
  };

  return (/* ... */);
};
```

## 9. ActivityLog - Registrar Atividades

```javascript
// frontend/src/hooks/useActivityLog.js

import { useToast } from './useToast';

const useActivityLog = () => {
  const notify = useToast();

  const logActivity = async (description) => {
    try {
      const response = await fetch('/api/activity-log', {
        method: 'POST',
        body: JSON.stringify({ description })
      });

      if (!response.ok) {
        console.warn('Erro ao registrar atividade');
      }
    } catch (error) {
      // Falha silenciosa - não notifica o usuário
      console.error('Erro ao registrar atividade:', error);
    }
  };

  return { logActivity };
};
```

## 10. Validação em Tempo Real

```javascript
// frontend/src/components/ModernInput.jsx

import { useToast } from '../hooks/useToast';

const ModernInput = ({ validation, onValidation, ...props }) => {
  const notify = useToast();

  const handleBlur = (e) => {
    const { value } = e.target;
    
    if (validation) {
      const isValid = validation(value);
      
      if (!isValid) {
        notify.warning('Formato inválido');
        onValidation?.(false);
      } else {
        onValidation?.(true);
      }
    }
  };

  return (
    <input
      {...props}
      onBlur={handleBlur}
    />
  );
};
```

## Padrões Recomendados

### Pattern 1: Loading com Dismis

```javascript
const toastId = notify.loading('Processando...');

try {
  await doSomething();
  notify.dismiss(toastId);
  notify.success('Concluído!');
} catch (error) {
  notify.dismiss(toastId);
  notify.error('Erro!');
}
```

### Pattern 2: Promise Toast

```javascript
notify.promise(asyncFunction, {
  loading: 'Processando...',
  success: 'Sucesso!',
  error: 'Erro!'
});
```

### Pattern 3: Validação Inline

```javascript
if (!isValid) {
  notify.warning('Campo obrigatório');
  return;
}
```

### Pattern 4: Erro com Contexto

```javascript
catch (error) {
  const message = error.response?.data?.message || 'Erro ao processar';
  notify.error(message);
}
```

## Checklist de Implementação

Para adicionar Toast a um novo componente:

- [ ] Importar `useToast` do hook
- [ ] Chamar `const notify = useToast()` na função principal
- [ ] Adicionar notificações de sucesso após ações
- [ ] Adicionar notificações de erro em blocos `catch`
- [ ] Adicionar notificações de warning para validações
- [ ] Usar `notify.promise()` para operações assíncronas longas
- [ ] Testar com diferentes tipos de toast
- [ ] Verificar duração e posicionamento das notificações
- [ ] Documentar as notificações adicionadas
