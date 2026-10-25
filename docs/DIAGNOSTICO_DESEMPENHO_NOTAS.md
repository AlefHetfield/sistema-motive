# Diagnóstico prático de desempenho das notas

Data: 25/10/2026. Ambiente: frontend de produção na Vercel e API de produção no Render. Revisão local analisada: `7998211`.

## O que foi testado

Na conta conectada pelo usuário, foi criada a nota `TESTE DE DESEMPENHO — 25/10/2026`. O título foi salvo, o corpo foi alterado duas vezes, a nota foi fixada, fechada, reaberta e enviada à lixeira. O texto persistiu corretamente e o compartilhamento padrão mostrou seis participantes.

As duas notas anteriores foram preservadas. A nota de diagnóstico permaneceu na lixeira, recuperável pelo produto; não houve exclusão definitiva. Evidência local: `output/notas-teste-lixeira-2026-10-25.png`.

| Operação | Tempo observado | Critério |
| --- | ---: | --- |
| Abrir editor de nova nota | 0,5 s | Clique até editor visível |
| Salvar alteração do corpo | 5,1 s | Digitação até “Todas as alterações salvas” |
| Fixar dentro do editor | 5,6 s | Clique até controle mudar para “Desafixar nota” |
| Fechar e exibir cartão novo na lista | 3,8 s | Clique em Concluir até cartão visível |
| Reabrir nota existente | 2,1 s | Clique até editor visível com conteúdo persistido |
| Mover para lixeira | 4,0 s | Confirmação até mensagem de sucesso |

São amostras de um fluxo real, com pequena sobrecarga da automação. Não representam mediana ou percentil de produção. O tempo da criação inicial não foi isolado com precisão suficiente para entrar na tabela. A mensagem de exclusão apareceu enquanto o cartão ainda estava na lista antiga; ele desapareceu após a consulta seguinte.

O acesso inicial ficou em “Verificando permissões” por mais de um minuto, antes de apresentar o login. Uma consulta separada ao `/api/health` da API levou 5,7 s e retornou `status: ok`. Isso mostra demora também fora do módulo de notas, mas não distingue rede, inicialização da API, pool ou banco. Esse health check executa `SELECT 1`; não é uma medida exclusiva de rede.

## Causas confirmadas no código

1. **Abertura bloqueada por consulta:** `Notes.open` consulta `GET /notes/:id` antes de abrir o editor, embora a listagem já contenha a nota completa. A interface aguarda a rede para apresentar dados que já possui.
2. **Criação não entra na lista com a resposta do POST:** `Notes.saved` substitui apenas notas existentes. A nota nova aparece somente no recarregamento disparado por `closeEditor`. Isso explica a espera entre fechar e ver o cartão.
3. **Estado gravado seguido de GET redundante:** `NoteEditor.organize` recebe a nota atualizada do PATCH, chama `onSaved(updated)` e depois aguarda `checkRemote`. O hook do editor só adota o estado novo após esse GET. O compartilhamento repete esse padrão.
4. **Lista inteira recarregada após ações individuais:** fixar, arquivar, restaurar e mover à lixeira chamam `refresh()`. A resposta da mutação já fornece informações para atualizar ou remover o cartão. Na exclusão, isso deixa a mensagem de sucesso e a lista temporariamente divergentes.
5. **Leituras completas duplicadas nas mutações:** `mutateNote` bloqueia a nota, chama `readNote`, grava e chama `readNote` novamente. As duas leituras usam `noteInclude`, incluindo dono, todos os acessos e seus usuários, preferências pessoais e marcadores. O mesmo fluxo pesado atende alteração de texto e uma simples mudança de cor.
6. **Listagem carrega dados completos:** a API entrega corpo, itens e participantes de cada nota para a grade. Isso ainda não explica sozinho a lentidão observada com apenas duas notas preexistentes, mas amplia o custo conforme o uso crescer.
7. **Espera intencional de salvamento:** `useNoteAutosave` espera 700 ms de pausa na digitação. Esse intervalo é útil para agrupar alterações; reduzi-lo sozinho não resolve uma confirmação de aproximadamente cinco segundos.
8. **Revalidação sem agrupamento:** foco e mudança de visibilidade podem disparar consultas próximas. Existem proteções contra aplicar respostas antigas, mas não um agrupamento de leituras simultâneas. Há também atualização periódica a cada 30 s.

As inspeções acima identificam chamadas HTTP e operações Prisma no código. Não houve acesso ao plano de execução ou à contagem de consultas SQL do banco de produção. Um `include` do Prisma não deve ser tratado como uma única consulta SQL sem medir a estratégia efetiva.

