# Plano do módulo Notas — Motive

Data: 22/10/2026. Status: primeira versão implementada e integrada ao ambiente local. Este documento preserva as decisões de planejamento; o uso e a operação atuais estão em [NOTAS.md](NOTAS.md).

Preferência confirmada: notas pessoais e compartilhadas com a equipe já na primeira versão.

## 1. Direção proposta

Criar uma área **Notas**, em `/notes`, próxima de Tarefas e Agenda no menu dos três perfis. A experiência deve favorecer anotações rápidas, cartões de texto e checklists, mantendo a identidade visual do Motive.

Atualização solicitada: novas notas nascem compartilhadas com toda a equipe ativa, com permissão de edição. O dono pode restringir participantes ou escolher **Pode visualizar** depois. Notas anteriores preservam as permissões existentes. As referências ao padrão pessoal nas seções de planejamento abaixo descrevem a proposta original, substituída por esta atualização.

Uma nota guarda informação livre; uma tarefa organiza execução, responsável e prazo. As duas áreas terão entidades próprias. A primeira versão inclui compartilhamento, mas a integração com clientes, imóveis e tarefas fica para uma etapa seguinte.

## 2. O que já existe no sistema

Análise estática do código local; não houve consulta ao banco, execução da aplicação nem auditoria do ambiente publicado.

| Área | Evidência no projeto | Consequência para o plano |
| --- | --- | --- |
| Frontend | React 19, Vite, Tailwind, HeroUI, Lucide e Sonner em `frontend/package.json` | Construir a tela dentro da aplicação existente, sem uma nova aplicação ou biblioteca de editor no MVP. |
| Rotas e navegação | `frontend/src/App.jsx:44` e `frontend/src/components/AppLayout.jsx:13` | Adicionar rota com carregamento sob demanda, descrição e entrada nos menus ADM, ASSISTENTE e CORRETOR. |
| Dados | PostgreSQL/Prisma em `prisma/schema.prisma:6` | Persistência no banco atual, com migração aditiva. |
| Anotações contextuais | `Client.observacoes` em `prisma/schema.prisma:19`; `Task.notes` e `Task.steps` em `prisma/schema.prisma:201` | Preservar esses campos e criar entidades próprias para notas. |
| Padrão de autorização | `api/taskRoutes.js:59` | Reutilizar o padrão de sessão, revalidação do usuário ativo e respostas privadas. Criar um escopo específico de notas. |
| Concorrência | `api/taskRoutes.js:301` | Adaptar o controle por versão e erro HTTP 409 para edição compartilhada. |
| Cliente HTTP | `frontend/src/services/api.js:22` | Acrescentar `notesApi`; preservar status/código dos erros para diferenciar conflito, sessão e falta de permissão. |
| Interface e celular | `frontend/src/components/ui/`, `frontend/src/index.css:15`, `frontend/src/hooks/useMobileLayout.js:3` | Reutilizar componentes e paleta; editor em tela cheia no celular e alvos de toque de pelo menos 44px. |
| Rascunhos | `frontend/src/hooks/useContractDraft.js:22` | Há referência de debounce e recuperação local; notas precisam também de confirmação de gravação na API. |
| Publicação | `vercel.json` encaminha `/api` ao Render; `render.yaml` descreve a API | Seguir os fluxos de migração e publicação existentes. A configuração local não comprova o estado atual dos serviços publicados. |

### Achado relevante antes da futura integração com clientes

No código atual, `GET /api/clients`, `GET /api/clients/:id` e `DELETE /api/clients/:id` estão registrados sem middleware de autenticação em `api/server.js:852`, `:866` e `:1009`. Não foi encontrada proteção global que cubra essas rotas. Isso é uma constatação do código, sem teste de exposição externa.

Tratar autenticação e autorização dessas rotas em uma correção própria antes de integrar notas a clientes. O módulo Notas terá seu próprio roteador protegido. Não armazenar notas pessoais em `Client.observacoes`.

