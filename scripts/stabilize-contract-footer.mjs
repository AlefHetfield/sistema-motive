// Replace only the first-page contact footer; keep the contract body and other footers.
import fs from 'node:fs';
import PizZip from 'pizzip';

const filename = 'assets/templates/contrato-motive-v1.docx';
const input = fs.readFileSync(filename);
const zip = new PizZip(input);
const footerName = 'word/footer2.xml';
const previous = zip.file(footerName).asText();
if (!previous.includes('Rua Justino')) throw new Error('Unexpected contract footer: not overwriting.');

const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paragraph = (text, bold = false) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="200" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Liberation Sans" w:hAnsi="Liberation Sans" w:cs="Liberation Sans"/>${bold ? '<w:b/><w:bCs/>' : ''}<w:color w:val="000000"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
const cell = (width, lines, { left = 180, blue = false, bold = false, divider = false } = {}) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcBorders>${divider ? '<w:left w:val="single" w:sz="4" w:color="D8DEE5"/>' : ''}</w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${blue ? '5A80A1' : 'F7F8FA'}"/><w:tcMar><w:top w:w="120" w:type="dxa"/><w:left w:w="${left}" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>${lines.map(line => paragraph(line, bold)).join('')}</w:tc>`;
const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:tbl><w:tblPr><w:tblW w:w="11906" w:type="dxa"/><w:jc w:val="left"/><w:tblInd w:w="-1701" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>
<w:tblGrid><w:gridCol w:w="4200"/><w:gridCol w:w="3500"/><w:gridCol w:w="3786"/><w:gridCol w:w="420"/></w:tblGrid>
<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="600" w:hRule="atLeast"/></w:trPr>
${cell(4200, ['Rua Justino França, 454', 'Jardim São Carlos (Centro)', 'CEP 13170-050 — Sumaré/SP'], { left: 1701 })}
${cell(3500, ['(19) 98293-8955', 'motiveimoveis@gmail.com', 'motiveimoveis.com'], { divider: true })}
${cell(3786, ['MOTIVE CONSULTORIA', 'IMOBILIÁRIA', 'CRECI: 43789J'], { divider: true, bold: true })}
${cell(420, [''], { left: 0, blue: true })}
</w:tr></w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p></w:ftr>`;

const body = zip.file('word/document.xml').asText();
// Keep the original footer distance so later pages retain their pagination.
const firstSection = body.match(/<w:sectPr>[^]*?<\/w:sectPr>/)?.[0];
if (!firstSection?.includes('w:type="first"')) throw new Error('First-page section not found.');
const section = firstSection.replace(/w:footer="\d+"/, 'w:footer="366"');
zip.file('word/document.xml', body.replace(firstSection, section));
zip.file(footerName, footer);
const folder = `.local/contract-footer-backup-${Date.now()}`;
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(`${folder}/contrato-motive-v1.docx`, input);
fs.writeFileSync(filename, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`First-page footer stabilized. Original retained in ${folder}.`);
