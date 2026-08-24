import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, ImageIcon, Loader2, MapPin, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchNextPropertyReference, fetchPropertyDrivePreview, fetchPropertySitePreview, geocodePropertyPlace, propertyDriveImageUrl, reverseGeocodePropertyCoordinates } from '../../services/api';
import { PROPERTY_STATUSES } from './propertyConstants';
import PropertyAddressSearch from './PropertyAddressSearch';

const PROPERTY_TYPES = ['Casa', 'Apartamento', 'Lote', 'Terreno', 'Sobrado', 'Chácara', 'Comercial', 'Outro'];
const CONDITIONS = ['Novo', 'Usado', 'Em construção', 'Reformado', 'Para reforma'];
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const LISTING_FIELD_LABELS = {
  price: 'valor', area: 'área construída', landArea: 'terreno', bedrooms: 'dormitórios', suites: 'suítes', bathrooms: 'banheiros', parkingSpaces: 'vagas',
  neighborhood: 'bairro', city: 'cidade', propertyType: 'tipo', description: 'descrição',
};
const hasListingValue = value => value !== null && value !== undefined && value !== '' && value !== 0;
const titleWithoutPrice = value => String(value || '')
  .replace(/\s*,?\s*R\$\s*[\d.\s]+(?:,\d{2})?\s*$/i, '')
  .trim();