## Melhorias, em ordem de execução

### 1. Resposta visual e menos consultas HTTP

- Abrir a nota já disponível em memória e revalidar em segundo plano, preservando texto digitado durante a consulta, controle de acesso e verificação de versão nas gravações.
- Inserir a nota recém-criada no estado local assim que o POST confirmar. Conciliar filtros, paginação e posição sem depender de fechar o editor.
- Adotar a resposta do PATCH no hook e no cartão. Criar uma operação própria para adotar respostas de mutação, com proteção contra regressão de versão e preservação de rascunho; não chamar `adoptClean` indiscriminadamente enquanto houver edição pendente.
- Atualizar ou remover o cartão após confirmação do servidor, sem aguardar uma segunda consulta para representar a ação concluída. Fazer a reconciliação da lista em segundo plano quando filtros, contagem ou paginação exigirem.
- Para feedback anterior à confirmação, usar estado visual “pendente” e reversão em falha. Nunca mostrar “salvo” antes de confirmação da API.
- Agrupar revalidações de foco/visibilidade e impedir leituras simultâneas redundantes da mesma nota.

Esta etapa reduz a espera percebida e elimina viagens extras, mas não torna a gravação no servidor mais rápida por si só.

### 2. Reduzir trabalho do banco por ação

- Separar a leitura necessária à autorização/validação da montagem da resposta completa. Antes da escrita, consultar apenas os campos necessários e o acesso do usuário atual; carregar a apresentação completa uma vez depois da alteração.
- Diferenciar o caminho de preferências pessoais do caminho de conteúdo. Uma mudança de cor não precisa validar ou carregar todo o documento e toda a equipe duas vezes.
- Preservar a coordenação transacional entre revogação de acesso e gravação. Não remover bloqueios apenas para melhorar a velocidade.
- Avaliar inserção em lote dos acessos e preferências na criação compartilhada, dentro da mesma transação, mantendo a chave idempotente.
- Depois das melhorias imediatas, avaliar um contrato de resumo para os cartões e carregamento completo sob demanda. Coordenar essa mudança com o cache do editor para não reintroduzir a espera na abertura.

### 3. Instrumentar e verificar a infraestrutura

- Medir na API: duração total, autenticação, espera pelo pool, consulta/SQL e transação, sem registrar conteúdo das notas ou dados de sessão.
- Relacionar essas métricas ao tempo HTTP observado no navegador, distinguindo requisição inicial e API já ativa.
- Conferir as regiões efetivamente configuradas para API e banco, além de suspensão por inatividade, conexões do pool e eventuais bloqueios. O teste realizado não permite atribuir a demora a uma dessas causas isoladamente.
- A autenticação inicial precisa ter timeout e recuperação visível; hoje o `fetch` de `/api/auth/me` pode deixar a tela em “Verificando permissões” sem um prazo definido.
- Existem dois registros de `/api/health` no servidor; o primeiro executa a consulta ao banco e responde antes do segundo. Consolidar o contrato para evitar diagnósticos ambíguos.

## Critérios de aceite sugeridos

- Editor aparece com os dados em memória em até 200 ms, como meta a verificar, sem depender de GET para abrir a janela.
- Após resposta bem-sucedida da mutação, o cartão e o editor refletem a mudança no próximo render, sem uma segunda viagem obrigatória à API.
- Criar, alterar, fixar e enviar à lixeira devem ter métricas separadas de tempo visual e confirmação remota; medir várias repetições, incluindo p50/p95.
- Manter os testes existentes de autosave, idempotência, conflitos, revogação, navegação e recuperação. Acrescentar cenários de resposta antiga após mutação, criação com filtro ativo, remoção do último cartão da página e falha com reversão de feedback otimista.

## Implementação e verificação posterior

As melhorias de interface e de leitura da API foram implementadas depois do diagnóstico acima. O editor abre com a nota em memória e revalida em segundo plano; criação, organização e exclusão atualizam os cartões com a resposta da mutação. As versões de conteúdo/acesso e de organização pessoal são conciliadas separadamente. Respostas antigas da lista são canceladas e reconciliadas quando disputam com uma mutação confirmada. Paginação e filtros são preservados.

Na API, a leitura anterior à alteração ficou restrita ao necessário para validar conteúdo, estado ou acesso. Os bloqueios contra revogação concorrente foram mantidos. A criação usa inserção aninhada em lote para os participantes e preferências. O cabeçalho Server-Timing permite medir o custo do servidor sem registrar dados da nota. A rota duplicada de health check foi removida, mantendo a verificação existente do banco.

