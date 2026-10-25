# Notas

O módulo fica em `/notes`, no menu Operação de ADM, ASSISTENTE e CORRETOR. Notas pessoais e compartilhadas usam o banco do Motive; não há sincronização com Google Keep.

## Criar e organizar

Use **Nova nota** para texto ou **Nova lista** para checklist. O título é opcional: preencha algum texto ou item para criar a nota. O salvamento ocorre após uma pausa na digitação; **Todas as alterações salvas** significa que a API confirmou a gravação.

Cada salvamento automático envia uma fotografia do texto. Se você continuar digitando durante a resposta, o rascunho fica preservado e as novas alterações são agrupadas na próxima pausa, em vez de manter uma sequência contínua de gravações. **Concluir** continua disponível durante o autosave: ao acioná-lo, o editor aguarda a gravação em andamento e salva a última digitação antes de fechar. A indicação **Concluindo…** aparece somente nessa saída solicitada.

O botão **A** no rodapé abre as opções de negrito, itálico, sublinhado, tachado, listas com marcadores, listas numeradas e caixas de seleção no mesmo conteúdo. Selecione um trecho e escolha a formatação; Ctrl+B, Ctrl+I e Ctrl+U também funcionam. Clique novamente no botão ou pressione Escape nas opções para recolhê-las. A formatação permanece ao reabrir e aparece nos cartões. A pesquisa considera o texto, sem códigos de formatação. Notas anteriores continuam editáveis sem conversão em lote.

Escolha grade ou lista, pesquise título/texto/itens e filtre por origem, cor ou marcador. A busca ignora diferenças de maiúsculas e acentos. **Minhas** inclui notas pessoais e compartilhadas por você; **Compartilhadas comigo** reúne as recebidas.

Cores, fixação, marcadores e arquivo são pessoais. Uma pessoa arquivar ou mudar a cor não altera a organização dos demais participantes. Excluir um marcador preserva as notas.

O dono pode mover à lixeira, restaurar ou excluir definitivamente. A lixeira retira o acesso dos colaboradores enquanto a nota estiver nela. Exclusão definitiva exige confirmação e não pode ser desfeita. Não há expurgo automático. Participantes podem **Ocultar para mim** e recuperar a nota na visualização **Ocultas**.

## Compartilhar

Novas notas são compartilhadas automaticamente com todos os usuários ativos no momento da criação, com permissão **Pode editar**. Isso vale também para checklists e acontece no primeiro salvamento automático. O dono pode depois remover participantes ou mudar seu acesso para **Pode visualizar**. Leitores não alteram texto nem marcam checklist. Editores não mudam participantes nem excluem a nota globalmente. Notas anteriores mantêm suas permissões.

Somente o dono administra o compartilhamento. Administradores não recebem acesso automático às notas pessoais de outras pessoas. Novos usuários cadastrados no sistema não entram nos compartilhamentos existentes.

A API consulta o usuário ativo e revalida o acesso em todas as operações. Revogação e edição disputam o mesmo bloqueio da nota, impedindo aceitar escritas após uma revogação efetiva. Desativar o dono preserva o acesso já concedido aos participantes ativos; excluir fisicamente um dono com notas é bloqueado para preservar os dados.

## Alterações pendentes e conflitos

O editor serializa gravações e preserva alterações digitadas durante uma requisição. Uma edição concorrente gera aviso de conflito: compare/copie o rascunho antes de carregar a versão atual. A API não sobrescreve silenciosamente uma versão nova.

O editor abre com os dados da lista e revalida a nota em segundo plano. Respostas antigas não substituem texto novo nem organização pessoal mais recente. Criar, fixar, arquivar, restaurar e mover à lixeira atualizam os cartões assim que a API confirma; uma nova consulta à lista só é necessária para conciliar uma consulta concorrente ou preencher páginas incompletas. As respostas das mutações atualizam diretamente o editor, sem GET obrigatório depois da gravação.

O conteúdo compartilhado é consultado ao retornar à janela e a cada 30 segundos enquanto a aba estiver visível. A consulta não substitui um formulário com alterações pendentes. Links e o botão Voltar do navegador permitem resolver alterações antes de sair; fechar ou recarregar a aba usa o aviso nativo quando necessário.

