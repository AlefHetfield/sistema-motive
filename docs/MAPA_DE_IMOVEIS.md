# Mapa de Imóveis

## Configuração do Google Maps

O módulo usa duas chaves separadas para reduzir o risco de uso indevido:

1. Ative **Maps JavaScript API** e **Geocoding API** no projeto do Google Cloud.
2. Crie uma chave de navegador, restrita por referenciador HTTP aos domínios do sistema.
3. Crie uma chave de servidor, restrita somente à Geocoding API.
4. Configure as variáveis:

```env
# frontend/.env (desenvolvimento) e ambiente do frontend na Vercel
VITE_GOOGLE_MAPS_API_KEY=sua_chave_de_navegador

# .env (desenvolvimento) e ambiente da API na Vercel
GOOGLE_MAPS_API_KEY=sua_chave_de_servidor
```

Para desenvolvimento, autorize `http://localhost:5173/*` na chave de navegador. Em produção, autorize apenas o domínio real do sistema. Nunca reutilize uma chave sem restrições.

Documentação oficial: https://developers.google.com/maps/documentation/javascript/get-api-key

## Importação do My Maps

No Google My Maps:

1. Abra o menu do mapa.
2. Escolha **Exportar para KML/KMZ**.
3. Selecione a opção de exportar como **KML**, e não KMZ.
4. No Motive, abra **Mapa de Imóveis → Importar My Maps**.

Também é possível importar o CSV de uma camada. O importador reconhece nomes comuns de colunas como `Nome`, `Valor`, `Endereço`, `Tipo`, `Dormitórios`, `Latitude`, `Longitude` e `WKT`.
