# Tarefas

A área `/tasks` reúne tarefas pessoais e da equipe, com criação rápida, prazo, importância, Meu dia, responsável, anotações, etapas e cliente opcional. O painel usa ações recolhíveis: apenas o título é obrigatório. O círculo alterna Pendente/Concluída e Aguardando retorno é uma marcação opcional. Ao terminar a edição, clique em Salvar. As visualizações incluem Meu dia, Importantes, Atrasadas, Planejadas, Aguardando retorno e Concluídas. Listas pessoais e compartilhadas organizam as tarefas. Excluir uma lista mantém suas tarefas sem lista. Concluir e excluir tarefas oferecem Desfazer; a exclusão de tarefas é lógica.

Adicionar prazo oferece Hoje, Amanhã, Próxima semana (daqui a sete dias, com a data exibida), Escolher uma data e Remover prazo. O calendário só aparece quando solicitado. As datas consideram America/Sao_Paulo e a soma de dias funciona em mudanças de mês e ano. Não há campo separado de planejamento futuro. Adicionar ao Meu dia marca a tarefa para hoje sem alterar o prazo; retirar a marca não exclui nem conclui a tarefa. No dia seguinte, a tarefa sai de Meu dia e permanece nas demais listas, sem perder seu prazo. A tela verifica a virada do dia a cada minuto. Ao gerenciar uma tarefa de outra pessoa, o botão identifica o dia do responsável. Datas e situações antigas são preservadas até serem alteradas.

## Acesso

- Administradores visualizam e gerenciam as tarefas de toda a equipe.
- O acesso total às tarefas é exclusivo do perfil ADM. A antiga permissão `canManageAllTasks` é ignorada pelo servidor e foi removida do cadastro. A coluna permanece apenas por compatibilidade, sem conceder acesso.
- Demais usuários só leem, criam e alteram tarefas atribuídas a si mesmos. Podem editar título, prazo, anotações e etapas, concluir, reabrir, excluir e restaurar tanto tarefas próprias quanto recebidas. Somente administradores podem reatribuir a outra pessoa. Listagens, pesquisas, contagens, detalhes, conclusão, exclusão, restauração e filtros por cliente aplicam o escopo no servidor.
- Uma lista compartilhada não libera acesso às tarefas de outras pessoas. Uma lista pessoal só recebe tarefas atribuídas ao dono. Administradores podem consultar as listas pessoais da equipe.
- O acesso e o estado ativo do usuário são consultados no banco em cada requisição de tarefas; a permissão não é aceita do cookie ou do corpo da requisição.
- O módulo respeita os perfis que têm Clientes no menu: ADM e ASSISTENTE podem pesquisar, vincular e abrir clientes. CORRETOR não recebe identificação nem nome do cliente vinculado; o acesso a tarefas não libera a área Clientes. O sistema atual não possui uma ACL individual por cliente.
- A reatribuição de tarefas muda imediatamente quem pode acessá-las. Para atribuir a outro usuário, é preciso permissão de equipe e uma lista compartilhada ou pessoal do novo responsável.

Cada tarefa tem uma versão. Atualizações concorrentes retornam 409 e exigem atualizar a tarefa, evitando sobrescrever uma edição recente.

## Redes Sociais

Ao selecionar um imóvel para uma nova publicação (inclusive vindo do mapa), o editor consulta publicações pendentes e não excluídas do mesmo imóvel, limitadas às permissões do usuário. O aviso mostra até 20 tarefas, responsável e data, com opção de abrir uma existente ou optar por criar outra. A consulta é repetida antes de salvar; se as pendências mudarem, a escolha deve ser revista. A mesma verificação ocorre ao trocar o imóvel de uma tarefa existente, sem contar a própria tarefa. É uma prevenção assistida de duplicidade, não uma restrição única no banco: publicações repetidas são permitidas e duas criações simultâneas ainda podem ocorrer.

O cartão de imóvel destaca o estado “Indisponível” em vermelho e pede revisão da postagem. A situação vem do cadastro atual do mapa. A lista e o imóvel aberto no editor são atualizados ao retornar à janela; o aviso não cancela nem conclui tarefas automaticamente. Estes ajustes não exigem nova migração.

A lista fixa “Redes Sociais” reúne tarefas de publicação (`category: SOCIAL`) dentro do mesmo módulo, mantendo o escopo por responsável. Criar uma publicação pede título, responsável e data prevista opcional, com os atalhos já usados para prazos. O formulário não inclui canal, formato, legenda, etapas de produção nem link de postagem. O vínculo com imóvel é opcional. As notificações e a conclusão seguem as regras gerais das tarefas.

O buscador de imóveis aceita título, código ou endereço, com pelo menos dois caracteres e pausa de 350 ms. Entrega até 20 resultados e apenas os dados necessários ao cartão (foto/capa do Drive, título/código, bairro, cidade, endereço, valor e disponibilidade). O acesso de leitura aos imóveis segue o mapa, disponível aos usuários ativos. “Abrir imóvel no mapa” seleciona o imóvel; “Criar publicação” na ficha do mapa abre a tarefa com esse imóvel e a lista Redes Sociais preenchidos. Excluir um imóvel remove o vínculo, preservando a tarefa.

A ordem padrão considera a data prevista (sem data ao final). “Ordem da fila” exibe a posição manual persistida; administradores podem subir/descer publicações pendentes na fila completa, sem filtros. A ordenação troca posições de tarefas adjacentes em transação e verifica suas versões, sem gerar notificações. Usuários limitados enxergam apenas suas tarefas na ordem definida pela equipe. “Mostrar concluídas” abre o histórico da lista. Novas publicações entram ao final da fila manual.

