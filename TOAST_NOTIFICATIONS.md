# Sistema de Notificações Toast 🔔

Este documento descreve como usar o sistema de notificações Toast implementado no Sistema Motive.

## Visão Geral

O sistema usa a biblioteca **Sonner** para exibir notificações não-bloqueantes, elegantes e responsivas. As notificações aparecem no canto superior direito da tela.

## Instalação

A biblioteca Sonner já está instalada. Para verificar:

```bash
npm list sonner
```

## Uso Básico

### 1. Importar o Hook

```javascript
import { useToast } from '../hooks/useToast';
```

### 2. Usar em um Componente

```javascript
const MyComponent = () => {
  const notify = useToast();

  const handleSave = () => {
    notify.success('Dados salvos com sucesso! ✅');
  };

  return <button onClick={handleSave}>Salvar</button>;
};
```

## Métodos Disponíveis

### Notificações Básicas

```javascript
// Sucesso
notify.success('Operação realizada com sucesso! 🎉');

// Erro
notify.error('Ocorreu um erro ao processar sua solicitação');

// Aviso
notify.warning('Atenção: Esta ação não pode ser desfeita');

// Informação
notify.info('Suas alterações serão sincronizadas em breve');

// Carregamento
const toastId = notify.loading('Processando...');

// Dismissar específico (depois de loading)
notify.dismiss(toastId);

// Dismissar todas
notify.dismissAll();
```

### Promise Toast

Para operações assíncronas:

```javascript
const fetchData = async () => {
  return await fetch('/api/data').then(r => r.json());
};

notify.promise(fetchData, {
  loading: 'Carregando dados...',
  success: 'Dados carregados com sucesso!',
  error: 'Erro ao carregar dados'
});
```

### Toast Customizado

```javascript
notify.custom(<CustomComponent />, {
  duration: 5000,
  icon: '🔧'
});
```

## Atalhos Pré-configurados

```javascript
import { toastNotifications } from '../hooks/useToast';

// Mensagens pré-configuradas comuns
toastNotifications.saved();           // "Dados salvos com sucesso!"
toastNotifications.deleted();         // "Item deletado com sucesso!"
toastNotifications.updated();         // "Dados atualizados com sucesso!"
toastNotifications.added();           // "Item adicionado com sucesso!"
toastNotifications.errorLoading();    // "Erro ao carregar dados"
toastNotifications.errorSaving();     // "Erro ao salvar dados"
toastNotifications.unauthorized();    // "Acesso negado"
```

## Usar como Função Direta

```javascript
import { notify } from '../hooks/useToast';

// Não precisa usar hook
notify.success('Sucesso!');
notify.error('Erro!');
```

## Exemplos de Implementação

### 1. ClientModal - Salvar Cliente

```javascript
const ClientModal = ({ isOpen, onClose, onSave, clientToEdit }) => {
  const notify = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const savedClient = await saveClient(formData);
      notify.success(`Cliente ${savedClient.nome} salvo com sucesso! 🎉`);
      onClose();
    } catch (error) {
      notify.error(`Erro ao salvar: ${error.message}`);
    }
  };

  return (/* ... */);
};
```

### 2. UserManagement - CRUD de Usuários

```javascript
const UserManagement = () => {
  const notify = useToast();

  const handleDeleteUser = async (userId) => {
    try {
      await deleteUser(userId);
      notify.success('Usuário deletado com sucesso! 🗑️');
    } catch (error) {
      notify.error('Erro ao deletar usuário');
    }
  };

  return (/* ... */);
};
```

### 3. ReceiptGenerator - Gerar PDF

```javascript
const handleGeneratePdf = () => {
  try {
    // ... código de geração do PDF
    doc.save('recibo.pdf');
    notify.success('Recibo gerado com sucesso! 📄');
  } catch (error) {
    notify.error(`Erro ao gerar PDF: ${error.message}`);
  }
};
```

### 4. Validação com Toast

```javascript
const handleCnpjSearch = async () => {
  const cnpj = empresaCnpj.replace(/\D/g, '');
  
  if (cnpj.length !== 14) {
    notify.warning('CNPJ inválido. Digite 14 números.');
    return;
  }

  notify.loading('Buscando CNPJ...');
  try {
    const data = await fetch(`/api/cnpj/${cnpj}`).then(r => r.json());
    notify.success('CNPJ encontrado! ✅');
  } catch (error) {
    notify.error('CNPJ não encontrado');
  }
};
```

## Configuração (Toaster)

O Toaster está configurado em `App.jsx`:

```javascript
import { Toaster } from 'sonner';

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"           // Canto da tela
        theme="light"                  // Tema
        richColors                     // Cores ricas por tipo
        expand={true}                  // Expandir ao hover
        closeButton                    // Botão de fechar
        duration={3000}                // Duração padrão (ms)
      />
      {/* ... resto do app */}
    </>
  );
}
```

## Boas Práticas

1. **Use ícones significativos**
   ```javascript
   notify.success('Salvo com sucesso! ✅');
   notify.error('Erro ao processar 😞');
   ```

2. **Mensagens claras e concisas**
   ```javascript
   // ✅ Bom
   notify.success('Cliente adicionado!');
   
   // ❌ Evitar
   notify.success('A operação de adição de um novo cliente foi completada com êxito no banco de dados');
   ```

3. **Use contexto do usuário**
   ```javascript
   // ✅ Bom
   notify.success(`${cliente.nome} foi salvo com sucesso!`);
   
   // ❌ Evitar
   notify.success('Salvo com sucesso');
   ```

4. **Trate erros apropriadamente**
   ```javascript
   try {
     await saveData(data);
     notify.success('Dados salvos!');
   } catch (error) {
     notify.error(error.message);
   }
   ```

5. **Use promiseToast para operações longas**
   ```javascript
   notify.promise(fetchLargeData, {
     loading: 'Carregando...',
     success: 'Pronto!',
     error: 'Erro ao carregar'
   });
   ```

## Tipos de Notificação

| Tipo | Uso | Exemplo |
|------|-----|---------|
| success | Operação bem-sucedida | Salvar, deletar, enviar |
| error | Erro na operação | Validação falhou, servidor offline |
| warning | Alerta/confirmação | Ação irreversível, campo obrigatório |
| info | Informação neutra | Sincronização em progresso |
| loading | Processamento | Buscando dados, processando arquivo |
| promise | Operação assíncrona | Chamadas API, uploads |

## Componentes Já Integrados

As seguintes componentes já têm toast notifications implementadas:

- ✅ **ClientModal** - Salvar/atualizar clientes
- ✅ **UserModal** - Criar/editar usuários
- ✅ **ConfirmModal** - Confirmação de ações
- ✅ **ReceiptGenerator** - Gerar PDF de recibos
- ✅ **ReceiptGenerator** - Validação de CNPJ

## Próximos Passos

Integrar toast notifications em:
- [ ] Dashboard - Carregamento de dados
- [ ] Settings - Atualização de configurações
- [ ] PdfEditor - Operações de arquivo
- [ ] CepSearch - Busca de CEP
- [ ] Pages de erro - Feedback de falhas

## Referências

- [Documentação Sonner](https://sonner.emilkowal.ski/)
- [useToast Hook](./frontend/src/hooks/useToast.js)
- [Configuração Toaster](./frontend/src/App.jsx)
