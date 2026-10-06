# Prévia visual dos contratos

A API gera o mesmo DOCX do download e o converte localmente com LibreOffice.
O navegador desenha o PDF em canvas (sem camada de texto selecionável).
Nenhum contrato é salvo no banco e nenhum serviço externo recebe o documento.
Arquivos temporários ficam em uma pasta exclusiva e são removidos ao terminar.

## Desenvolvimento Windows

Instale LibreOffice, ou extraia uma distribuição oficial em
`.local/tools/libreoffice` (com `program/soffice.exe`). Alternativamente configure
`LIBREOFFICE_PATH` com o caminho absoluto do executável e reinicie a API.

## Hospedagem Render

O runtime Node atual não fornece LibreOffice. O Dockerfile na raiz inclui o
conversor e fontes de substituição compatíveis. Antes de publicar esta função,
mude o runtime do serviço existente para Docker, usando esse Dockerfile.
Preserve todas as variáveis de ambiente existentes; não crie um banco novo.
A migração do runtime e o deploy precisam ser feitos no Render, não ocorrem
apenas por adicionar o Dockerfile ao repositório. O render.yaml foi mantido
inalterado para não migrar a infraestrutura implicitamente.

Referência: https://render.com/docs/native-runtimes

## Limites e validação

- Pausa de 1,4 s na digitação; somente uma conversão simultânea por processo API.
- Tempo máximo de 45 s. API responde 429 quando o conversor está ocupado.
- Sem conversor: erro explicativo; o download Word não é afetado.
- Fontes, formas e paginação dependem do LibreOffice. Não há garantia de
  igualdade pixel a pixel ao Word; verifique o modelo também em produção.
- Testes: `node --test scripts/verify-contract-preview.mjs`.
- Conversão real opcional: `CONTRACT_PDF_TEST=1 node --test scripts/verify-contract-preview.mjs`.
