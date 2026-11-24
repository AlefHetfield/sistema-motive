export const PROSPECT_PHOTO_LIMIT = 96 * 1024;

export async function compressProspectPhoto(file) {
  if (!file || file.size > 25 * 1024 * 1024) throw new Error('Escolha uma foto de até 25 MB. Ela será reduzida antes de salvar.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Imagem vazia.');
    const canvas = document.createElement('canvas');
    for (const size of [960, 800, 640, 480]) {
      const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível preparar a foto.');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.66, 0.52]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= PROSPECT_PHOTO_LIMIT) {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
          });
          return { dataUrl, bytes: blob.size, width: canvas.width, height: canvas.height };
        }
      }
    }
    throw new Error('Não foi possível reduzir esta foto. Escolha outra imagem.');
  } catch (error) {
    if (error.message?.includes('reduzir')) throw error;
    throw new Error('Não consegui ler esta foto. Tente uma imagem JPG, PNG ou WebP.');
  } finally { URL.revokeObjectURL(url); }
}
