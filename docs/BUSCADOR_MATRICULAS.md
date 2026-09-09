# Buscador de matrículas

A ferramenta está em `/matriculas`, no grupo Documentos do menu, para todos os perfis autenticados. A API usa o mesmo middleware de sessão do sistema.

## Uso

Digite rua, número ou bairro. Os filtros adicionais permitem combinar lote, quadra, matrícula, indicador fiscal e palavras presentes em qualquer campo. A cidade inicial é Sumaré; selecione outra cidade ou todas para ampliar a busca. Os resultados atualizam após uma pausa de 350 ms na digitação, em páginas de 24 registros.

A busca ignora acentos e maiúsculas. A rua aceita partes do nome e abreviações iniciais como R. e Av. Número, lote, quadra, matrícula e indicador fiscal usam igualdade após normalização de pontuação e zeros iniciais. Os valores exibidos e copiados preservam os identificadores da fonte. Todos os filtros são combinados. Vários registros compatíveis são exibidos para escolha, sem inferir que um endereço incompleto identifica uma matrícula única.

Matrículas preenchidas com zero são apresentadas como não informadas. Campos ausentes não são completados por inferência. A base contém registros de outros municípios, nomes antigos e endereços sem número. A linha original fica disponível nos detalhes de cada resultado. A importação não interpreta textos da planilha como instruções.

## Base e atualização

A primeira importação contém 171.239 linhas de dados de `matriculas_urbanas_sumare.xlsx`, primeira aba, mantendo as dez colunas originais. A base compactada fica em `api/data/matriculas.json.gz`, sem ser enviada integralmente ao navegador. O índice é carregado uma vez por processo, sob demanda. Não há migração do banco transacional nem consulta automática ao cartório.

Para substituir a base, execute na raiz com Node disponível:

```powershell
node scripts/import-matriculas.mjs "C:/caminho/matriculas_urbanas_sumare.xlsx"
node --test scripts/verify-matriculas.mjs
```

O importador valida o formato e armazena nome da fonte, aba, horário de importação e SHA-256. Para uma nova base, atualize os testes de contagem e dos exemplos reais conforme os dados novos. Inclua o arquivo compactado na entrega e reinicie/republique o backend para reconstruir o índice. A configuração Vercel inclui explicitamente esse arquivo nas funções.

## Validação

`node --test scripts/verify-matriculas.mjs` verifica normalização, filtros exatos, dados ausentes, múltiplos resultados, paginação, registros reais e proteção das rotas com middleware de autenticação. O teste HTTP usa uma sessão simulada, sem acessar usuários ou banco de produção.