## 3. Escopo da primeira versão

| Recurso | Comportamento proposto |
| --- | --- |
| Captura rápida | Campo “Criar uma nota…” e ação “Nova lista”. Título opcional; exigir algum título, texto ou item preenchido antes de criar no banco. |
| Texto e checklist | Texto simples com quebras de linha; listas com itens marcáveis, IDs estáveis e ordem preservada. Checklist concluído não conclui tarefa. |
| Cartões e lista | Grade responsiva ou lista, com prévia limitada e abertura do conteúdo completo no editor. Exibir “Sem título” apenas como apresentação. |
| Fixação | Separar visualmente fixadas e demais notas. A fixação é individual. |
| Cores | Paleta pequena com cores discretas e contraste legível. A escolha é individual. |
| Marcadores | Criar, renomear, excluir e filtrar marcadores pessoais, como “Reuniões”, “Ideias” e “Atendimento”. Excluir marcador preserva as notas. |
| Busca | Pesquisar título, corpo e texto dos itens, com normalização de maiúsculas e acentos. Filtros por origem, marcador e cor. |
| Compartilhamento | Selecionar usuários ativos e nível de acesso; mostrar dono, participantes e selo Pessoal/Compartilhada. |
| Arquivo | Arquivar ou desarquivar apenas para o usuário atual. A nota continua disponível aos demais participantes. |
| Ocultas | Colaboradores podem “Ocultar para mim”; a visualização Ocultas permite mostrar novamente. Ocultar não revoga acesso. |
| Lixeira | Somente o dono envia à lixeira global, restaura ou exclui definitivamente. A interface avisa que a exclusão afeta todos os participantes. |
| Salvamento automático | Gravar após uma pausa curta de digitação, com “Salvando…”, “Salvo” e falha visíveis. |
| Atualização compartilhada | Atualizar ao recuperar o foco e consultar mudanças a cada 30 segundos enquanto a aba estiver visível. Não substituir uma edição local pendente. |

O MVP não terá imagens, anexos, áudio, desenho, edição rica, integração com Google Keep, lembretes, recorrência, arrastar cartões, edição simultânea caractere a caractere nem funcionamento offline completo. Esses recursos podem ser avaliados depois do uso inicial.

## 4. Organização da tela e fluxos

No topo: título, pesquisa, alternância grade/lista e criação rápida. Abaixo, filtros de origem: **Todas**, **Minhas** e **Compartilhadas comigo**. Minhas inclui notas pessoais e notas compartilhadas por mim; Todas é a união das notas acessíveis.

As visualizações são **Notas**, **Arquivadas**, **Ocultas** e **Lixeira**, acompanhadas dos marcadores pessoais. Lixeira mostra apenas notas de propriedade do usuário. Busca e contagens sempre respeitam acesso e visualização selecionados.

No desktop, abrir o editor em modal com foco controlado. No celular, usar tela cheia com ações visíveis por toque. A grade deve manter a ordem de leitura do teclado; usar CSS Grid na primeira versão, sem dependência de masonry.

Fluxo pessoal: abrir Notas → digitar → confirmar o primeiro salvamento → organizar por marcador/cor → voltar à grade. Uma nota vazia que nunca foi salva não gera cartão.

Fluxo compartilhado: salvar a nota → Compartilhar → escolher pessoas e acesso → confirmar → exibir os participantes após resposta da API. O seletor usa uma rota própria que retorna somente ID e nome de usuários ativos; não liberar a rota administrativa `/api/users`.

Fluxo de conflito: manter o rascunho local → informar que a nota mudou → permitir comparar/copiar o rascunho, carregar a versão atual e reaplicar alterações conscientemente. Nenhuma edição antiga deve ser reenviada automaticamente sobre uma versão nova.

## 5. Regras de acesso

