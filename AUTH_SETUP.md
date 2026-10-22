# 🔐 Sistema de Autenticação - Guia Rápido

## ✅ Sistema Implementado com Sucesso!

O sistema de autenticação completo foi implementado com:
- Login seguro com bcrypt
- Sessões via cookies HttpOnly
- Dois níveis de acesso: **ADM** e **CORRETOR**
- Gerenciamento de usuários (apenas para admins)
- UI condicional baseada em permissões

---

## 🚀 Como Testar

### 1. Inicie o Backend
```powershell
cd "c:\Users\Alefs\OneDrive\Área de Trabalho\PROJETOS MOTIVE\sistema-motive"
npm run dev
```

O servidor deve iniciar em `http://localhost:3000`

### 2. Inicie o Frontend
Em outro terminal:
```powershell
cd "c:\Users\Alefs\OneDrive\Área de Trabalho\PROJETOS MOTIVE\sistema-motive\frontend"
npm run dev
```

O frontend deve iniciar em `http://localhost:5173`

### 3. Faça Login

Acesse `http://localhost:5173/login` e use as credenciais do administrador:

```
📧 Email: admin@motive.com
🔑 Senha: admin123
```

⚠️ **IMPORTANTE**: Troque a senha após o primeiro login!

---

## 👥 Funcionalidades por Tipo de Usuário

### 🔹 ADMINISTRADOR (ADM)
Tem acesso total ao sistema:
- ✅ Dashboard
- ✅ Gerenciar Clientes
- ✅ Editor de PDF
- ✅ Gerador de Recibos
- ✅ Configurações
- ✅ **Configurações → Usuários** (exclusivo)

### 🔸 CORRETOR
Acesso limitado:
- ✅ Dashboard
- ✅ Gerenciar Clientes
- ✅ Editor de PDF
- ✅ Gerador de Recibos
- ❌ Configurações → Usuários (bloqueado)
- ❌ Algumas configurações sensíveis (bloqueado)

---

## 🎯 Testando o Sistema

### Criar um Novo Usuário (Como Admin)
1. Faça login como admin
2. Clique em "Configurações" no menu lateral e abra a aba "Usuários"
3. Clique em "Novo Usuário"
4. Preencha:
   - Nome completo
   - Email
   - Senha temporária
   - Função (ADM ou CORRETOR)
5. Clique em "Criar Usuário"

### Testar Acesso de Corretor
1. Crie um usuário com função "CORRETOR"
2. Faça logout
3. Faça login com o novo usuário
4. Observe que a aba "Usuários" não aparece em "Configurações"
5. Tente acessar `/users` manualmente - será bloqueado

### Gerenciar Usuários Existentes
Como admin, você pode:
- ✏️ Editar informações (nome, email, senha, função)
- 🔄 Ativar/desativar usuários
- 🗑️ Deletar usuários (exceto você mesmo)

---

## 🔧 Arquivos Importantes

### Backend
- `api/server.js` - Rotas de autenticação e RBAC
- `prisma/schema.prisma` - Schema com User e Role

### Frontend
- `src/context/AuthContext.jsx` - Contexto de autenticação
- `src/components/PrivateRoute.jsx` - Proteção de rotas
- `src/pages/Login.jsx` - Tela de login moderna
- `src/pages/UserManagement.jsx` - Gerenciamento de usuários
- `src/components/UserModal.jsx` - Modal de criação/edição
- `src/App.jsx` - Rotas protegidas

---

## 🔐 Segurança Implementada

✅ Senhas criptografadas com bcrypt (10 rounds)  
✅ Sessões via cookies HttpOnly (protege contra XSS)  
✅ SameSite=Lax (protege contra CSRF)  
✅ Validação de role no backend (não confia no frontend)  
✅ Middleware de autenticação e autorização  
✅ Proteção contra auto-exclusão de admin  
✅ Verificação de email único  

---

## 📝 Próximos Passos Sugeridos

1. **Recuperação de Senha**
   - Endpoint `/auth/forgot-password`
   - Envio de email com token
   - Endpoint `/auth/reset-password`

2. **Funcionalidades por Role**
   - Mapear exatamente o que cada corretor pode fazer
   - Bloquear certas ações no backend por role

3. **Logs de Auditoria**
   - Registrar login/logout
   - Registrar ações sensíveis (criar/editar/deletar)

4. **Melhorias de UX**
   - Toast notifications globais
   - Confirmação visual de ações
   - Filtros avançados na lista de usuários

---

## 🐛 Troubleshooting

### "Erro ao conectar com o servidor"
- Certifique-se que o backend está rodando em `localhost:3000`
- Verifique o arquivo `frontend/.env.local`

### "Credenciais inválidas"
- Verifique email e senha
- Use `admin@motive.com` / `admin123` para o admin inicial
- Senha é case-sensitive

### "Acesso negado"
- Usuário corretor tentando acessar rota de admin
- Verifique a role do usuário no banco de dados

### Cookies não estão sendo salvos
- Backend e frontend devem estar no mesmo domínio ou com CORS configurado
- `credentials: 'include'` deve estar em todas as requisições
- Cookie `SameSite` e `Secure` devem estar corretos

---

## 📚 Estrutura de Permissões

```
ADM (Administrador)
├── Acesso total ao sistema
├── Gerenciar usuários
├── Ver relatórios completos
└── Configurações avançadas

CORRETOR
├── Gerenciar seus clientes
├── Gerar recibos
├── Buscar CEP
├── Editar PDFs
└── ❌ Sem acesso a gestão de usuários
```

---

## ✨ Pronto para Usar!

O sistema está completamente funcional. Faça login e explore todas as funcionalidades implementadas!

**Dúvidas?** Todos os endpoints estão documentados no código com comentários detalhados.
