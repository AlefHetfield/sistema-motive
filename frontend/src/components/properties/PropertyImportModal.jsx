import { useState } from 'react';
import { FileUp, Loader2, MapPinned, Upload, X } from 'lucide-react';

export default function PropertyImportModal({ onClose, onImport, isImporting }) {
  const [file, setFile] = useState(null);

  const submit = async event => {
    event.preventDefault();
    if (!file) return;
    const content = await file.text();
    const format = file.name.toLowerCase().endsWith('.kml') ? 'kml' : 'csv';
    onImport(content, format);
  };

  return (
    <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar importação" />
      <form onSubmit={submit} className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Migração</p><h2 className="mt-1 text-xl font-bold text-gray-900">Importar do My Maps</h2></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-5">
          <div className="mb-4 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800"><MapPinned className="mt-0.5 h-5 w-5 shrink-0" /><p>No My Maps, abra o menu do mapa e escolha <strong>Exportar para KML/KMZ</strong>. Para preservar os pins, prefira o formato KML. Também aceitamos CSV de uma camada.</p></div>
          <label className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${file ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-primary/40 hover:bg-primary/5'}`}>
            {file ? <FileUp className="h-9 w-9 text-emerald-600" /> : <Upload className="h-9 w-9 text-gray-400" />}
            <span className="mt-3 text-sm font-bold text-gray-800">{file ? file.name : 'Selecionar arquivo KML ou CSV'}</span>
            <span className="mt-1 text-xs text-gray-500">Limite de 2.000 imóveis por importação</span>
            <input type="file" accept=".kml,.csv,text/csv,application/vnd.google-earth.kml+xml" onChange={event => setFile(event.target.files?.[0] || null)} className="hidden" />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200">Cancelar</button>
          <button type="submit" disabled={!file || isImporting} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{isImporting ? 'Importando...' : 'Importar imóveis'}</button>
        </footer>
      </form>
    </div>
  );
}