| Ação | Dono | Pode editar | Pode visualizar |
| --- | --- | --- | --- |
| Ler e pesquisar | Sim | Sim | Sim |
| Alterar texto e marcar checklist | Sim | Sim | Não |
| Cor, fixação, arquivo e marcadores próprios | Sim | Sim | Sim |
| Compartilhar, remover pessoas ou trocar permissões | Sim | Não | Não |
| Ocultar para si e mostrar novamente | Usar arquivo | Sim | Sim |
| Lixeira global, restauração e exclusão definitiva | Sim | Não | Não |

Todas as regras ficam no servidor, inclusive detalhes por ID, prévias, pesquisas, contagens, marcadores e preferências. Sem acesso, responder 404 sem revelar o conteúdo ou a existência da nota. Sessão ausente ou expirada retorna 401; ação não permitida sobre uma nota visível retorna 403.

Revalidar o usuário ativo no banco em toda requisição. Remover um colaborador encerra novos acessos imediatamente no servidor; a interface percebe isso na próxima consulta ou tentativa de gravação. Rebaixar de editor para leitor interrompe as próximas escritas. Conteúdo já entregue ao navegador não pode ser retirado retroativamente.

Compartilhar significa convidar usuários escolhidos da equipe atual; novos usuários cadastrados depois não ganham acesso automaticamente. Compartilhamento com grupos e acesso automático para toda a equipe ficam fora do MVP.

Desativar um usuário preserva suas notas. Participantes ativos mantêm o acesso já concedido às notas compartilhadas desse dono. Excluir fisicamente um dono com notas deve retornar um erro orientando a desativação, seguindo o padrão já usado para tarefas. Transferência de propriedade não faz parte desta etapa.

## 6. Modelo de dados proposto

| Entidade | Campos e responsabilidades |
| --- | --- |
| `Note` | `id`, `ownerId`, `clientMutationId`, `title`, `content`, `kind` (`TEXT`/`CHECKLIST`), `items` JSON, `searchText`, `version`, `deletedAt`, `createdAt`, `updatedAt`. Dono definido pela sessão, imutável no MVP. |
| `NoteAccess` | `noteId`, `userId`, `role` (`VIEWER`/`EDITOR`), datas. Chave única composta por nota/usuário. O dono deriva de `Note.ownerId`, sem duplicar a propriedade nesta tabela. |
| `NoteUserState` | `noteId`, `userId`, `color`, `isPinned`, `archivedAt`, `hiddenAt`, `version`, `updatedAt`. Chave composta por nota/usuário. Preferências com versão independente do conteúdo. |
| `NoteLabel` | `id`, `ownerId`, `name`, `normalizedName`. Nome normalizado único por usuário. |
| `NoteLabelAssignment` | `noteId`, `labelId`, chave composta. O usuário dono do marcador precisa ter acesso atual à nota. |

Formato dos itens: `{ id, text, checked }`; a posição vem da ordem do array. IDs estáveis evitam trocar o item marcado durante reordenação. Uma versão para o conteúdo inteiro é suficiente, com conflito explícito entre edições concorrentes.

Limites iniciais propostos: título de até 250 caracteres; conteúdo de até 20.000; até 100 itens de 500 caracteres; até 50 marcadores por usuário e 10 marcadores por nota para cada usuário. Validar os limites na API e indicá-los nos controles relevantes. `kind` é escolhido na criação; conversão entre texto e lista fica para evolução posterior.

`searchText` é derivado no servidor do título, corpo e itens, com a mesma normalização aplicada à busca. Não aceitar esse campo do cliente. Começar com pesquisa paginada simples; avaliar índice textual específico apenas se medições indicarem necessidade.

Índices iniciais: dono/exclusão/atualização em `Note`; usuário/nota em `NoteAccess`; usuário/arquivo/ocultação/fixação em `NoteUserState`; dono/nome normalizado em marcadores. Proteger a criação com unicidade de `(ownerId, clientMutationId)` para que uma repetição da mesma requisição não duplique a nota.

