import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSignature,
  Home,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UserPlus,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import Button from '../components/ui/Button';
import FancySelect from '../components/FancySelect';
import ContractLivePreview from '../components/ContractLivePreview';
import { useAuth } from '../context/AuthContext';
import { useContractDraft } from '../hooks/useContractDraft';
import { fieldKeys, validateContractStep, contractPropertyLabel } from '../utils/contractForm';
import { controlClass, formLabelClass, surfaceClass, textAreaClass } from '../components/ui/styles';
import { EmptyState, LoadingState } from '../components/ui/FeedbackState';
import {
  createClientContract,
  createContractWithNewClient,
  createStandaloneContract,
  downloadContractDocx,
  fetchClients,
  fetchProperties,
  fetchClientSimulations,
  fetchStandaloneContracts,
} from '../services/api';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const today = (() => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
})();

const emptyPerson = () => ({
  nome: '', cpf: '', rg: '', orgaoEmissor: 'SSP', ufRg: 'SP', estadoCivil: '', genero: 'M', endereco: '',
});

const initialData = () => ({
  vendedores: [emptyPerson()],
  compradores: [emptyPerson()],
  imovel: { categoria: '', matricula: '', cartorio: '', endereco: '', descricao: '' },
  valores: { valorImovel: 0, sinal: 0, fgts: 0, recursosProprios: 0, financiamento: 0, reservaDocumentacao: 0, banco: 'Caixa Econômica Federal', prazoDias: 120 },
  contrato: { cidade: 'Sumaré', data: today },
});

const steps = [
  { label: 'Origem', icon: UserRound },
  { label: 'Vendedores', icon: UsersRound },
  { label: 'Compradores', icon: UserRound },
  { label: 'Imóvel', icon: Home },
  { label: 'Valores', icon: WalletCards },
  { label: 'Revisão', icon: CheckCircle2 },
];

const formatCpf = (value) => value.replace(/\D/g, '').slice(0, 11)
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

const ValidationContext = createContext({ errors: {}, prefix: '' });
function useFieldError(label) {
  const { errors, prefix } = useContext(ValidationContext);
  const name = `${prefix}${fieldKeys[label] || label}`;
  return { name, error: errors[name] };
}
const Field = ({ label, className = '', ...props }) => {
  const { name, error } = useFieldError(label);
  return (
  <label className={`block ${className}`}>
    <span className={formLabelClass}>{label}</span>
    <input {...props} name={name} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} className={`${controlClass} ${error ? 'border-rose-400 ring-1 ring-rose-200' : ''}`} />
    {error && <span id={`${name}-error`} className="mt-1 block text-xs text-rose-600">{error}</span>}
  </label>
); };

const SelectField = ({ label, options, className = '', ...props }) => {
  const { error } = useFieldError(label);
  return (
  <label className={`block ${className}`}>
    <span className={formLabelClass}>{label}</span>
    <FancySelect {...props} ariaLabel={label} options={options} />
    {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
  </label>
); };

function MoneyField({ label, value, onChange }) {
  const { name, error } = useFieldError(label);
  return (
    <label className="block">
      <span className={formLabelClass}>{label}</span>
      <input
        name={name}
        aria-invalid={!!error}
        inputMode="numeric"
        value={currency.format(Number(value) || 0)}
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, '')) / 100)}
        className={`${controlClass} font-semibold ${error ? 'border-rose-400' : ''}`}
      />
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

