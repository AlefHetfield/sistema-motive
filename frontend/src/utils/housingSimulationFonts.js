import regular from '../assets/fonts/CAIXAStd-Regular.ttf?inline';
import semibold from '../assets/fonts/CAIXAStd-SemiBold.ttf?inline';
import bold from '../assets/fonts/CAIXAStd-Bold.ttf?inline';

export const HOUSING_PDF_FONT = 'CAIXAStd';

export function registerHousingSimulationFonts(doc) {
  for (const [style, data] of [['normal', regular], ['semibold', semibold], ['bold', bold]]) {
    const filename = `CAIXAStd-${style}.ttf`;
    doc.addFileToVFS(filename, data.slice(data.indexOf(',') + 1));
    doc.addFont(filename, HOUSING_PDF_FONT, style);
  }
}