`Note.ownerId → User` usa exclusão restrita. Criar os estados pessoais do dono na criação e dos convidados ao conceder acesso, com valores padrão. A exclusão definitiva da nota remove acessos, preferências e associações; excluir marcador remove somente suas associações. Revogar acesso remove as preferências e associações pessoais do participante na mesma transação; os marcadores dele permanecem. Preferências e marcadores nunca concedem acesso por si próprios.

## 7. API proposta

| Rota | Uso |
| --- | --- |
| `GET /api/notes` | Listar prévias com `scope=all/mine/shared`, `view=active/archived/hidden/trash`, `q`, `labelId`, `color` e paginação. |
| `POST /api/notes` | Criar nota pessoal e estado inicial; chave de criação idempotente; retornar ID e versão. |
| `GET /api/notes/:id` | Conteúdo completo, versão, dono, permissões efetivas e preferências do usuário. |
| `PATCH /api/notes/:id` | Alterar conteúdo/checklist com versão obrigatória e autorização de escrita. |
| `PATCH /api/notes/:id/state` | Cor, fixação, arquivo, ocultação e marcadores próprios; versão independente. |
| `GET /api/notes/share-options?q=...` | Pesquisa restrita de pessoas ativas para compartilhar; somente ID e nome, sem dados administrativos. |
| `PUT /api/notes/:id/access` | Dono define participantes e níveis de acesso, usando a versão da nota. |
| `POST /api/notes/:id/trash` | Dono move à lixeira global, com versão. |
| `POST /api/notes/:id/restore` | Dono restaura uma nota da lixeira, com versão. |
| `DELETE /api/notes/:id` | Dono exclui definitivamente uma nota já na lixeira, com versão e confirmação explícita. |
| `GET/POST /api/note-labels` | Consultar/criar marcadores pessoais. |
| `PATCH/DELETE /api/note-labels/:id` | Renomear ou excluir marcador pessoal. |

Listagem inicial de 40 notas por página, com teto na API. Ordem: fixadas primeiro na visualização ativa; depois última edição e ID como desempate. Manter a posição visual enquanto uma nota está em edição e reconciliar ao encerrar, evitando cartões pulando durante a digitação. A lista entrega prévias; o editor busca o conteúdo completo.

Registrar as rotas estáticas antes de `/:id`. Respostas privadas com `Cache-Control: private, no-store`; chamadas frontend com `credentials: 'include'`. Validar campos permitidos e origem das mutações autenticadas por cookie, considerando a configuração atual de `SameSite=None` em produção. Nunca registrar o conteúdo das notas em logs de diagnóstico.

## 8. Salvamento, conflitos e recuperação

