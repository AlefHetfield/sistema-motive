// Keep published IDs stable. Add an entry when a release note is requested.
export const releaseAnnouncements = Object.freeze([
  Object.freeze({
    id: '2026-11-comissoes-clientes',
    publishedAt: '2026-11-10T03:00:00.000Z',
    audience: Object.freeze(['ADM']),
    title: 'Atualização do sistema',
    highlights: Object.freeze([
      'Informe a comissão bruta dos processos marcados como Venda em Clientes.',
      'Inclua os descontos de Visita Diego, Corretora Vânia e outros valores com descrição.',
      'Acompanhe a comissão líquida e revise os valores quando os descontos ultrapassarem o bruto.',
      'Copie um relatório com cliente, imóvel, status, observações e comissões detalhadas.',
    ]),
  }),
  Object.freeze({
    id: '2026-11-imoveis-engenharias',
    publishedAt: '2026-11-09T03:00:00.000Z',
    audience: Object.freeze(['ADM', 'ASSISTENTE']),
    title: 'Atualização do sistema',
    highlights: Object.freeze([
      'Acesse Mapa e Engenharias pela área Imóveis.',
      'Consulte entrada, avaliação e vencimento pela ficha do imóvel.',
      'Cadastre uma engenharia pelo mapa com o vínculo preenchido.',
    ]),
  }),
]);
