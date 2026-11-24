import sharp from 'sharp';

export const MAX_PROSPECT_PHOTO_BYTES = 96 * 1024;
const badPhoto = () => Object.assign(new Error('Não foi possível ler a foto. Escolha uma imagem JPG, PNG ou WebP válida.'), { status: 400 });

export async function prepareProspectPhoto(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 350000) throw badPhoto();
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) throw badPhoto();
  const input = Buffer.from(match[2], 'base64');
  if (input.length > 256 * 1024 || input.toString('base64') !== match[2]) throw badPhoto();
  const magic = match[1] === 'jpeg' ? input[0] === 255 && input[1] === 216 && input[2] === 255
    : match[1] === 'png' ? input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP';
  if (!magic) throw badPhoto();
  try {
    const options = { limitInputPixels: 4 * 1024 * 1024, failOn: 'error' };
    const metadata = await sharp(input, options).metadata();
    if (metadata.format !== match[1] || (metadata.pages || 1) > 1) throw badPhoto();
    for (const width of [960, 800, 640, 480]) {
      const output = await sharp(input, options).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 74, effort: 4 }).toBuffer();
      if (output.length <= MAX_PROSPECT_PHOTO_BYTES) return output;
    }
    throw badPhoto();
  } catch { throw badPhoto(); }
}
