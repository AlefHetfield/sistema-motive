# 📊 Arquitetura do Sistema de Toast Notifications

## Fluxo da Integração

```
┌─────────────────────────────────────────────────────────────────┐
│                        App.jsx (Root)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  <Toaster                                                 │  │
│  │    position="top-right"                                  │  │
│  │    theme="light"                                         │  │
│  │    richColors                                            │  │
│  │    closeButton                                           │  │
│  │    duration={3000}                                       │  │
│  │  />                                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Toda a aplicação pode usar Toast notifications                │
└─────────────────────────────────────────────────────────────────┘
        │
        ├─→ useToast() Hook
        │   └─→ Todos os componentes importam e usam
        │
        └─→ Componentes com Toast Integrado:
            ├─ ClientModal (Salvar clientes)
            ├─ UserModal (Gerenciar usuários)
            ├─ ConfirmModal (Confirmar ações)
            ├─ ReceiptGenerator (Gerar PDF)
            └─ Outros (Extensível)
```

## Diagrama de Uso do Hook

```javascript
┌──────────────────────────────────────────┐
│      useToast() Hook                     │
├──────────────────────────────────────────┤
│                                          │
│  Métodos Disponíveis:                   │
│  ├─ notify.success(msg)      ✅         │
│  ├─ notify.error(msg)        ❌         │
│  ├─ notify.warning(msg)      ⚠️         │
│  ├─ notify.info(msg)         ℹ️         │
│  ├─ notify.loading(msg)      ⏳         │
│  ├─ notify.promise(fn, msgs) 🔄        │
│  ├─ notify.custom(component) 🎨        │
│  ├─ notify.dismiss(id)       ✕         │
│  └─ notify.dismissAll()      ✕✕        │
│                                          │
│  Atalhos (toastNotifications):          │
│  ├─ saved()                             │
│  ├─ deleted()                           │
│  ├─ updated()                           │
│  └─ ...etc                              │
│                                          │
└──────────────────────────────────────────┘
```

## Padrões de Integração

### Pattern 1: Sucesso Simples
```
┌─────────────────────────────┐
│   Ação do Usuário           │
└──────────────┬──────────────┘
               │
               ▼
       ┌──────────────────┐
       │  Executar Ação   │
       └──────────────────┘
               │
               ├─ Sucesso
               │   │
               │   ▼
               │  notify.success('✅')
               │
               └─ Erro
                   │
                   ▼
                  notify.error('❌')
```

### Pattern 2: Loading com Dismiss
```
┌─────────────────────────────┐
│   Ação do Usuário           │
└──────────────┬──────────────┘
               │
               ▼
        const toastId = 
        notify.loading('⏳')
               │
               ▼
       ┌──────────────────┐
       │  Executar Ação   │
       └──────────────────┘
               │
        ┌──────┴────────┐
        │               │
        ▼               ▼
     Sucesso         Erro
        │               │
        ├─ dismiss()    ├─ dismiss()
        ├─ success()    └─ error()
        │
        └─ Resultado
```

### Pattern 3: Promise Toast
```
┌─────────────────────────────┐
│   Ação Assíncrona           │
└──────────────┬──────────────┘
               │
               ▼
       notify.promise(
         asyncFn,
         {
           loading: '⏳',
           success: '✅',
           error: '❌'
         }
       )
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
     Pendente      Resolvido
        │             │
        ▼             ▼
     loading()    success/error()
```

## Exemplo Real: ClientModal Flow

```
Usuário clica "Salvar"
    │
    ▼
handleSubmit(e)
    │
    ├─ Validar dados
    │
    ├─ Chamar API
    │   │
    │   ├─ Sucesso
    │   │   │
    │   │   ├─ notify.success(
    │   │   │    `Cliente ${name} salvo!`
    │   │   │  )
    │   │   │
    │   │   ├─ logActivity()
    │   │   │
    │   │   ├─ onSave() [recarregar lista]
    │   │   │
    │   │   └─ onClose() [fechar modal]
    │   │
    │   └─ Erro
    │       │
    │       └─ notify.error(
    │            `Erro: ${error.message}`
    │          )
    │
    └─ setIsSaving(false)

Usuário vê notificação ✨
```

## Componentes Implementados