const condominiumTitle = value => {
  const name = String(value || '').trim();
  return /\b(?:condom[ií]nio|edif[ií]cio|residence|residencial)\b/i.test(name) ? name : '';
};
const isMotiveListingUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['motiveimoveis.com', 'www.motiveimoveis.com'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const blankProperty = {
  code: '', title: '', description: '', address: '', city: 'Sumaré', neighborhood: '', propertyType: 'Casa', condition: 'Usado', status: 'Disponível',
  price: 0, area: '', landArea: '', bedrooms: '', suites: '', bathrooms: '', parkingSpaces: '', photoUrl: '', sourceUrl: '', driveFolderUrl: '', driveCoverFileId: '', captador: '', latitude: '', longitude: '',
  lastAvailabilityCheck: new Date().toISOString().slice(0, 10),
};

const initialForm = (property, initialLocation) => {
  const form = {
    ...blankProperty,
    ...(property || {}),
    ...(initialLocation || {}),
    lastAvailabilityCheck: property?.lastAvailabilityCheck ? String(property.lastAvailabilityCheck).slice(0, 10) : blankProperty.lastAvailabilityCheck,
  };
  form.title = titleWithoutPrice(form.title);
  return form;
};

const Field = ({ label, className = '', inputClassName = '', ...props }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-bold text-gray-600">{label}</span>
    <input {...props} className={`w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10 ${inputClassName}`} />
  </label>
);

const Select = ({ label, children, ...props }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-bold text-gray-600">{label}</span>
    <select {...props} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">{children}</select>
  </label>
);

export default function PropertyFormModal({ property, initialLocation, properties = [], onClose, onSave, isSaving }) {
  const [form, setForm] = useState(() => initialForm(property, initialLocation));
  const [isLocating, setIsLocating] = useState(Boolean(initialLocation));
  const [isGeneratingCode, setIsGeneratingCode] = useState(!property);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [drivePreview, setDrivePreview] = useState(() => property?.driveCoverFileId ? [{ id: property.driveCoverFileId, name: 'Foto principal' }] : []);
  const [drivePreviewError, setDrivePreviewError] = useState('');
  const [photoPreviewError, setPhotoPreviewError] = useState('');
  const [importedFields, setImportedFields] = useState([]);
  const touchedFields = useRef(new Set());
  const isTitleAutomatic = useRef(!property?.id);
  const lastImportedSource = useRef(property?.sourceUrl || '');
  const update = (field, value) => {
    touchedFields.current.add(field);
    setForm(current => ({ ...current, [field]: value }));
  };

  const applyListingResult = useCallback((result, { includeDetails = !property?.id } = {}) => {
    const availableFields = Object.entries(result.property || {})
      .filter(([field, value]) => LISTING_FIELD_LABELS[field] && hasListingValue(value))
      .map(([field]) => field);
    setImportedFields(availableFields);
    setForm(current => {
      const next = { ...current };
      if (result.imageUrl) next.photoUrl = result.imageUrl;
      if (includeDetails) {
        for (const field of availableFields) {
          if (!touchedFields.current.has(field)) next[field] = result.property[field];
        }
      }
      return next;
    });
  }, [property?.id]);

  useEffect(() => {
    if (!isTitleAutomatic.current) return;
    const location = String(form.neighborhood || form.city || 'Imóvel').trim();
    const title = location;
    setForm(current => current.title === title ? current : { ...current, title });
  }, [form.city, form.neighborhood]);

  useEffect(() => {
    if (property?.id) return undefined;
    let active = true;
    setIsGeneratingCode(true);
    fetchNextPropertyReference(form.propertyType)
      .then(result => active && setForm(current => ({ ...current, code: result.code })))
      .catch(error => active && toast.error(error.message))
      .finally(() => active && setIsGeneratingCode(false));
    return () => { active = false; };
  }, [form.propertyType, property?.id]);

  useEffect(() => {
    if (!initialLocation) return undefined;
    if (initialLocation.address) {
      setIsLocating(false);
      return undefined;
    }
    let active = true;
    reverseGeocodePropertyCoordinates(initialLocation.latitude, initialLocation.longitude)
      .then(result => {
        if (!active) return;
        setForm(current => ({
          ...current,
          address: result.address || current.address,
          neighborhood: result.neighborhood || current.neighborhood,
          city: result.city || current.city,
        }));
        toast.success('Endereço identificado a partir do ponto selecionado.');
      })
      .catch(error => active && toast.info(`${error.message} Você pode preencher o endereço manualmente.`))
      .finally(() => active && setIsLocating(false));
    return () => { active = false; };
  }, [initialLocation]);

  useEffect(() => {
    if (!isMotiveListingUrl(form.sourceUrl) || lastImportedSource.current === form.sourceUrl) return undefined;
    let active = true;
    const timeout = setTimeout(() => {
      setIsLoadingPhoto(true);
      setPhotoPreviewError('');
      fetchPropertySitePreview(form.sourceUrl)
        .then(result => {
          if (!active) return;
          lastImportedSource.current = form.sourceUrl;
          applyListingResult(result);
          toast.success(property?.id ? 'Foto atualizada a partir do anúncio.' : 'Foto e dados do anúncio preenchidos.');
        })
        .catch(error => active && setPhotoPreviewError(error.message))
        .finally(() => active && setIsLoadingPhoto(false));
    }, 600);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [applyListingResult, form.sourceUrl, property?.id]);

  const refreshListingPhoto = async () => {
    if (!isMotiveListingUrl(form.sourceUrl)) return toast.error('Informe um link de imóvel do site motiveimoveis.com.');
    setIsLoadingPhoto(true);
    setPhotoPreviewError('');
    try {
      const result = await fetchPropertySitePreview(form.sourceUrl);
      lastImportedSource.current = form.sourceUrl;
      applyListingResult(result, { includeDetails: true });
      toast.success('Foto e dados do anúncio atualizados.');
    } catch (error) {
      setPhotoPreviewError(error.message);
      toast.error(error.message);
    } finally {
      setIsLoadingPhoto(false);
    }
  };

  const refreshDrivePhotos = async () => {
    if (!form.driveFolderUrl?.trim()) return toast.error('Informe o link da pasta de fotos do Google Drive.');
    setIsLoadingDrive(true);
    setDrivePreviewError('');
    try {
      const result = await fetchPropertyDrivePreview(form.driveFolderUrl);
      const files = Array.isArray(result.files) ? result.files : [];
      setDrivePreview(files);
      setForm(current => ({
        ...current,
        driveFolderUrl: result.driveFolderUrl || current.driveFolderUrl,
        driveCoverFileId: files[0]?.id || '',
      }));
      toast.success(files.length ? `${files.length} foto(s) encontrada(s) no Drive.` : 'A pasta não possui imagens.');
    } catch (error) {
      setDrivePreview([]);
      setDrivePreviewError(error.message);
      toast.error(error.message);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const selectSuggestedAddress = async suggestion => {
    setIsLocating(true);
    const hasSelectedLocation = Number.isFinite(suggestion.latitude) && Number.isFinite(suggestion.longitude);

    try {
      const result = hasSelectedLocation ? suggestion : await geocodePropertyPlace(suggestion.placeId);
      for (const field of ['address', 'neighborhood', 'city', 'latitude', 'longitude']) touchedFields.current.add(field);
      const selectedCondominium = condominiumTitle(suggestion.displayName);
      if (selectedCondominium && !touchedFields.current.has('title')) isTitleAutomatic.current = false;
      setForm(current => ({
        ...current,
        address: suggestion.description || result.address || result.formattedAddress,
        neighborhood: result.neighborhood || current.neighborhood,
        city: result.city || current.city,
        latitude: result.latitude,
        longitude: result.longitude,
        title: selectedCondominium && !touchedFields.current.has('title') ? selectedCondominium : current.title,
      }));
      toast.success('Endereço e localização preenchidos.');
    } catch {
      touchedFields.current.add('address');
      setForm(current => ({ ...current, address: suggestion.description || current.address }));
      toast.warning('Endereço selecionado. Não foi possível preencher bairro, cidade e localização automaticamente.');
    } finally {
      setIsLocating(false);
    }
  };

  const submit = event => {
    event.preventDefault();
    if (!form.title.trim() || !form.address.trim()) return toast.error('Título e endereço são obrigatórios.');
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-gray-950/40 p-3 backdrop-blur-[2px] sm:p-6">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar cadastro" />
      <form onSubmit={submit} className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Mapa de imóveis</p><h2 className="mt-1 text-xl font-bold text-gray-900">{property ? 'Editar imóvel' : 'Cadastrar imóvel'}</h2></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Identificação e localização</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Código / referência" value={isGeneratingCode ? 'Gerando...' : form.code || ''} readOnly inputClassName="bg-gray-50 text-gray-500" placeholder="Gerado automaticamente" />
              <Field label="Título do imóvel" value={form.title || ''} onChange={event => { isTitleAutomatic.current = false; update('title', event.target.value); }} className="sm:col-span-1 lg:col-span-3" placeholder="Bairro ou nome do condomínio" />
              <div className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-gray-600">Buscar endereço</span><PropertyAddressSearch value={form.address || ''} onChange={value => update('address', value)} properties={properties} onSelectProperty={existing => toast.warning(`Este endereço pode já estar cadastrado: ${existing.title}`)} onSelectAddress={selectSuggestedAddress} placeholder="Digite a rua, número, bairro ou condomínio" /></div>
              <Field label="Bairro" value={form.neighborhood || ''} onChange={event => update('neighborhood', event.target.value)} />
              <Field label="Cidade" value={form.city || ''} onChange={event => update('city', event.target.value)} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-gray-400">{isLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <MapPin className="h-3.5 w-3.5 text-emerald-500" />}{isLocating ? 'Preenchendo a localização automaticamente...' : 'A localização do pin será definida automaticamente pelo endereço.'}</p>
          </section>

          <section className="border-t border-gray-100 pt-5">
            <h3 className="mb-3 text-sm font-bold text-gray-900">Características</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Tipo" value={form.propertyType || ''} onChange={event => update('propertyType', event.target.value)}>{PROPERTY_TYPES.map(item => <option key={item}>{item}</option>)}</Select>
              <Select label="Condição" value={form.condition || ''} onChange={event => update('condition', event.target.value)}>{CONDITIONS.map(item => <option key={item}>{item}</option>)}</Select>
              <Select label="Status" value={form.status || 'Disponível'} onChange={event => update('status', event.target.value)}>{PROPERTY_STATUSES.map(item => <option key={item}>{item}</option>)}</Select>
              <Field label="Valor" inputMode="numeric" value={currency.format(Number(form.price) || 0)} onChange={event => update('price', Number(event.target.value.replace(/\D/g, '')) / 100)} />
              <Field label="Área construída (m²)" type="number" min="0" step="0.01" value={form.area ?? ''} onChange={event => update('area', event.target.value)} />
              <Field label="Terreno (m²)" type="number" min="0" step="0.01" value={form.landArea ?? ''} onChange={event => update('landArea', event.target.value)} />
              <Field label="Dormitórios" type="number" min="0" value={form.bedrooms ?? ''} onChange={event => update('bedrooms', event.target.value)} />
              <Field label="Suítes" type="number" min="0" value={form.suites ?? ''} onChange={event => update('suites', event.target.value)} />
              <Field label="Banheiros" type="number" min="0" value={form.bathrooms ?? ''} onChange={event => update('bathrooms', event.target.value)} />
              <Field label="Vagas" type="number" min="0" value={form.parkingSpaces ?? ''} onChange={event => update('parkingSpaces', event.target.value)} />
              <Field label="Captador" value={form.captador || ''} onChange={event => update('captador', event.target.value)} />
              <Field label="Disponibilidade confirmada em" type="date" value={form.lastAvailabilityCheck || ''} onChange={event => update('lastAvailabilityCheck', event.target.value)} />
            </div>
          </section>

          <section className="border-t border-gray-100 pt-5">
            <h3 className="mb-3 text-sm font-bold text-gray-900">Apresentação</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex items-end gap-2">
                  <Field className="min-w-0 flex-1" label="Link do imóvel no site" type="url" value={form.sourceUrl || ''} onChange={event => update('sourceUrl', event.target.value)} placeholder="https://www.motiveimoveis.com/imovel/..." />
                  <button type="button" onClick={refreshListingPhoto} disabled={isLoadingPhoto || !form.sourceUrl} className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-bold text-gray-600 hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
                    {isLoadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="hidden sm:inline">Atualizar dados</span>
                  </button>
                </div>
                <p className={`mt-1.5 text-xs ${photoPreviewError ? 'text-amber-600' : 'text-gray-400'}`}>{photoPreviewError || 'Ao colar um anúncio da Motive, a foto e os dados disponíveis serão preenchidos automaticamente.'}</p>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-end gap-2">
                  <Field className="min-w-0 flex-1" label="Pasta de fotos no Google Drive" type="url" value={form.driveFolderUrl || ''} onChange={event => { update('driveFolderUrl', event.target.value); setDrivePreviewError(''); }} placeholder="https://drive.google.com/drive/folders/..." />
                  <button type="button" onClick={refreshDrivePhotos} disabled={isLoadingDrive || !form.driveFolderUrl} className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-bold text-gray-600 hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
                    {isLoadingDrive ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                    <span className="hidden sm:inline">Carregar fotos</span>
                  </button>
                </div>
                <p className={`mt-1.5 text-xs ${drivePreviewError ? 'text-amber-600' : 'text-gray-400'}`}>{drivePreviewError || (drivePreview.length ? `${drivePreview.length} foto(s) vinculada(s). A primeira será usada como capa.` : 'Cole o link da pasta para usar a primeira imagem como capa e as demais na galeria.')}</p>
                {drivePreview.length > 0 && <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{drivePreview.slice(0, 8).map((file, index) => <img key={file.id} src={propertyDriveImageUrl(file.id)} alt={file.name || `Foto ${index + 1}`} className={`h-16 w-24 shrink-0 rounded-lg object-cover ring-2 ${index === 0 ? 'ring-primary' : 'ring-transparent'}`} />)}</div>}
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 sm:col-span-2">
                {form.photoUrl && !photoPreviewError ? (
                  <div className="flex items-center gap-4 p-3">
                    <img src={form.photoUrl} alt="Prévia da foto principal" className="h-24 w-36 shrink-0 rounded-lg object-cover" onError={() => setPhotoPreviewError('Não foi possível exibir a foto encontrada no anúncio.')} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800">Foto e informações encontradas</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">A imagem será usada como capa do imóvel.</p>
                      {importedFields.length > 0 && <p className="mt-1 text-xs leading-5 text-emerald-700">Dados encontrados: {importedFields.map(field => LISTING_FIELD_LABELS[field]).join(', ')}.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-28 items-center justify-center gap-2 px-4 text-center text-xs text-gray-400"><ImageIcon className="h-5 w-5" />A prévia da foto principal aparecerá aqui.</div>
                )}
              </div>
              <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-gray-600">Descrição</span><textarea rows={6} value={form.description || ''} onChange={event => update('description', event.target.value)} placeholder="Condições, diferenciais e observações do imóvel..." className="w-full resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
            </div>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200">Cancelar</button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}{isSaving ? 'Salvando...' : 'Salvar imóvel'}</button>
        </footer>
      </form>
    </div>
  );
}