A sessão inicial passou a ter timeout de 15 segundos e uma tela para tentar novamente em falhas de rede/servidor; somente respostas de sessão realmente inválida redirecionam ao login.

Comparação de consultas Prisma/SQL com o mesmo PostgreSQL local e usuários temporários, contabilizando também autenticação e controle transacional:

| Operação | Antes | Depois |
| --- | ---: | ---: |
| Criar | 15 | 15 |
| Editar | 17 | 13 |
| Fixar | 17 | 14 |
| Mover à lixeira | 17 | 13 |

Essa contagem foi medida, não inferida dos includes. Os tempos locais não equivalem à latência de produção; a diferença de inicialização de conexão também impede usar a primeira criação como comparação de tempo. O ganho prático em produção precisa ser medido após publicar.

### Segunda melhoria: criação e salvamento contínuo

Após o relato de espera prolongada em “Salvando…”, a leitura completa da nota passou a usar uma única consulta SQL parametrizada, reunindo dono, participantes, preferências e marcadores. A autorização permanece filtrada na consulta e validada no servidor; as escritas continuam coordenadas pelos mesmos bloqueios. O caminho de criação consulta somente o ID para detectar repetição e monta a resposta pela nova leitura, preservando a criação idempotente.

Na nova medição local, criar passou de 15 para 11 consultas; editar e mover à lixeira passaram de 13 para 8; fixar passou de 14 para 9. A resposta foi comparada com a apresentação anterior, incluindo compartilhamento, marcadores pessoais e datas de arquivamento/ocultação.

O autosave agora envia uma fotografia por pausa. Alterações digitadas durante uma requisição ficam no rascunho e são agrupadas para a próxima pausa. O fechamento explícito continua drenando todas as alterações, inclusive quando aguarda um POST de criação já em andamento. O botão Concluir permanece disponível durante o autosave e só bloqueia enquanto o fechamento está em andamento.

Não houve mudança no indicador de confirmação: “Todas as alterações salvas” ainda exige confirmação da API. Essas contagens não prometem um tempo fixo em produção, que depende também da rede e do banco.

### Terceira melhoria: resposta imediata e fila persistente

Fixação, arquivamento, ocultação e envio à lixeira passaram a usar projeções imediatas. A confirmação da API atualiza o estado definitivo; falhas retiram a projeção e atualizam a lista. A exclusão permanente continua explícita e aguarda o servidor. As projeções não incrementam versões reais nem alteram a base de autorização.

Nos navegadores com IndexedDB e Web Locks, a cópia de cada edição é confirmada localmente antes de permitir fechar ou navegar. A sincronização continua fora do editor e da página, com estados visíveis e recuperação após recarga. Uma fila por conta preserva fotografias enviadas e alterações posteriores, coordena abas, pausa conflitos/revogação e usa o mesmo identificador de criação em respostas perdidas. O fallback anterior continua disponível quando as APIs do navegador não existem. Limpeza dos dados do navegador ainda pode apagar cópias não enviadas; isso não é um backup externo nem um modo offline completo.

A leitura necessária antes da mutação também passou a usar uma consulta parametrizada, executada depois do bloqueio em uma instrução separada para revalidar revogações com snapshot atual. Na medição local, editar e mover à lixeira passaram de 8 para 7 consultas, e fixar de 9 para 7. Criar permaneceu em 11. Há uma verificação de capacidade/conta por sessão de sincronização antes do primeiro envio persistente, sem bloquear a interação com o editor.

Os testes adicionais exercitam o worker automático, fechamento antes da resposta HTTP, navegação enquanto sincroniza, recarga, perda de resposta POST/PATCH, conflito entre usuários, duas abas, armazenamento cheio, sessão expirada, troca de conta, logout cancelado e reversão de ações otimistas. O armazenamento de teste usa fake-indexeddb somente como dependência de desenvolvimento.

Foram verificados autosave, proteção do rascunho, consultas agrupadas, respostas fora de ordem, adoção da organização durante gravação de texto, revogação de acesso, criação sem recarregar, exclusão concorrente com listagem, filtros, paginação e recuperação de falha na autenticação.

Não foram alterados região, plano, banco de produção ou contrato de resumo da listagem. O último continua completo para permitir abertura imediata com os dados disponíveis. A avaliação de infraestrutura continua dependendo de métricas no ambiente publicado.

## Escopo do diagnóstico original

Nenhum código funcional, variável de produção, plano de hospedagem ou esquema do banco foi alterado. O trabalho realizado foi o teste autorizado de uma nota temporária e a análise do fluxo atual. A prioridade é implementar a etapa 1 e a leitura mais enxuta da etapa 2, medir novamente e então decidir se a infraestrutura exige mudanças.
