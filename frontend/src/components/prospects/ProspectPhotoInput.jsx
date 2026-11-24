import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import { compressProspectPhoto } from '../../utils/prospectPhoto';
import { prospectPhotoUrl } from '../../services/prospectApi';

export default function ProspectPhotoInput({ item, disabled, onChange, onProcessing }) {
  const [preview, setPreview] = useState(item?.hasPhoto ? prospectPhotoUrl(item) : '');
  const [error, setError] = useState('');
  const [bytes, setBytes] = useState(null);
  const [processing, setProcessing] = useState(false);
  const picker = useRef(null), camera = useRef(null), sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  const select = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const request = ++sequence.current;
    setError(''); setProcessing(true); onProcessing(true);
    try {
      const photo = await compressProspectPhoto(file);
      if (request !== sequence.current) return;
      setPreview(photo.dataUrl); setBytes(photo.bytes); onChange(photo.dataUrl);
    } catch (reason) { if (request === sequence.current) setError(reason.message); }
    finally { if (request === sequence.current) { setProcessing(false); onProcessing(false); } }
  };
  return <section aria-label="Foto do imóvel" className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
    <div className="flex items-start gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-400">
        {preview ? <img src={preview} alt="Prévia da fachada do imóvel" className="h-full w-full object-cover" /> : <Camera size={30} aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-slate-800">Foto da fachada <span className="font-normal text-slate-500">· opcional</span></h3><p className="mt-1 text-xs leading-5 text-slate-500">Uma foto para reconhecer o imóvel. Guardamos apenas uma versão pequena e legível.</p>
        {bytes !== null && <p className="mt-1 text-xs font-semibold text-primary">Foto reduzida · {Math.ceil(bytes / 1024)} KB</p>}
        <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={disabled || processing} onClick={() => picker.current.click()}><ImagePlus size={15} />{preview ? 'Trocar foto' : 'Escolher foto'}</Button><Button size="sm" variant="primarySoft" className="sm:hidden" disabled={disabled || processing} onClick={() => camera.current.click()}><Camera size={15} />Tirar foto</Button></div>
      </div>
    </div>
    <input ref={picker} type="file" accept="image/*" hidden onChange={select} aria-label="Arquivo de foto do imóvel" />
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={select} aria-label="Fotografar imóvel" />
    {processing && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-primary"><Loader2 size={14} className="animate-spin" />Preparando uma foto leve…</p>}
    {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    {preview && <button type="button" disabled={disabled || processing} onClick={() => { sequence.current++; setPreview(''); setBytes(null); setError(''); onChange(null); }} className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"><Trash2 size={14} />Remover foto</button>}
  </section>;
}
