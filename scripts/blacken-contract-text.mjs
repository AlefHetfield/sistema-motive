// Changes text colors only; preserves fills, borders, pictures and white titles.
import fs from 'node:fs';
import PizZip from 'pizzip';
const filename = 'assets/templates/contrato-motive-v1.docx';
const input = fs.readFileSync(filename);
const zip = new PizZip(input);
let count = 0;
for (const name of Object.keys(zip.files).filter(n => /^word\/.*\.xml$/.test(n))) {
  const original = zip.file(name).asText();
  const result = original.replace(/<w:color\b[^>]*\/>/g, tag => {
    const blue = /w:val="(?:002060|02A5B4|0563C1)"/i.test(tag) || /w:themeColor="(?:hyperlink|followedHyperlink)"/.test(tag);
    if (!blue) return tag;
    count++;
    return '<w:color w:val="000000"/>';
  });
  if (result !== original) zip.file(name,result);
}
if (count) {
  const folder = `.local/contract-text-color-backup-${Date.now()}`;
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(`${folder}/contrato-motive-v1.docx`,input);
  fs.writeFileSync(filename,zip.generate({type:'nodebuffer',compression:'DEFLATE'}));
}
console.log(`Changed ${count} blue text color declarations to black.`);