```
Sistema Motive
├── frontend/
│   ├── src/
│   │   ├── App.jsx ⭐ (Toaster configurado)
│   │   ├── hooks/
│   │   │   └── useToast.js ⭐ (Hook principal)
│   │   ├── components/
│   │   │   ├── ClientModal.jsx ✅ (Toast integrado)
│   │   │   ├── UserModal.jsx ✅ (Toast integrado)
│   │   │   ├── ConfirmModal.jsx ✅ (Toast integrado)
│   │   │   └── ... (outros componentes)
│   │   └── pages/
│   │       ├── ReceiptGenerator.jsx ✅ (Toast integrado)
│   │       ├── Dashboard.jsx ⏳ (Próxima integração)
│   │       ├── Settings.jsx ⏳ (Próxima integração)
│   │       └── ... (outras páginas)
│   │
│   └── package.json (sonner adicionado)
│
├── TOAST_NOTIFICATIONS.md ⭐ (Guia completo)
├── TOAST_EXAMPLES.md ⭐ (10 exemplos)
└── TOAST_READY.md ⭐ (Resumo visual)
```

## Fluxo de Dados

```
                    ┌──────────────┐
                    │  Sonner Lib  │
                    └──────────────┘
                           △
                           │ renderiza
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
    ┌────────────────────┐          ┌────────────────────┐
    │   useToast Hook    │          │   Toaster Config   │
    │ (Métodos)          │          │   (App.jsx)        │
    └────────────────────┘          └────────────────────┘
         △                                   △
         │ importa                          │ wrapper
         │                                  │
    ┌────┴─────────────────────────────────┴──────┐
    │     Componentes da Aplicação               │
    │  - ClientModal                             │
    │  - UserModal                               │
    │  - ConfirmModal                            │
    │  - ReceiptGenerator                        │
    │  - ... (expandível)                        │
    └────────────────────────────────────────────┘
```

## Tipos de Toast por Componente

### ClientModal
```
notify.success(`Cliente ${name} adicionado! 🎉`)
notify.success(`Cliente ${name} atualizado! ✅`)
notify.error(`Erro ao salvar: ${error.message}`)
```

### UserModal
```
notify.success(`Usuário ${name} criado! 🎉`)
notify.success(`Usuário ${name} atualizado! ✅`)
notify.error(`Erro ao salvar usuário`)
```

### ConfirmModal
```
notify.success(`Item deletado com sucesso! 🗑️`)
notify.success(`Ação confirmada com sucesso! ✅`)
```

### ReceiptGenerator
```
notify.success(`Recibo gerado com sucesso! 📄`)
notify.warning(`CNPJ inválido. Digite 14 números.`)
notify.error(`Erro ao gerar PDF`)
notify.error(`Erro ao buscar CNPJ`)
```

## Extensibilidade

```
Nova Página/Componente?

1. Importar hook
   import { useToast } from '../hooks/useToast';

2. Usar no componente
   const notify = useToast();

3. Adicionar notificações
   notify.success('Mensagem');
   notify.error('Erro');

4. Deploy automático
   git push → Vercel
```

## Performance

```
┌────────────────────────────────────────┐
│  Sonner Toast Performance              │
├────────────────────────────────────────┤
│                                        │
│  ✅ Zero Dependencies                 │
│  ✅ <5KB minificado                   │
│  ✅ Renderização otimizada            │
│  ✅ Suporta stacking ilimitado        │
│  ✅ Animações suaves com CSS          │
│  ✅ Acessibilidade nativa             │
│                                        │
└────────────────────────────────────────┘
```

## Status do Projeto

```
Sistema de Notificações

Phase 1: Setup ✅ CONCLUÍDO
├─ Instalar Sonner
├─ Configurar Toaster
└─ Criar useToast hook

Phase 2: Integração Principal ✅ CONCLUÍDO
├─ ClientModal
├─ UserModal
├─ ConfirmModal
└─ ReceiptGenerator

Phase 3: Documentação ✅ CONCLUÍDO
├─ TOAST_NOTIFICATIONS.md
├─ TOAST_EXAMPLES.md
└─ TOAST_READY.md

Phase 4: Próximas Integrações ⏳ EM FILA
├─ Dashboard
├─ Settings
├─ CepSearch
└─ PdfEditor

Phase 5: Melhorias Futuras ⏳ PLANEJADO
├─ Dark mode
├─ Custom sounds
└─ Histórico
```

---

**Arquitetura clara, simples e extensível! 🚀**
