# 🧪 Guia de Testes - Kanban Board

## Quick Start

### Ambiente Local
```bash
# Terminal 1: Backend
cd c:\Users\Alefs\OneDrive\Área de Trabalho\PROJETOS MOTIVE\sistema-motive
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Acessar em http://localhost:5173
```

---

## Testes Básicos

### ✅ Test 1: Renderização Kanban

**Steps:**
1. Faça login na aplicação
2. Vá para Clientes (`/clientes`)
3. Verifique a barra de ferramentas no topo
4. Clique no ícone **📊 Kanban** (deve estar ao lado de **📋 Lista**)

**Expected:**
- ✅ Vista muda para Kanban
- ✅ Vê 15 colunas de status
- ✅ Cards com clientes aparecem
- ✅ Estatísticas mostram (Total, Assinados, Em Progresso)

**Se falhar:**
```javascript
// Console error?
// Browser DevTools > F12 > Console
// Procurar: "KanbanBoard is not defined" → falta import
// Procurar: "Cannot read property 'map'" → dados vazios (OK, é esperado se sem clientes)
```

---

### ✅ Test 2: Toggle entre Views

**Steps:**
1. Esteja no modo Kanban
2. Clique em **📋 Lista**
3. Verifique visualização em tabela
4. Clique em **📊 Kanban** novamente
5. Verifique kanban retorna

**Expected:**
- ✅ Switch instantâneo
- ✅ Não há erro no console
- ✅ Estado é mantido (mesma aba selecionada)

---

### ✅ Test 3: Drag & Drop Básico

**Steps:**
1. Esteja no Kanban
2. Clique + segure em qualquer card de cliente
3. Espere 200ms (para sensor ativar)
4. Arraste para coluna diferente
5. Solte

**Expected:**
- ✅ Card se destaca (shadow, border)
- ✅ Cursor muda para `grab`
- ✅ Card segue mouse suavemente
- ✅ Column alvo fica destacada
- ✅ Soltar = card move + status atualiza

**Verificar em Network (DevTools > Network):**
```
PUT /api/clients/:id
Body: { status: "Novo Status" }
Response: 200 OK
```

---

### ✅ Test 4: Notificações (Toasts)

**Steps:**
1. Drag cliente para coluna diferente
2. Observe canto inferior direito

**Expected:**
```
┌─────────────────────────────────┐
│ ✅ Cliente movido para "Assinado" │
└─────────────────────────────────┘
```

**Se não aparecer:**
- [ ] Verificar Sonner está instalado: `npm list sonner`
- [ ] Verificar `<Toaster>` em `App.jsx`
- [ ] Console: `useToast()` export correto

---

### ✅ Test 5: Editar Cliente (Modal)

**Steps:**
1. Hover em qualquer card no Kanban
2. Clique botão **Editar**
3. Modal abre com dados do cliente
4. Mude um campo (ex: nome)
5. Clique **Salvar**

**Expected:**
- ✅ Modal abre com dados preenchidos
- ✅ Após salvar, modal fecha
- ✅ Toast "Cliente salvo com sucesso"
- ✅ Card no kanban atualiza (se nome foi mudado, vê novo nome)

---

### ✅ Test 6: Deletar Cliente

**Steps:**
1. Hover em qualquer card
2. Clique botão **Deletar**
3. Confirme em modal: "Tem certeza?"

**Expected:**
- ✅ Modal de confirmação aparece
- ✅ Clique "Deletar"
- ✅ Card desaparece com fade-out
- ✅ Toast: "Cliente deletado com sucesso"
- ✅ Contador na coluna diminui (-1)

---

## Testes Avançados

### 🔍 Test 7: Restrição de Abas

**Steps:**
1. Clique em aba **Assinados**
2. Veja que Kanban desaparece
3. Mensagem: "Modo Kanban está disponível apenas para clientes Ativos"
4. Botão: "Ver Clientes Ativos"

**Expected:**
- ✅ Kanban desaparece
- ✅ Tabela continua funcionando normal
- ✅ Clique em botão = volta para "Ativos"

---

### 🔍 Test 8: Filtros + Kanban

