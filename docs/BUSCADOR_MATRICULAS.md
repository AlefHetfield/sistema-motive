# Buscador de matrículas

A ferramenta está em `/matriculas`, no grupo Documentos do menu, para todos os perfis autenticados. A API usa o mesmo middleware de sessão do sistema.

## Uso

Digite rua, número ou bairro. Os filtros adicionais permitem combinar lote, quadra, matrícula, indicador fiscal e palavras presentes em qualquer campo. A cidade inicial é Sumaré; selecione outra cidade ou todas para ampliar a busca. Clique em **Buscar** ou pressione **Enter** para consultar, em páginas de 24 registros. Digitar, selecionar uma sugestão ou alterar filtros não dispara consultas. Os resultados anteriores permanecem visíveis até enviar a nova busca, com um aviso quando os filtros foram alterados. A paginação e a repetição de uma consulta com erro usam os filtros da última busca enviada. Limpar cancela uma busca em andamento e retorna à tela inicial.

A busca ignora acentos e maiúsculas. A rua aceita partes do nome e abreviações iniciais como R. e Av. Número, lote, quadra, matrícula e indicador fiscal usam igualdade após normalização de pontuação e zeros iniciais. Os valores exibidos e copiados preservam os identificadores da fonte. Todos os filtros são combinados. Vários registros compatíveis são exibidos para escolha, sem inferir que um endereço incompleto identifica uma matrícula única.

Matrículas preenchidas com zero são apresentadas como não informadas. Campos ausentes não são completados por inferência. A base contém registros de outros municípios, nomes antigos e endereços sem número. A linha original fica disponível nos detalhes de cada resultado. A importação não interpreta textos da planilha como instruções.

## Base e atualização

A primeira importação contém 171.239 linhas de dados de `matriculas_urbanas_sumare.xlsx`, primeira aba, mantendo as dez colunas originais. A base compactada fica em `api/data/matriculas.json.gz`, sem ser enviada integralmente ao navegador. O índice é carregado uma vez por processo, sob demanda. Não há migração do banco transacional nem consulta automática ao cartório.

O formato interno v2 armazena os valores distintos de cada coluna em dicionários e as referências de cada linha em inteiros de 32 bits little-endian, codificados em base64 no JSON. O servidor normaliza cada valor distinto uma vez e materializa somente os registros da página solicitada. Isso evita manter cópias dos endereços e um texto completo de busca para cada linha. A conversão preserva valores, ordem, linhas de origem e metadados da importação.

Para substituir a base, execute na raiz com Node disponível:

```powershell
node scripts/import-matriculas.mjs "C:/caminho/matriculas_urbanas_sumare.xlsx"
node --test scripts/verify-matriculas.mjs
```

O importador valida o formato e armazena nome da fonte, aba, horário de importação e SHA-256. Para uma nova base, atualize os testes de contagem e dos exemplos reais conforme os dados novos. Inclua o arquivo compactado na entrega e reinicie/republique o backend para reconstruir o índice. A configuração Vercel inclui explicitamente esse arquivo nas funções.

## Validação

`node --test scripts/verify-matriculas.mjs` verifica normalização, filtros exatos, dados ausentes, múltiplos resultados, paginação, registros reais e proteção das rotas com middleware de autenticação. O teste HTTP usa uma sessão simulada, sem acessar usuários ou banco de produção.

`npm run test:matriculas:memory` carrega a base real e executa 101 consultas em um processo isolado com heap limitado a 128 MiB, incluindo pesquisas amplas e uma entrada de tamanho máximo. O teste também exige RSS amostrado inferior a 320 MiB. Esse limite verifica o buscador isoladamente; o consumo total da API depende dos demais módulos e das requisições simultâneas.