Rascunhos temporários ficam em `sessionStorage`, separados por usuário, com validade de 30 minutos. Permitem recuperação na mesma aba após recarga ou expiração da sessão; reautenticar a mesma conta e revalidar o acesso é necessário para retomar a edição. O painel de recuperação também permite copiar um rascunho local cuja nota deixou de estar acessível. Logout explícito resolve as alterações pendentes e limpa os rascunhos; entrar com outra conta remove os anteriores. Armazenamento bloqueado pelo navegador é indicado no editor.

Isso não implementa uso offline completo nem garante recuperação depois de encerrar o navegador. A fonte principal continua sendo a API e o PostgreSQL.

## Instalação

Aplicar a migração aditiva `20261022120000_add_notes` pelo fluxo existente e gerar o Prisma Client antes de iniciar/publicar a API. A migração adiciona notas, acessos, preferências, marcadores e associações; não transforma observações de clientes ou anotações de tarefas.

```powershell
npm run db:migrate:deploy
npx prisma generate
npm run dev:all
```

Não há novo segredo de ambiente. As mutações verificam a origem do navegador contra `CORS_ORIGIN` ou o mesmo host da API. Usar a origem real do frontend na configuração de produção; testes HTTP com cookies precisam enviar `Origin` permitido.

## API e dados

- `api/noteRoutes.js`: roteadores de `/api/notes` e `/api/note-labels`.
- `api/noteAccess.js`: validações, escopo, apresentação e bloqueios transacionais.
- `api/noteRead.js`: leitura da nota e sua apresentação em uma consulta SQL parametrizada, com isolamento de acesso e de marcadores pessoais.
- `frontend/src/utils/noteContent.js`: formato e validação do texto, usados também pela API. O arquivo fica dentro do frontend para permitir seu build isolado na Vercel.
- `Note.version`: conteúdo, compartilhamento e lixeira global.
- `NoteUserState.version`: preferências individuais, independente do conteúdo.
- `clientMutationId`: UUID por criação, evitando duplicatas em uma repetição da requisição.

`GET /api/notes` aceita `scope`, `view`, `q`, `color`, `labelId`, `page` e `pageSize`; filtros opcionais vazios devem ser omitidos. A página padrão tem 40 notas. A listagem mantém o contrato de nota completa com limites de conteúdo, e os cartões exibem prévias na interface.

Erros incluem `status` HTTP e `code`; conflito de versão usa 409 `VERSION_CONFLICT`. Dados pessoais de organização nunca concedem acesso. Respostas são privadas e não armazenáveis em cache. O conteúdo das notas não é escrito em logs de diagnóstico.

O cabeçalho `Server-Timing: notes;dur=...` mede o tempo na API até começar a enviar a resposta, incluindo autenticação e operações do banco, sem expor conteúdo ou sessão. Não mede o trajeto de rede. Antes de gravar, a API consulta somente os campos necessários para a operação; a resposta completa é montada após a alteração, mantendo os bloqueios de autorização e de versão.

Limites: título de 250 caracteres; corpo de 20.000; 100 itens de 500 caracteres; 50 marcadores por usuário, com nome de até 50 caracteres; até 10 marcadores por nota para cada usuário; até 100 participantes por nota.

## Verificação

```powershell
npm run test:notes
npm run test:tasks
cd frontend
npm run build
npm run lint
npm run test:notes-ui
npm run test:auth
```

Os testes de integração recusam bancos fora de localhost/127.0.0.1 e criam/removem somente registros temporários próprios. Incluem autenticação, autorização, busca, idempotência, preferências, concorrência, revogação e lixeira. Os testes de rascunhos verificam normalização, isolamento por conta, expiração e armazenamento indisponível. Os testes do autosave executam React e React Router com DOM simulado, cobrindo requisições atrasadas, conflitos, recuperação, navegação e respostas antigas.

Vínculos com clientes/imóveis, lembretes, mídia, grupos e transferência de propriedade ficam para versões posteriores. Antes da integração com clientes, tratar as rotas sem autenticação identificadas no planejamento.