1. Autosave após aproximadamente 700ms sem alterações. Serializar gravações por nota; enviar apenas a próxima fotografia do formulário após confirmar a versão anterior.
2. Só mostrar “Salvo” depois da confirmação da API. Respostas antigas não podem substituir texto digitado depois da requisição.
3. Conteúdo, compartilhamento e lixeira global incrementam `Note.version`. Cor, arquivo e outros estados pessoais usam `NoteUserState.version`, sem conflitar com edições de colegas.
4. Verificar acesso e versão dentro da transação. Escritas de conteúdo, mudanças de acesso, lixeira, estados pessoais e associações de marcadores precisam serializar pela mesma linha `Note`, com revalidação após o bloqueio e ordem de bloqueios consistente. Preferências não incrementam a versão do conteúdo, mas participam desse bloqueio para não recriar estados depois da limpeza de uma revogação. Isso impede aceitar uma edição depois de concluída uma revogação. A desativação de conta bloqueia requisições autorizadas depois de sua confirmação; uma operação já autorizada antes dela pode concluir.
5. Alteração concorrente retorna 409. Preservar rascunho e versão base; não tentar resolver trocando apenas o número da versão e reenviando o texto antigo.
6. Polling atualiza conteúdo somente quando o editor está limpo. Havendo alterações pendentes, avisar sobre nova versão e preservar o formulário.
7. Manter rascunho temporário em `sessionStorage`, por usuário e nota/chave de criação, para recuperar uma recarga na mesma aba. Não tratar esse rascunho como autorização para abrir a nota. Limpar após gravação confirmada, descarte, logout explícito ou entrada de uma conta diferente; salvar uma fotografia antiga não deve apagar um rascunho mais recente. Na expiração de sessão, preservar temporariamente o rascunho por até 30 minutos para recuperação após reautenticar a mesma conta e revalidar o acesso à nota.
8. Bloquear fechamento ou navegação interna enquanto houver gravação pendente, oferecendo aguardar, tentar novamente ou descartar explicitamente. Para fechamento externo, usar o aviso nativo quando houver edição pendente; não depender de uma requisição no fechamento da página.
9. Em 401, perda de acesso ou falta de rede, parar os reenvios. Coordenar `notesApi` e `AuthContext` para preservar o rascunho antes de emitir/tratar `motive:unauthorized`, pois o fluxo atual desmonta o editor imediatamente. Revalidar a sessão e o acesso antes de restaurar no editor; se a nota deixou de ser acessível, permitir recuperar somente o rascunho local já digitado, sem buscar conteúdo novo. Logout explícito deve resolver a edição pendente antes de limpar os rascunhos.
10. O rascunho temporário não garante recuperação após encerrar o navegador e não implementa fila offline. A API e o banco são a fonte principal dos dados.

Lixeira sem expurgo automático no MVP. Exclusão definitiva é manual e confirmada; restaurar preserva os estados pessoais existentes. Uma nota na lixeira sai das consultas dos colaboradores e não aceita edição ou novos compartilhamentos.

## 9. Arquivos previstos

```text
api/noteRoutes.js
api/noteAccess.js
api/server.js                              # registrar roteador e bloqueio de exclusão de dono
prisma/schema.prisma
prisma/migrations/<data>_add_notes/migration.sql
frontend/src/pages/Notes.jsx
frontend/src/components/notes/NoteCard.jsx
frontend/src/components/notes/NoteEditor.jsx
frontend/src/components/notes/NoteChecklist.jsx
frontend/src/components/notes/NoteFilters.jsx
frontend/src/components/notes/NoteShareDialog.jsx
frontend/src/components/notes/NoteConflictDialog.jsx
frontend/src/hooks/useNotes.js
frontend/src/hooks/useNoteAutosave.js
frontend/src/services/api.js               # notesApi e erros com status/código
frontend/src/context/AuthContext.jsx       # ciclo de rascunho na expiração e saída
frontend/src/App.jsx
frontend/src/components/AppLayout.jsx
frontend/src/index.css
scripts/verify-notes.mjs
docs/NOTAS.md
```

Reutilizar `Button`, `FeedbackState`, `ConfirmModal`, `FancySelect`, estilos de formulário, `useToast` e a infraestrutura de sessão. Adaptar padrões de Tarefas sem reutilizar diretamente seu escopo de equipe. Nomes e divisão dos novos arquivos podem ser ajustados durante a implementação.

## 10. Sequência de entrega

| Etapa | Entrega verificável |
| --- | --- |
| 1. Dados e autorização | Migração aditiva, modelos, escopo por dono/participante, níveis de acesso e transações. Testes de isolamento e revogação antes de construir a interface completa. |
| 2. API e persistência | CRUD, checklist, compartilhamento, estados pessoais, marcadores, busca e idempotência. Tratar 401/403/404/409 de forma distinguível. |
| 3. Experiência principal | Rota/menu, captura rápida, editor, grade/lista, filtros, participantes e salvamento automático. |
| 4. Recuperação e colaboração | Conflitos, polling, rascunhos, navegação pendente, ocultas, arquivo e lixeira com desfazer da movimentação. |
| 5. Validação e publicação | Testes com banco local isolado, verificação em celular/teclado, build/lint e publicação gradual para um grupo pequeno. Aplicar migração e gerar Prisma Client antes de habilitar o módulo. |

