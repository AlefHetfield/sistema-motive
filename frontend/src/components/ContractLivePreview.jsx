import { useEffect, useRef, useState } from 'react';
import { Expand, Loader2, Minus, Plus, RefreshCw, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { previewContract } from '../services/api';
import { normalizePdfText, previewSectionPatterns } from '../utils/contractForm';

function PdfPages({ blob, zoom, onError, currentStep }) {
  const hostRef = useRef(null);
  const drawingRef = useRef(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(0);
  const [pdf, setPdf] = useState(null);
  const followedStepRef = useRef(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!blob) return undefined;
    let active = true;
    let task;
    setPdf(null);
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
        const document = await task.promise;
        if (active) setPdf(document);
      } catch { if (active) onError('Não foi possível exibir as páginas da prévia.'); }
    })();
    return () => { active = false; task?.destroy(); };
  }, [blob, onError]);
  useEffect(() => {
    if (!pdf || followedStepRef.current === currentStep) return undefined;
    let active = true;
    (async () => {
      // Find headings in the actual PDF, rather than assuming fixed page numbers.
      const pattern = previewSectionPatterns[currentStep];
      let target = 1;
      if (pattern) {
        for (let number = 1; number <= pdf.numPages; number += 1) {
          const page = await pdf.getPage(number);
          const content = await page.getTextContent();
          if (!active) return;
          const text = normalizePdfText(content.items);
          if (pattern.test(text)) { target = number; break; }
        }
      }
      if (active) {
        followedStepRef.current = currentStep;
        setPageNumber(target);
        hostRef.current?.parentElement?.scrollTo({ top: 0 });
      }
    })().catch(() => { /* Manual page navigation remains available. */ });
    return () => { active = false; };
  }, [pdf, currentStep]);
  useEffect(() => {
    if (!pdf || width < 50) return undefined;
    let active = true;
    const renders = [];
    const staging = document.createElement('div');
    staging.className = 'flex flex-col items-center gap-4 min-w-fit';
    (async () => {
      try {
        for (const number of [Math.min(pageNumber, pdf.numPages)]) {
          const page = await pdf.getPage(number);
          if (!active) return;
          const natural = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(1.4, (width - 32) / natural.width) * zoom });
          const ratio = Math.min(window.devicePixelRatio || 1, 2);
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width * ratio);
          canvas.height = Math.ceil(viewport.height * ratio);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.className = 'bg-white shadow-md';
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `Página ${number} de ${pdf.numPages} do contrato`);
          const task = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
          renders.push(task);
          await task.promise;
          if (!active) return;
          staging.append(canvas);
        }
        if (active) drawingRef.current.replaceChildren(staging);
      } catch (error) { if (active && error.name !== 'RenderingCancelledException') onError('Não foi possível exibir as páginas da prévia.'); }
    })();
    return () => { active = false; renders.forEach(task => task.cancel()); };
  }, [pdf, width, zoom, onError, pageNumber]);
  const currentPage = pdf ? Math.min(pageNumber, pdf.numPages) : pageNumber;
  return <div ref={hostRef} className="min-h-full p-4" aria-label="Páginas do contrato">
    {pdf && <nav aria-label="Navegar pelas páginas" className="sticky top-0 z-10 mb-3 flex items-center justify-center gap-3 rounded-lg bg-white/95 p-2 text-xs shadow-sm">
      <button type="button" disabled={currentPage <= 1} onClick={() => setPageNumber(currentPage - 1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30">Anterior</button>
      <span>Página {currentPage} de {pdf.numPages}</span>
      <button type="button" disabled={currentPage >= pdf.numPages} onClick={() => setPageNumber(currentPage + 1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30">Próxima</button>
    </nav>}
    <div ref={drawingRef} />
  </div>;
}

export default function ContractLivePreview({ data, currentStep = 0, draftStatus = '' }) {
  const [blob, setBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const flightRef = useRef(Promise.resolve());
  useEffect(() => {
    if (!expanded) return undefined;
    const close = event => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [expanded]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    // Only the latest draft runs once the current conversion finishes.
    const timer = setTimeout(async () => {
      await flightRef.current;
      if (!active) return;
      const pending = (async () => {
        try {
          const result = await previewContract(data);
          if (active) setBlob(result);
        } catch (err) { if (active) setError(err.message || 'Não foi possível atualizar a prévia.'); }
        finally { if (active) setLoading(false); }
      })();
      flightRef.current = pending;
      await pending;
    }, 1400);
    return () => { active = false; clearTimeout(timer); };
  }, [data, revision]);
  const panel = <section aria-label="Prévia visual do contrato" className={expanded ? 'fixed inset-3 z-[9800] flex flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl sm:inset-6' : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'}>
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
      <div><h2 className="text-sm font-bold text-slate-800">Prévia do contrato</h2><p role="status" className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">{loading ? <><Loader2 size={12} className="animate-spin" />Preparando páginas…</> : error ? 'Prévia indisponível ou desatualizada' : `Atualizada · ${draftStatus || 'rascunho em edição'}`}</p></div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Diminuir zoom" disabled={zoom <= 0.75} onClick={() => setZoom(value => Math.max(0.75, value - 0.25))} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30"><Minus size={16} /></button>
        <button type="button" onClick={() => setZoom(1)} className="text-xs text-slate-600" title="Ajustar à largura">{Math.round(zoom * 100)}%</button>
        <button type="button" aria-label="Aumentar zoom" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + 0.25))} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30"><Plus size={16} /></button>
        <button type="button" aria-label={expanded ? 'Fechar ampliação' : 'Ampliar prévia'} onClick={() => setExpanded(value => !value)} className="rounded-lg p-2 hover:bg-slate-100">{expanded ? <X size={16} /> : <Expand size={16} />}</button>
      </div>
    </header>
    <p className="border-b px-3 py-2 text-[11px] leading-4 text-slate-500">Páginas renderizadas do modelo original. Atualiza após uma pausa na digitação; o download continua em Word.</p>
    {error && <div role="alert" className="flex items-center justify-between gap-2 bg-rose-50 p-3 text-xs text-rose-700"><span>{error}</span><button type="button" onClick={() => setRevision(value => value + 1)} className="shrink-0 rounded-lg p-2" aria-label="Tentar atualizar prévia"><RefreshCw size={16} /></button></div>}
    <div className={`overflow-auto bg-slate-200/70 ${expanded ? 'min-h-0 flex-1' : 'h-[65dvh] xl:h-[72dvh]'}`}>
      {!blob && <p className="p-8 text-center text-sm text-slate-500">{loading ? 'Convertendo o contrato para conferência visual…' : 'A prévia aparecerá aqui.'}</p>}
      <PdfPages blob={blob} zoom={zoom} onError={setError} currentStep={currentStep} />
    </div>
  </section>;
  return expanded ? createPortal(panel, document.body) : panel;
}