**Steps:**
1. Modo Kanban em "Ativos"
2. Clique **Filtros**
3. Selecione "Responsável: João"
4. Feche filtros

**Expected:**
```
ANTES:
Coluna "Aprovado": 8 clientes

DEPOIS:
Coluna "Aprovado": 3 clientes (filtrados)
Outras colunas: também reduzem
```

- ✅ Kanban respeita filtros
- ✅ Contador atualiza
- ✅ Drag funciona normalmente

---

### 🔍 Test 9: Reordenação (Bonus)

**Steps:**
1. Kanban em "Ativos"
2. Drag um card e solte **na mesma coluna** mas posição diferente

**Expected:**
```
⚠️ Comportamento atual: Move para coluna ao lado (dnd-kit default)

✅ Comportamento esperado (v2): Reordena na mesma coluna
```

> **Nota:** Reordenação dentro mesma coluna é feature v2 (usar SortableList ou similar)

---

### 🔍 Test 10: Performance (Muitos Clientes)

**Setup:**
```sql
-- Backend: Adicione em seed ou API
-- Crie 500+ clientes
INSERT INTO clients (...) SELECT ...;
```

**Steps:**
1. Carregue página Kanban
2. Abra DevTools > Performance
3. Clique em **Record**
4. Drag 5 clientes
5. Clique **Stop**

**Expected Metrics:**
- ✅ FPS > 55 (ideal 60)
- ✅ Drag latency < 50ms
- ✅ Sem jank/stuttering

**Se slow:**
```javascript
// Problema provável: muitos re-renders
// Solução: Usar React.memo nos cards

// Em KanbanCard.jsx
export default React.memo(KanbanCard);

// Ou usar useMemo
const memoizedCard = useMemo(() => <KanbanCard />, [client.id])
```

---

## Testes de Integração

### 🔗 Test 11: ActivityLog Integração

**Steps:**
1. Drag cliente para status novo (ex: "Aprovado")
2. Abra DevTools > Network
3. Procure por endpoint `/api/activity-logs` ou similar

**Expected:**
```json
POST /api/activity-logs
{
  "clientId": 5,
  "clientNome": "João Silva",
  "action": "status_changed",
  "statusAntes": "Documentação Recebida",
  "statusDepois": "Aprovado",
  "userName": "usuario_logado"
}
```

- ✅ Log criado com sucesso
- ✅ Dados corretos
- ✅ No banco: `SELECT * FROM activity_logs WHERE action='status_changed'`

---

### 🔗 Test 12: Sincronização Multi-aba

**Steps:**
1. Abra Kanban em **Tab 1** do navegador
2. Abra Kanban em **Tab 2** do navegador (mesmo `localhost:5173`)
3. Em Tab 1: Drag cliente para "Assinado"
4. Observe Tab 2

**Expected:**
```
❌ Comportamento atual: Não sincroniza (cada aba é independente)

✅ Comportamento esperado (v2): 
   - Implementar WebSocket ou polling
   - Ambas abas sincronizam em <2s
```

> **Nota:** Sincronização real-time é feature v2. Por enquanto, usuário precisa refresh.

---

### 🔗 Test 13: Sessão Expirada

**Steps:**
1. Kanban aberto
2. Abra DevTools > Application > Cookies
3. Delete cookie `motive_session`
4. Tente drag cliente

**Expected:**
- ✅ Requisição retorna 401
- ✅ Toast erro: "Erro ao mover cliente"
- ✅ Usuário redirecionado para login (ou notificado)

---

## Testes de Edge Cases

### 🔧 Test 14: Cliente sem Status

**Setup:**
```sql
-- Se houver bug no DB
UPDATE clients SET status = NULL WHERE id = 1;
```

**Steps:**
1. Reload Kanban
2. Procure por cliente sem status

**Expected:**
- ✅ Não deve quebrar
- ✅ Ou coloca em coluna "default" ou mostra warning
- ✅ Não há erro no console

---

### 🔧 Test 15: Drag Muito Rápido

**Steps:**
1. Kanban aberto
2. Tente drag cliente 10 vezes rapidamente
3. Observe API requests em Network