function PersonForm({ title, person, index, canRemove, onChange, onRemove }) {
  const validation = useContext(ValidationContext);
  const prefix = `${title === 'Vendedor' ? 'vendedores' : 'compradores'}.${index}.`;
  return (
    <ValidationContext.Provider value={{ ...validation, prefix }}>
    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary shadow-sm"><UserRound className="h-4 w-4" /></span><h3 className="text-sm font-bold text-gray-800">{title} {index + 1}</h3></div>
        {canRemove && <button type="button" onClick={onRemove} className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600" title="Remover"><Trash2 className="h-4 w-4" /></button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" value={person.nome} onChange={event => onChange('nome', event.target.value)} className="sm:col-span-2" />
        <Field label="CPF" value={person.cpf} onChange={event => onChange('cpf', formatCpf(event.target.value))} placeholder="000.000.000-00" />
        <Field label="RG" value={person.rg} onChange={event => onChange('rg', event.target.value)} />
        <Field label="Órgão emissor" value={person.orgaoEmissor} onChange={event => onChange('orgaoEmissor', event.target.value)} />
        <Field label="UF do RG" maxLength={2} value={person.ufRg} onChange={event => onChange('ufRg', event.target.value.toUpperCase())} />
        <Field label="Estado civil" value={person.estadoCivil} onChange={event => onChange('estadoCivil', event.target.value)} placeholder="Ex.: solteiro(a)" />
        <SelectField label="Gênero gramatical" value={person.genero} onChange={value => onChange('genero', value)} options={[{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }]} />
        <Field label="Endereço completo" value={person.endereco} onChange={event => onChange('endereco', event.target.value)} className="sm:col-span-2" placeholder="Rua, número, bairro, cidade/UF" />
      </div>
    </div>
    </ValidationContext.Provider>
  );
}

export default function ContractGenerator() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobilePanel, setMobilePanel] = useState('form');
  const restored = location.state?.contractData;
  const requestedClientId = Number(location.state?.contractClientId || location.state?.clientId || 0);
  const restoredMode = location.state?.contractMode || (restored && !requestedClientId ? 'standalone' : 'client');
  const [currentStep, setCurrentStep] = useState(restored ? 5 : 0);
  const [furthestStep, setFurthestStep] = useState(restored ? 5 : 0);
  const [contractMode, setContractMode] = useState(restoredMode);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const prefillClientRef = useRef(restored ? 0 : requestedClientId);
  const [data, setData] = useState(restored || initialData());
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [standaloneContracts, setStandaloneContracts] = useState([]);
  const [isLoadingStandalone, setIsLoadingStandalone] = useState(true);
  const [downloadingContractId, setDownloadingContractId] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyError, setPropertyError] = useState('');
  const [propertyId, setPropertyId] = useState(String(restored?.imovel?.propertyId || ''));
  const [errors, setErrors] = useState({});
  const [draftClientId, setDraftClientId] = useState(requestedClientId);
  const draftSnapshot = useMemo(() => ({ data, currentStep, furthestStep, contractMode, clientId: selectedClient?.id || draftClientId, propertyId }), [data, currentStep, furthestStep, contractMode, selectedClient, draftClientId, propertyId]);
  const draftStatus = useContractDraft(user?.id, draftSnapshot, draft => {
    setData(draft.data);
    setCurrentStep(Math.max(0, Math.min(5, Number(draft.currentStep) || 0)));
    setFurthestStep(Math.max(0, Math.min(5, Number(draft.furthestStep || draft.currentStep) || 0)));
    setContractMode(draft.contractMode === 'standalone' ? 'standalone' : 'client');
    setDraftClientId(Number(draft.clientId) || 0);
    setPropertyId(String(draft.propertyId || ''));
  }, !!restored || !!requestedClientId);
  useEffect(() => { setFurthestStep(value => Math.max(value, currentStep)); }, [currentStep]);

  useEffect(() => {
    let active = true;
    fetchProperties().then(items => { if (active) setProperties(Array.isArray(items) ? items : []); })
      .catch(() => { if (active) setPropertyError('Não foi possível carregar o mapa. Você pode preencher manualmente.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (draftClientId && clients.length) setSelectedClient(clients.find(client => client.id === draftClientId) || null);
  }, [draftClientId, clients]);

  useEffect(() => {
    let active = true;
    fetchClients()
      .then(list => {
        if (!active) return;
        const safeList = Array.isArray(list) ? list : [];
        setClients(safeList);
        const match = safeList.find(client => client.id === requestedClientId);
        if (match) setSelectedClient(match);
      })
      .catch(() => active && toast.error('Não foi possível carregar os clientes.'))
      .finally(() => active && setIsLoadingClients(false));
    return () => { active = false; };
  }, [requestedClientId]);

  useEffect(() => {
    let active = true;
    fetchStandaloneContracts()
      .then(list => active && setStandaloneContracts(Array.isArray(list) ? list : []))
      .catch(() => active && setStandaloneContracts([]))
      .finally(() => active && setIsLoadingStandalone(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (contractMode !== 'client' || !selectedClient || prefillClientRef.current !== selectedClient.id) return;
    let active = true;
    fetchClientSimulations(selectedClient.id)
      .catch(() => [])
      .then(simulations => {
        if (!active) return;
        prefillClientRef.current = 0;
        const latest = Array.isArray(simulations) ? simulations[0] : null;
        const propertyValue = Number(latest?.propertyValue || 0);
        const financed = Number(latest?.financed || selectedClient.valorFinanciado || 0);
        setPropertyId('');
        setData(current => ({
          ...current,
          compradores: [{ ...current.compradores[0], nome: selectedClient.nome || '', cpf: formatCpf(selectedClient.cpf || '') }, ...current.compradores.slice(1)],
          imovel: { ...current.imovel, matricula: selectedClient.matricula || '', endereco: selectedClient.imovel || '', propertyId: null },
          valores: {
            ...current.valores,
            valorImovel: propertyValue,
            financiamento: financed,
            recursosProprios: propertyValue ? Math.max(0, propertyValue - financed) : 0,
            banco: latest?.bank === 'BRADESCO' ? 'Banco Bradesco' : 'Caixa Econômica Federal',
          },
          contrato: { ...current.contrato, cidade: selectedClient.cidade || current.contrato.cidade },
        }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [contractMode, selectedClient, restored]);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase('pt-BR');
    const digits = query.replace(/\D/g, '');
    return clients.filter(client => String(client.nome || '').toLocaleLowerCase('pt-BR').includes(query)
      || (digits && String(client.cpf || '').replace(/\D/g, '').includes(digits))).slice(0, 10);
  }, [clients, clientSearch]);

  const composition = data.valores.sinal + data.valores.fgts + data.valores.recursosProprios + data.valores.financiamento;
  const difference = data.valores.valorImovel - composition;

  const updatePerson = (group, index, key, value) => setData(current => ({
    ...current,
    [group]: current[group].map((person, personIndex) => personIndex === index ? { ...person, [key]: value } : person),
  }));
  const addPerson = group => setData(current => current[group].length >= 2 ? current : ({ ...current, [group]: [...current[group], emptyPerson()] }));
  const removePerson = (group, index) => setData(current => ({ ...current, [group]: current[group].filter((_, personIndex) => personIndex !== index) }));
  const updateSection = (section, key, value) => setData(current => ({ ...current, [section]: { ...current[section], [key]: value } }));

  const chooseMode = (mode) => {
    if (mode === contractMode) return;
    setContractMode(mode);
    setSelectedClient(null);
    setData(initialData());
    setDraftClientId(0);
    setPropertyId('');
    setErrors({});
    setFurthestStep(0);
  };

  const downloadContract = async (contract) => {
    setDownloadingContractId(contract.id);
    try {
      const { blob, fileName } = await downloadContractDocx(contract.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      toast.error(error.message || 'Não foi possível baixar o contrato.');
      return false;
    } finally {
      setDownloadingContractId(null);
    }
  };

  const reopenStandaloneContract = (contract) => {
    setContractMode('standalone');
    setSelectedClient(null);
    setData(contract.contractData);
    setCurrentStep(5);
    setFurthestStep(5);
    setDraftClientId(0);
    setPropertyId(String(contract.contractData.imovel?.propertyId || ''));
    setErrors({});
  };

  const checkStep = step => {
    const found = validateContractStep(data, step, contractMode, selectedClient?.id);
    setErrors(found);
    if (Object.keys(found).length) {
      setCurrentStep(step);
      setMobilePanel('form');
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return false;
    }
    return true;
  };
  const nextStep = () => {
    if (checkStep(currentStep)) setCurrentStep(step => Math.min(5, step + 1));
  };
  const chooseProperty = id => {
    setPropertyId(id);
    const property = properties.find(item => String(item.id) === id);
    if (!property) {
      setData(current => ({ ...current, imovel: { ...current.imovel, propertyId: null } }));
      return;
    }
    if (!window.confirm('Importar endereço, valor e proprietário deste imóvel? Se o proprietário mudar, os documentos do primeiro vendedor serão limpos. Ao trocar um imóvel já vinculado, os dados jurídicos serão limpos para nova conferência.')) {
      setPropertyId(propertyId);
      return;
    }
    const type = String(property.propertyType || '').toLowerCase();
    setData(current => ({
      ...current,
      imovel: { ...current.imovel,
        ...(current.imovel.propertyId && current.imovel.propertyId !== Number(id) ? { matricula: '', cartorio: '', descricao: '' } : {}),
        propertyId: Number(id), endereco: property.address || current.imovel.endereco,
        categoria: type.includes('apartamento') ? 'apartamento' : type.includes('terreno') ? 'terreno' : type.includes('casa') ? 'casa' : current.imovel.categoria },
      vendedores: current.vendedores.map((person, i) => i === 0 && property.ownerName
        ? { ...(person.nome.trim().toLocaleLowerCase('pt-BR') === property.ownerName.trim().toLocaleLowerCase('pt-BR') ? person : emptyPerson()), nome: property.ownerName }
        : person),
      valores: { ...current.valores, valorImovel: property.price != null ? Number(property.price) : current.valores.valorImovel },
    }));
    toast.success('Dados do imóvel importados. Confira os dados jurídicos e a composição do pagamento.');
  };

  const handleGenerate = async (registerClient = false) => {
    if ((contractMode === 'client' && !selectedClient) || isGenerating) return;
    for (let step = 0; step <= 5; step += 1) {
      if (!checkStep(step)) return;
    }
    setIsGenerating(true);
    try {
      let contract;
      if (contractMode === 'client') {
        contract = await createClientContract(selectedClient.id, data);
      } else if (registerClient) {
        const result = await createContractWithNewClient(data);
        contract = result.contract;
      } else {
        contract = await createStandaloneContract(data);
      }
      const downloaded = await downloadContract(contract);
      if (contractMode === 'standalone' && !registerClient) setStandaloneContracts(current => [contract, ...current.filter(item => item.id !== contract.id)]);
      if (downloaded) {
        toast.success(registerClient
          ? 'Contrato gerado e comprador cadastrado como cliente.'
          : contractMode === 'client'
            ? 'Contrato gerado e registrado no histórico do cliente.'
            : 'Contrato avulso gerado e salvo no histórico.');
      } else {
        toast.info('O contrato foi salvo. Você pode tentar baixá-lo novamente pelo histórico.');
      }
    } catch (error) {
      toast.error(error.message || 'Não foi possível gerar o contrato.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ValidationContext.Provider value={{ errors, prefix: '' }}>
    <div className="min-h-full bg-background/80 p-4 sm:p-6">
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-xs text-slate-500">{draftStatus} · contém dados pessoais</p>
          <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => {
            if (!window.confirm('Iniciar um novo contrato? O rascunho atual neste navegador será substituído. Contratos já gerados serão mantidos.')) return;
            setData(initialData()); setCurrentStep(0); setFurthestStep(0); setSelectedClient(null); setDraftClientId(0); setPropertyId(''); setErrors({}); prefillClientRef.current = 0;
          }}>Novo contrato</button>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4" />Modelo protegido e versionado</div>
        </div>

        <div className={`mb-5 overflow-x-auto p-2 ${surfaceClass}`}>
          <div className="flex min-w-max items-center">
            {steps.map((step, index) => { const Icon = step.icon; const active = currentStep === index; const done = currentStep > index; return <button key={step.label} type="button" onClick={() => { if (index <= furthestStep) { setCurrentStep(index); setErrors({}); } }} className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${active ? 'bg-primary text-white shadow-sm' : done ? 'text-emerald-700 hover:bg-emerald-50' : 'cursor-default text-gray-400'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${active ? 'bg-white/20' : done ? 'bg-emerald-100' : 'bg-gray-100'}`}>{done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}</span>{index + 1}. {step.label}</button>; })}
          </div>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 xl:hidden">
          {[['form', 'Preencher'], ['preview', 'Prévia']].map(([value, label]) => <button key={value} type="button" aria-pressed={mobilePanel === value} onClick={() => setMobilePanel(value)} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${mobilePanel === value ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>{label}</button>)}
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <main className={`${surfaceClass} min-w-0 ${mobilePanel === 'form' ? 'block' : 'hidden'} xl:block`}>
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6"><h2 className="text-lg font-bold text-gray-900">{currentStep + 1}. {steps[currentStep].label}</h2></div>
            <div className="p-5 sm:p-6">
              {!!Object.keys(errors).length && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errors.client || errors.composition || 'Confira os campos indicados abaixo antes de continuar.'}</div>}
              {currentStep === 0 && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => chooseMode('client')} className={`rounded-2xl border p-4 text-left transition ${contractMode === 'client' ? 'border-primary bg-primary/5 ring-2 ring-primary/10' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                      <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${contractMode === 'client' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}><UserRound className="h-5 w-5" /></span>
                      <span className="block text-sm font-bold text-gray-900">Cliente cadastrado</span>
                      <span className="mt-1 block text-xs leading-5 text-gray-500">Use os dados do CRM e salve o contrato no histórico do cliente.</span>
                    </button>
                    <button type="button" onClick={() => chooseMode('standalone')} className={`rounded-2xl border p-4 text-left transition ${contractMode === 'standalone' ? 'border-primary bg-primary/5 ring-2 ring-primary/10' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                      <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${contractMode === 'standalone' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}><BriefcaseBusiness className="h-5 w-5" /></span>
                      <span className="block text-sm font-bold text-gray-900">Contrato avulso</span>
                      <span className="mt-1 block text-xs leading-5 text-gray-500">Preencha manualmente sem criar um cliente no sistema.</span>
                    </button>
                  </div>

                  {contractMode === 'client' ? (
                    <div className="space-y-4 border-t border-gray-100 pt-5">
                      <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" /><input autoFocus value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Buscar por nome ou CPF" className={`${controlClass} pl-10 pr-4`} /></div>
                      {isLoadingClients ? <LoadingState label="Carregando clientes..." /> : filteredClients.length ? <div className="grid gap-2 sm:grid-cols-2">{filteredClients.map(client => { const selected = selectedClient?.id === client.id; return <button key={client.id} type="button" onClick={() => { prefillClientRef.current = client.id; setDraftClientId(client.id); setSelectedClient(client); }} className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${selected ? 'border-primary bg-primary/5 ring-2 ring-primary/10' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>{selected ? <Check className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-gray-800">{client.nome || 'Cliente sem nome'}</span><span className="mt-0.5 block truncate text-xs text-gray-400">{client.cpf || 'CPF não informado'} · {client.imovel || 'Imóvel não informado'}</span></span></button>; })}</div> : <EmptyState icon={UserRound} title="Nenhum cliente encontrado" description="Tente buscar por outro nome ou CPF." />}
                    </div>
                  ) : (
                    <div className="border-t border-gray-100 pt-5">
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">O comprador será informado nas próximas etapas. Este contrato ficará no seu histórico de contratos avulsos, sem criar cadastro no CRM.</div>
                      <h3 className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">Contratos avulsos recentes</h3>
                      {isLoadingStandalone ? <LoadingState label="Carregando histórico..." className="py-7" /> : standaloneContracts.length ? <div className="space-y-2">{standaloneContracts.slice(0, 5).map(contract => <article key={contract.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-bold text-gray-800">{contract.buyerName}</p><p className="mt-1 text-xs text-gray-500">{currency.format(Number(contract.propertyValue))} · {new Date(contract.createdAt).toLocaleDateString('pt-BR')}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => reopenStandaloneContract(contract)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary ring-1 ring-gray-200 hover:bg-primary hover:text-white">Reabrir</button><button type="button" disabled={downloadingContractId === contract.id} onClick={() => downloadContract(contract)} className="rounded-lg bg-white p-2 text-primary ring-1 ring-gray-200 hover:bg-primary hover:text-white disabled:opacity-50" title="Baixar Word">{downloadingContractId === contract.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button></div></article>)}</div> : <EmptyState icon={FileSignature} title="Nenhum contrato avulso" description="Os contratos gerados aparecerão aqui para reabertura e download." className="py-7" />}
                    </div>
                  )}
                </div>
              )}

              {(currentStep === 1 || currentStep === 2) && (() => { const group = currentStep === 1 ? 'vendedores' : 'compradores'; const title = currentStep === 1 ? 'Vendedor' : 'Comprador'; return <div className="space-y-4">{data[group].map((person, index) => <PersonForm key={index} title={title} person={person} index={index} canRemove={data[group].length > 1} onChange={(key, value) => updatePerson(group, index, key, value)} onRemove={() => removePerson(group, index)} />)}{data[group].length < 2 && <button type="button" onClick={() => addPerson(group)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition hover:border-primary/50 hover:bg-primary/10"><Plus className="h-4 w-4" />Adicionar {title.toLowerCase()}</button>}</div>; })()}

              {currentStep === 3 && <div className="space-y-5"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className={formLabelClass}>Preencher com imóvel do mapa (opcional)</span><FancySelect searchable ariaLabel="Imóvel do mapa" value={propertyId} onChange={chooseProperty} placeholder="Selecionar imóvel ou preencher manualmente" searchPlaceholder="Buscar por código, bairro, condomínio ou proprietário..." options={[{ value: '', label: 'Preencher manualmente' }, ...properties.map(property => ({ value: String(property.id), label: contractPropertyLabel(property), searchText: [property.code, property.title, property.neighborhood, property.ownerName, property.address, property.price].join(' ') }))]} /><p className="mt-2 text-xs text-slate-500">{propertyError || 'Importa dados disponíveis. Matrícula, cartório e descrição jurídica devem ser conferidos e preenchidos abaixo.'}</p></div><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Categoria" value={data.imovel.categoria} onChange={value => updateSection('imovel', 'categoria', value)} placeholder="Selecione" options={[{ value: '', label: 'Selecione' }, { value: 'casa', label: 'Casa' }, { value: 'apartamento', label: 'Apartamento' }, { value: 'terreno', label: 'Terreno' }]} /><Field label="Número da matrícula" value={data.imovel.matricula} onChange={event => updateSection('imovel', 'matricula', event.target.value)} /><Field label="Cartório responsável" value={data.imovel.cartorio} onChange={event => updateSection('imovel', 'cartorio', event.target.value)} /><Field label="Endereço do imóvel" value={data.imovel.endereco} onChange={event => updateSection('imovel', 'endereco', event.target.value)} /></div><label className="block"><span className={formLabelClass}>Descrição jurídica completa <span className="font-normal text-gray-400">(opcional quando os campos acima estiverem completos)</span></span><textarea value={data.imovel.descricao} onChange={event => updateSection('imovel', 'descricao', event.target.value)} rows={6} placeholder="Cole aqui a descrição conforme consta na matrícula..." className={textAreaClass} /></label><p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Confira a descrição diretamente na matrícula antes de gerar o contrato.</p></div>}

              {currentStep === 4 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><MoneyField label="Valor do imóvel" value={data.valores.valorImovel} onChange={value => updateSection('valores', 'valorImovel', value)} /><MoneyField label="Sinal" value={data.valores.sinal} onChange={value => updateSection('valores', 'sinal', value)} /><MoneyField label="FGTS" value={data.valores.fgts} onChange={value => updateSection('valores', 'fgts', value)} /><MoneyField label="Recursos próprios" value={data.valores.recursosProprios} onChange={value => updateSection('valores', 'recursosProprios', value)} /><MoneyField label="Financiamento" value={data.valores.financiamento} onChange={value => updateSection('valores', 'financiamento', value)} /><MoneyField label="Reserva para documentação" value={data.valores.reservaDocumentacao} onChange={value => updateSection('valores', 'reservaDocumentacao', value)} /><Field label="Banco" value={data.valores.banco} onChange={event => updateSection('valores', 'banco', event.target.value)} className="sm:col-span-2" /><Field label="Prazo do financiamento (dias)" type="number" min="1" max="730" value={data.valores.prazoDias} onChange={event => updateSection('valores', 'prazoDias', Number(event.target.value))} /></div><div className={`rounded-xl border p-4 ${Math.abs(difference) <= 0.01 && data.valores.valorImovel > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wide text-gray-500">Composição do pagamento</span><span className="text-sm font-bold text-gray-800">{currency.format(composition)}</span></div><div className="mt-2 flex items-center justify-between gap-3 border-t border-black/5 pt-2"><span className="text-xs text-gray-500">Diferença para o valor do imóvel</span><span className={`text-sm font-bold ${Math.abs(difference) <= 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>{currency.format(difference)}</span></div></div></div>}

              {currentStep === 5 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Cidade do contrato" value={data.contrato.cidade} onChange={event => updateSection('contrato', 'cidade', event.target.value)} /><Field label="Data do contrato" type="date" value={data.contrato.data} onChange={event => updateSection('contrato', 'data', event.target.value)} /></div><div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-900">Conferência final</h3>
                  {[
                    { title: 'Origem', step: 0, lines: [contractMode === 'client' ? selectedClient?.nome || 'Cliente não selecionado' : 'Contrato avulso'] },
                    ...[['Vendedores', 'vendedores', 1], ['Compradores', 'compradores', 2]].map(([title, group, step]) => ({
                      title, step, lines: data[group].flatMap(person => [person.nome || 'Nome pendente', `CPF: ${person.cpf || 'pendente'} · RG: ${person.rg || 'pendente'} ${person.orgaoEmissor}/${person.ufRg}`, `${person.estadoCivil || 'Estado civil pendente'} · ${person.endereco || 'Endereço pendente'}`]),
                    })),
                    { title: 'Imóvel', step: 3, lines: [properties.find(item => String(item.id) === propertyId) ? contractPropertyLabel(properties.find(item => String(item.id) === propertyId)) : 'Preenchimento manual', data.imovel.endereco, `Matrícula: ${data.imovel.matricula || 'não preenchida'} · Cartório: ${data.imovel.cartorio || 'não preenchido'}`, data.imovel.descricao].filter(Boolean) },
                    { title: 'Pagamento', step: 4, lines: [
                      `Valor do imóvel: ${currency.format(data.valores.valorImovel)}`,
                      ...[['Sinal', 'sinal'], ['FGTS', 'fgts'], ['Recursos próprios', 'recursosProprios'], ['Financiamento', 'financiamento'], ['Reserva para documentação (separada da composição)', 'reservaDocumentacao']].map(([label, key]) => `${label}: ${currency.format(data.valores[key])}`),
                      `Banco: ${data.valores.banco} · Prazo: ${data.valores.prazoDias} dias`,
                      `Diferença na composição: ${currency.format(difference)}`,
                    ] },
                  ].map(section => <section key={section.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-bold text-slate-800">{section.title}</h4><button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => { setCurrentStep(section.step); setErrors({}); }}>Editar</button></div>
                    {section.lines.map((line, i) => <p key={i} className="mt-1 break-words whitespace-pre-wrap text-xs leading-5 text-slate-600">{line}</p>)}
                  </section>)}
                </div><div className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-5 text-blue-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>{contractMode === 'client' ? 'O contrato será registrado no histórico do cliente e baixado em Word.' : 'Você pode gerar apenas o contrato ou também cadastrar o primeiro comprador como cliente.'} Revise o documento antes da assinatura.</p></div></div>}
            </div>
            <footer className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <Button disabled={currentStep === 0} onClick={() => setCurrentStep(step => Math.max(0, step - 1))} variant="ghost">
                <ChevronLeft className="h-4 w-4" />Voltar
              </Button>
              {furthestStep === 5 && currentStep < 5 && <Button variant="primarySoft" onClick={() => { if (checkStep(currentStep)) setCurrentStep(5); }}>Voltar à revisão</Button>}
              {currentStep < 5 ? (
                <Button onClick={nextStep}>
                  Continuar<ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {contractMode === 'standalone' && (
                    <Button disabled={isGenerating || !data.contrato.cidade || !data.contrato.data} onClick={() => handleGenerate(true)} variant="primarySoft">
                      <UserPlus className="h-4 w-4" />Gerar e cadastrar comprador
                    </Button>
                  )}
                  <Button
                    disabled={!data.contrato.cidade || !data.contrato.data}
                    loading={isGenerating}
                    loadingLabel="Gerando..."
                    onClick={() => handleGenerate(false)}
                    variant="success"
                  >
                    <Download className="h-4 w-4" />{contractMode === 'standalone' ? 'Gerar somente contrato' : 'Gerar e baixar Word'}
                  </Button>
                </div>
              )}
            </footer>
          </main>

          <aside className={`min-w-0 xl:sticky xl:top-5 ${mobilePanel === 'preview' ? 'block' : 'hidden'} xl:block`}><ContractLivePreview data={data} currentStep={currentStep} draftStatus={draftStatus} /></aside>
        </div>
      </div>
    </div>
    </ValidationContext.Provider>
  );
}
