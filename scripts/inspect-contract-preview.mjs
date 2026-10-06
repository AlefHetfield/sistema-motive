// Local visual QA only. Uses synthetic data and writes ignored test images.
import { mkdir, writeFile } from 'node:fs/promises';
import { generateContractPreviewPdf } from '../api/contractPreview.js';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '../frontend/node_modules/@napi-rs/canvas/index.js';
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import('../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const person = { nome: 'Pessoa de demonstração', cpf: '52998224725', rg: '123456', estadoCivil: 'Solteiro', endereco: 'Rua de demonstração, 100' };
const data = process.argv.includes('--empty') ? {} : {
  vendedores: [person], compradores: [{ ...person, nome: 'Comprador de demonstração' }],
  imovel: { descricao: 'Apartamento de demonstração, matrícula 12345, situado na Rua de demonstração, 100.' },
  valores: { valorImovel: 380000, sinal: 0, fgts: 0, recursosProprios: 80000, financiamento: 300000, reservaDocumentacao: 0, banco: 'Banco de demonstração', prazoDias: 120 },
  contrato: { cidade: 'Sumaré', data: '2026-10-01' },
};
const bytes = await generateContractPreviewPdf(data);
const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
const folder = new URL('../.local/contract-preview-qa/', import.meta.url);
await mkdir(folder, { recursive: true });
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number);
  const viewport = page.getViewport({ scale: 1.3 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  await writeFile(new URL(`page-${number}.png`, folder), canvas.toBuffer('image/png'));
  if (number === 1) {
    const footer = createCanvas(canvas.width, 100);
    footer.getContext('2d').drawImage(canvas, 0, canvas.height - 100, canvas.width, 100, 0, 0, canvas.width, 100);
    await writeFile(new URL('footer.png', folder), footer.toBuffer('image/png'));
  }
}
console.log(`Rendered ${pdf.numPages} pages into .local/contract-preview-qa`);
await pdf.destroy();