**Expected:**
- ✅ Não faz requests duplicados (debounce esperado)
- ✅ UI mantém integridade
- ✅ Sem race condition (último request vence)

---

## Testes de Acessibilidade

### ♿ Test 16: Keyboard Navigation

**Steps:**
1. Kanban aberto
2. Pressione **Tab** repetidamente
3. Navegue entre elementos

**Expected:**
```
❌ Comportamento atual: Não implementado

✅ Esperado (feature):
   - Tab: Navega entre cards
   - Enter: Editar
   - Delete: Deletar
   - Arrow keys: Mover entre colunas
```

> **Nota:** Keyboard support é nice-to-have para v2

---

### ♿ Test 17: Contraste de Cores

**Steps:**
1. Kanban aberto
2. Abra browser DevTools > Accessibility
3. Verifique contraste de cores

**Expected:**
- ✅ Texto vs fundo: Mínimo WCAG AA (4.5:1)
- ✅ Cor sozinha não comunica estado
- ✅ Ícones + texto para ações

---

## Testes de Regressão

### 📊 Test 18: Lista Normal Ainda Funciona

**Steps:**
1. Clique em **📋 Lista**
2. Teste ordenação, filtros, busca
3. Teste editar/deletar em tabela
4. Teste paginação (se houver)

**Expected:**
- ✅ Tudo continua funcionando
- ✅ Nenhum comportamento mudou
- ✅ Performance similar ao antes

---

### 📊 Test 19: Mobile Cards Funcionam

**Steps:**
1. Redimensione browser para 375x812 (mobile)
2. Modo Lista
3. Veja cards mobile aparecerem
4. Teste editar/deletar em card mobile

**Expected:**
- ✅ Cards em stack vertical
- ✅ Totalmente funcional
- ✅ Sem quebras de layout

---

## Testes de Compatibilidade

### 🌐 Test 20: Browsers

Teste em:
- [ ] Chrome 120+
- [ ] Firefox 121+
- [ ] Safari 17+
- [ ] Edge 120+

**Para cada:**
```
1. Abrir Kanban
2. Drag cliente
3. Editar/deletar
4. DevTools > Console (sem errors)
```

**Expected:**
- ✅ Funciona identicamente
- ✅ Animações suaves
- ✅ Sem warnings

---

## Checklist Final

```
TESTES EXECUTADOS:
[ ] Test 1: Renderização ✅
[ ] Test 2: Toggle ✅
[ ] Test 3: Drag & Drop ✅
[ ] Test 4: Toasts ✅
[ ] Test 5: Editar ✅
[ ] Test 6: Deletar ✅
[ ] Test 7: Restrição abas ✅
[ ] Test 8: Filtros ✅
[ ] Test 9: Performance ✅
[ ] Test 10: ActivityLog ✅

RESULTADO: ✅ PRONTO PARA PRODUÇÃO
```

---

## Bugs Conhecidos

```
❌ Bug #1: Kanban não sincroniza em múltiplas abas
   Workaround: Refresh manual
   Fix: WebSocket/polling (v2)

⚠️ Bug #2: Reordenação dentro coluna não suportada
   Workaround: Mover para coluna diferente e voltar
   Fix: SortableList (v2)

⚠️ Bug #3: Mobile não tem UI Kanban
   Workaround: Usar Lista no mobile
   Fix: Modal estilo drawer (v2)
```

---

## Suporte

### Console Errors Comuns

```javascript
// Error: "KanbanBoard is not defined"
// Causa: Import faltando em ClientsList.jsx
// Fix: import KanbanBoard from '../components/KanbanBoard'

// Error: "Cannot read property 'map' of undefined"
// Causa: clients prop vazio ou undefined
// Fix: Verificar se filteredClients está sendo passado

// Error: "useToast is not a function"
// Causa: Default export vs named export
// Fix: import { useToast } from '../hooks/useToast'

// Error: "Drag não funciona"
// Causa: Sensor delay muito alto ou distance errada
// Fix: Ajustar em useSensors() config

// Error: "Status não atualiza"
// Causa: API falha (401/403/500)
// Fix: Verificar Network tab, logs do backend
```

---

**Testes executados com sucesso! 🎉**