Aplicar `20260910190000_social_tasks` e gerar o Prisma Client. A migração adiciona categoria, posição e vínculo opcional ao imóvel, com índices e exclusão do vínculo por `SET NULL`. Tarefas anteriores permanecem gerais; a categoria de origem não muda após criar. A lista fixa não depende de uma lista compartilhada criada por usuário. Testes cobrem busca, vínculo opcional/inválido, isolamento, ordenação e conflito de versões, histórico e preservação da tarefa ao excluir o imóvel.

## Delegação a partir do cliente

Na ficha do cliente, “Criar tarefa” abre um formulário dentro da própria ficha: título, responsável e prazo opcional, com atalhos Hoje/Amanhã/Próxima semana. O cliente vem vinculado e a lista de pendências é atualizada após salvar. O acesso limitado permite criar para si; administradores podem escolher outro usuário ativo. Os itens da lista abrem os detalhes da tarefa.

“Delegadas por mim” aparece para administradores. Exibe demandas cuja atribuição mais recente a outra pessoa foi feita pelo usuário atual, com filtros Pendentes, Concluídas ou Todas, além dos filtros de responsável e cliente. A tarefa armazena `delegatedById` separadamente do criador original; uma reatribuição atualiza o delegador. O campo é definido pelo servidor e não pode ser enviado pelo cliente. Nova tarefa nessa visão pede a seleção de outra pessoa.

Aplicar `20260910170000_task_delegation` e gerar o Prisma Client. Para tarefas anteriores, sem histórico de quem reatribuiu, a migração usa o criador original como delegador quando diferente do responsável. Nenhuma conclusão retroativa gera aviso.

## Notificações de atribuição e conclusão

O sino no cabeçalho mostra as notificações individuais e o total não lido. Criar uma tarefa pendente para outra pessoa ou trocar seu responsável gera um aviso na mesma transação da tarefa. Atribuir a si mesmo ou editar título/prazo/anotações não gera avisos adicionais. Não há envio retroativo para tarefas existentes.

Ao passar de pendente para concluída, a tarefa gera um aviso `COMPLETED` para quem a delegou, se essa pessoa estiver ativa, mantiver a permissão de equipe e não for quem executou a conclusão. O aviso identifica quem concluiu e abre a tarefa. Salvar novamente como concluída não duplica o aviso. Reabrir remove o aviso de conclusão; uma nova conclusão pode avisar novamente. Ler qualquer aviso continua separado de cumprir a tarefa.

Os avisos ficam no banco e aparecem ao entrar novamente. Com o sistema aberto e a aba visível, a consulta ocorre a cada 30 segundos e ao retornar à janela. Novas atribuições mostram um aviso discreto com “Ver tarefa”; o carregamento inicial apresenta os avisos guardados no sino, sem disparar uma sequência de pop-ups. O painel mostra 30 avisos recentes e permite consultar anteriores. Clicar no aviso marca como lido e abre `/tasks?task=ID`; também é possível marcar todos os avisos já recebidos como lidos. Uma notificação que chegar durante essa ação permanece não lida.

Mesmo administradores só acessam suas próprias notificações. O servidor verifica o destinatário e o estado ativo do usuário; atribuições exigem que ele ainda seja o responsável, e conclusões exigem que ele ainda seja o delegador com permissão de equipe e a tarefa permaneça concluída. Reatribuir remove avisos anteriores da tarefa; tarefas excluídas deixam de aparecer, e desfazer a exclusão recupera o aviso existente. Dados de clientes seguem a permissão do perfil, inclusive no sino. O link da tarefa revalida o acesso no servidor.

Aplicar também `20260910150000_add_task_notifications` e gerar novamente o Prisma Client antes de iniciar a API. A migração cria apenas a tabela de notificações e seus índices/relações. Os testes de tarefas cobrem destinatários, leitura individual, transferência, ausência de duplicações, paginação, leitura em lote e bloqueio de usuários inativos. Não há e-mail, push do navegador ou lembrete de vencimento nesta versão.

## Sessões assinadas

O cookie `motive_session` passa a ser assinado com HMAC-SHA256 e validade de oito horas. Cookies antigos sem assinatura são rejeitados: usuários precisam entrar novamente após a publicação. Configure `SESSION_SECRET` em produção (o `JWT_SECRET` existente também é aceito). Nenhum segredo é gravado no repositório. A checagem administrativa também consulta o perfil atual no banco.

## Instalação e validação

Aplicar `20260909170000_add_tasks` pelo fluxo de migrações existente e gerar o Prisma Client. A migração é aditiva: novas tabelas e uma permissão com padrão false. Nenhuma permissão extra é concedida a usuários existentes que não sejam administradores. Usuários com tarefas atribuídas não podem ser excluídos fisicamente até que elas sejam transferidas; a desativação continua disponível.

`npm run test:tasks` verifica validação, assinatura das sessões e isolamento de acesso por HTTP com PostgreSQL. Só roda contra localhost/127.0.0.1; cria registros temporários identificados e remove exclusivamente esses registros ao terminar. Não executar contra produção. Verificar também build e lint do frontend.

Não inclui lembretes externos nem recorrência nesta versão. Todos os dados de tarefas ficam no banco do sistema; não há integração com Microsoft To Do.
