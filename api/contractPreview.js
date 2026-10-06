import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateContractPreview } from './contractGenerator.js';

const execute = promisify(execFile);
let busy = false;

export class PreviewError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function converterPath() {
  if (process.env.LIBREOFFICE_PATH) return process.env.LIBREOFFICE_PATH;
  if (process.platform !== 'win32') return 'soffice';
  const local = fileURLToPath(new URL('../.local/tools/libreoffice/program/soffice.exe', import.meta.url));
  for (const candidate of [local, 'C:\\Program Files\\LibreOffice\\program\\soffice.exe']) {
    try { await access(candidate); return candidate; } catch { /* Try the next installation. */ }
  }
  throw new PreviewError('A prévia em PDF precisa do LibreOffice instalado no servidor. O download em Word continua disponível.', 503);
}

export async function generateContractPreviewPdf(data, { signal } = {}) {
  // Avoid simultaneous office processes exhausting the API's memory.
  if (busy) throw new PreviewError('A prévia está sendo atualizada. Tente novamente em instantes.', 429);
  busy = true;
  let directory;
  try {
    signal?.throwIfAborted();
    const converter = await converterPath();
    const docx = generateContractPreview(data);
    directory = await mkdtemp(path.join(os.tmpdir(), 'motive-contract-'));
    const input = path.join(directory, 'preview.docx');
    await writeFile(input, docx);
    await execute(converter, [
      `-env:UserInstallation=${pathToFileURL(path.join(directory, 'profile')).href}`,
      '--headless', '--nologo', '--nodefault', '--nofirststartwizard',
      '--convert-to', 'pdf:writer_pdf_Export', '--outdir', directory, input,
    ], { timeout: 45000, maxBuffer: 1024 * 1024, windowsHide: true });
    // Let conversion finish even after disconnect; the process stays bounded and
    // cleanup cannot race an office process still writing confidential files.
    signal?.throwIfAborted();
    const pdf = await readFile(path.join(directory, 'preview.pdf'));
    if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF');
    return pdf;
  } catch (error) {
    if (error instanceof PreviewError || signal?.aborted) throw error;
    throw new PreviewError(error.code === 'ENOENT'
      ? 'O conversor PDF não está disponível no servidor. O download em Word continua disponível.'
      : 'Não foi possível preparar a prévia em PDF. Tente novamente; o download em Word continua disponível.', 503);
  } finally {
    // directory is exclusively the freshly-created, private task directory.
    if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
    busy = false;
  }
}