O maior esforço está em compartilhamento, preferências individuais e prevenção de perda de edição. Os cartões são a parte mais simples. Estimativas de calendário devem considerar disponibilidade e o resultado da primeira etapa; a análise estática não permite prometer prazo fechado.

## 11. Critérios de aceite

- Criar nota com título opcional, texto ou checklist; recarregar e reencontrar o conteúdo confirmado como salvo.
- Repetir uma criação após falha de resposta sem gerar duplicata.
- Dono, editor, leitor e terceiro recebem exatamente os acessos previstos; ADM não abre nota pessoal alheia.
- Leitor não altera texto nem marca checklist. Editor não compartilha nem exclui globalmente.
- Revogação e rebaixamento disputam a mesma linha da nota com o autosave; testar as duas ordens e garantir que nenhuma escrita seja autorizada depois da revogação efetiva. Desativação de conta bloqueia requisições posteriores, preservando a semântica de operações já autorizadas.
- Dois usuários organizam a mesma nota com cores, marcadores, arquivo e fixação diferentes sem interferência.
- Uma alteração de preferência concorrente com revogação não recria estado pessoal nem associação de marcador após a remoção do acesso.
- Ocultar e mostrar novamente funcionam; remover marcador preserva a nota.
- Busca inclui itens do checklist, aplica escopo no servidor e não revela dados por contagens ou marcadores.
- Duas abas editando o mesmo conteúdo recebem conflito sem perda silenciosa. Polling não sobrescreve rascunho nem avança sua versão base.
- Falha de rede, erro de permissão e sessão expirada não mostram “Salvo”; recuperação respeita conta, prazo temporário e acesso atual. Testar 401 antes da desmontagem, reentrada da mesma conta, troca de conta e logout explícito.
- Apenas o dono vê a lixeira global; restauração recupera a nota e exclusão definitiva exige confirmação. A lixeira bloqueia edição por colaboradores.
- Interface utilizável em 360px, com teclado, foco restaurado, rótulos nos ícones, contraste e ações disponíveis sem hover.
- Testes HTTP com PostgreSQL somente local, seguindo a proteção de `scripts/verify-tasks.mjs:32`; executar também regressões de tarefas e verificações do frontend após alterar código compartilhado.
- Não modificar nem migrar automaticamente observações de clientes ou anotações de tarefas.

## 12. Evolução após a primeira versão

1. **Contexto do CRM:** vincular opcionalmente a cliente ou imóvel. Excluir o cadastro remove o vínculo, preservando a nota. Compartilhamento não concede acesso ao cadastro relacionado; aplicar as permissões do perfil também no retorno da API.
2. **Criar tarefa a partir da nota:** abrir o editor existente com uma cópia do título/conteúdo; responsável e prazo continuam nas tarefas. Não sincronizar automaticamente os dois textos nem conceder acesso à nota pelo vínculo.
3. **Produtividade:** duplicação, modelos de anotação, ações em lote, reordenação e conversão entre texto e lista.
4. **Colaboração ampliada:** avisos de compartilhamento, histórico de versões recuperável, grupos e transferência de propriedade. `version` do MVP evita sobrescrita, mas não equivale a guardar histórico.
5. **Mídia e mobilidade:** imagens/anexos e offline, depois de definir armazenamento, limites, sincronização e recuperação.

## Referências de produto

A organização por marcadores, cores e fixação vem da [documentação oficial do Google Keep](https://support.google.com/keep/answer/6191044?co=GENIE.Platform%3DDesktop&hl=pt-BR). A separação entre conteúdo compartilhado e organização individual também está descrita em [Compartilhar notas, listas e desenhos](https://support.google.com/keep/answer/6101196?co=GENIE.Platform%3DDesktop&hl=pt-BR).

Permissões de leitura/edição, retenção da lixeira e demais regras deste documento são propostas para o Motive. Não se pressupõe equivalência integral com o Google Keep.
