import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { calculateHousingSimulation } from '../src/utils/housingSimulator.js';
import { MUNICIPAL_LIMITS } from '../src/data/municipalLimits.js';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = path.join(frontend, `.verify-simulation-pdf-${randomUUID()}.mjs`);
const outputDir = process.argv[2] && path.resolve(process.argv[2]);
const output = await build({
  entryPoints: [path.join(frontend, 'src/utils/housingSimulationPdf.js')],
  bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external',
  loader: { '.png': 'dataurl', '.ttf': 'dataurl' },
  plugins: [{ name: 'inline-image', setup(builder) {
    builder.onResolve({ filter: /\.(png|ttf)\?inline$/ }, (args) => ({ path: path.resolve(args.resolveDir, args.path.replace('?inline', '')) }));
  } }],
});
await writeFile(bundlePath, output.outputFiles[0].text);

try {
  const { createHousingSimulationPdf } = await import(pathToFileURL(bundlePath).href);
  const date = new Date('2026-10-27T01:30:00Z');
  const input = {
    bank: 'CAIXA', modality: 'MCMV', birthDate: '1990-05-20', income: 9000,
    fgts3y: true, previousSubsidy: 'no', uf: 'SP', municipality: 'Sumaré',
    propertyCondition: 'Usado', propertyValue: 350000, downPayment: 70000,
    system: 'SAC', term: 420, targetInstallment: 0, relationship: 'none',
  };
  const municipality = { uf: 'SP', name: 'Sumaré', limit: MUNICIPAL_LIMITS.SP.find(([name]) => name === 'Sumaré')[1] };
  const scenarios = [
    { name: 'caixa-mcmv', input },
    { name: 'caixa-sbpe', input: { ...input, modality: 'SBPE', system: 'PRICE', term: 360 } },
    { name: 'bradesco', input: { ...input, bank: 'BRADESCO', system: 'PRICE', term: 360 } },
    { name: 'saved-result', input, omitContext: true },
    { name: 'long-city', input: { ...input, municipality: 'Vila Bela da Santíssima Trindade' } },
    { name: 'many-alerts', input, extraAlerts: true },
  ];
  if (outputDir) await mkdir(outputDir, { recursive: true });
  const formatMoney = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value).replace(/\s/g, ' ');

  for (const scenario of scenarios) {
    const result = calculateHousingSimulation(scenario.input, municipality, date);
    if (scenario.extraAlerts) result.alerts.push(...Array.from({ length: 24 }, (_, index) => ({ type: 'warning', message: `Observação ${index + 1}: revise as condições da simulação antes da contratação.` })));
    const doc = createHousingSimulationPdf(result, date, scenario.omitContext ? {} : scenario.input);
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    if (outputDir) await writeFile(path.join(outputDir, `${scenario.name}.pdf`), bytes);
    const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;
    try {
      if (scenario.extraAlerts) assert.ok(pdf.numPages > 1, 'Observações extensas geram páginas adicionais');
      else assert.equal(pdf.numPages, 1, `${scenario.name}: conteúdo cabe em uma página`);
      const pageTexts = [];
      for (let number = 1; number <= pdf.numPages; number += 1) {
        const page = await pdf.getPage(number);
        const operators = await page.getOperatorList();
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ').replace(/\s/g, ' ');
        pageTexts.push(pageText);
        assert.ok(pageText.includes(`${number} / ${pdf.numPages}`), 'Numeração de todas as páginas');
        assert.ok(pageText.includes(`Financiamento Habitacional ${result.bank === 'CAIXA' ? 'CAIXA' : 'Bradesco'}`), 'Rodapé identifica o banco em todas as páginas');
        assert.match(pageText, /Data: 26\/10\/2026.*Hora: 22:30:00/, 'Data e hora de São Paulo');
        for (const item of content.items) {
          if (!item.str.trim()) continue;
          assert.match(page.commonObjs.get(item.fontName).name, /CAIXAStd/, 'Texto usa a família CAIXA Std incorporada');
          assert.ok(item.transform[4] >= 41 && item.transform[4] + item.width <= 555, `${scenario.name}: texto dentro das margens: ${item.str}`);
          assert.ok(item.transform[5] >= 18 && item.transform[5] <= 800, `${scenario.name}: texto dentro da página: ${item.str}`);
        }
        const imageCount = operators.fnArray.filter(fn => fn === OPS.paintImageXObject).length;
        assert.equal(imageCount, result.bank === 'CAIXA' ? 1 : 0, 'Logo Caixa somente para o banco Caixa');
      }
      const allText = pageTexts.join(' ');
      assert.doesNotMatch(allText, /MOTIVE|Consultoria Imobiliária|NaN|Infinity|undefined|CET|CESH|CPF|Telefone/);
      for (const value of [result.financed, result.requiredEntry, result.installment.total, result.installment.mip, result.installment.dfi, result.installment.adminFee]) {
        assert.ok(allText.includes(formatMoney(value)), `${scenario.name}: mantém o valor calculado ${value}`);
      }
      assert.match(allText, /Composição da parcela.*Amortização \+ juros.*Seguro MIP.*Seguro DFI.*Taxa de administração.*Valor parcela/);
      assert.match(allText, /Simulação de Financiamento Habitacional/);
      assert.doesNotMatch(allText, /Simulação estimada\.|Documento não emitido|Simulador de Crédito Imobiliário/);
      if (scenario.omitContext) assert.doesNotMatch(allText, /Nascimento|Localização|subsídio|depósito de FGTS/);
      else {
        assert.match(allText, /Nascimento.*20\/05\/1990.*Renda familiar bruta mensal.*R\$ 9\.000,00/);
        assert.ok(allText.includes(`${scenario.input.municipality}, SP`));
      }
      if (result.bank === 'BRADESCO') assert.doesNotMatch(allText, /CAIXA|Minha Casa|depósito de FGTS|subsídio/);
      if (scenario.extraAlerts) assert.match(allText, /Observação 24:/, 'Nenhuma observação é perdida na paginação');
      console.log(`PDF validado: ${scenario.name} (${pdf.numPages} página(s)).`);
    } finally { await pdf.destroy(); }
  }
} finally { await unlink(bundlePath); }
