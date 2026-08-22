import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
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
import {
  createClientContract,
  createContractWithNewClient,
  createStandaloneContract,
  downloadContractDocx,
  fetchClients,
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

const Field = ({ label, className = '', ...props }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-bold text-gray-600">{label}</span>
    <input {...props} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10" />
  </label>
);

const SelectField = ({ label, children, className = '', ...props }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-bold text-gray-600">{label}</span>
    <select {...props} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">{children}</select>
  </label>
);

function MoneyField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-gray-600">{label}</span>
      <input
        inputMode="numeric"
        value={currency.format(Number(value) || 0)}
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, '')) / 100)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function PersonForm({ title, person, index, canRemove, onChange, onRemove }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary shadow-sm"><UserRound className="h-4 w-4" /></span><h3 className="text-sm font-bold text-gray-800">{title} {index + 1}</h3></div>
        {canRemove && <button type="button" onClick={onRemove} className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600" title="Remover"><Trash2 className="h-4 w-4" /></button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nome completo" value={person.nome} onChange={event => onChange('nome', event.target.value)} className="sm:col-span-2" />
        <Field label="CPF" value={person.cpf} onChange={event => onChange('cpf', formatCpf(event.target.value))} placeholder="000.000.000-00" />
        <Field label="RG" value={person.rg} onChange={event => onChange('rg', event.target.value)} />
        <Field label="Órgão emissor" value={person.orgaoEmissor} onChange={event => onChange('orgaoEmissor', event.target.value)} />
        <Field label="UF do RG" maxLength={2} value={person.ufRg} onChange={event => onChange('ufRg', event.target.value.toUpperCase())} />
        <Field label="Estado civil" value={person.estadoCivil} onChange={event => onChange('estadoCivil', event.target.value)} placeholder="Ex.: solteiro(a)" />
        <SelectField label="Gênero gramatical" value={person.genero} onChange={event => onChange('genero', event.target.value)}><option value="M">Masculino</option><option value="F">Feminino</option></SelectField>
        <Field label="Endereço completo" value={person.endereco} onChange={event => onChange('endereco', event.target.value)} className="sm:col-span-2 lg:col-span-3" placeholder="Rua, número, bairro, cidade/UF" />
      </div>
    </div>
  );
}

export default function ContractGenerator() {
  const location = useLocation();
  const restored = location.state?.contractData;
  const requestedClientId = Number(location.state?.contractClientId || location.state?.clientId || 0);
  const restoredMode = location.state?.contractMode || (restored && !requestedClientId ? 'standalone' : 'client');
  const [currentStep, setCurrentStep] = useState(restored ? 5 : 0);
  const [contractMode, setContractMode] = useState(restoredMode);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [data, setData] = useState(restored || initialData());
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [standaloneContracts, setStandaloneContracts] = useState([]);
  const [isLoadingStandalone, setIsLoadingStandalone] = useState(true);
  const [downloadingContractId, setDownloadingContractId] = useState(null);

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
    if (contractMode !== 'client' || !selectedClient || restored) return;
    let active = true;
    fetchClientSimulations(selectedClient.id)
      .then(simulations => {
        if (!active) return;
        const latest = Array.isArray(simulations) ? simulations[0] : null;
        const propertyValue = Number(latest?.propertyValue || 0);
        const financed = Number(latest?.financed || selectedClient.valorFinanciado || 0);
        setData(current => ({
          ...current,
          compradores: [{ ...current.compradores[0], nome: selectedClient.nome || '', cpf: formatCpf(selectedClient.cpf || '') }, ...current.compradores.slice(1)],
          imovel: { ...current.imovel, matricula: selectedClient.matricula || '', endereco: selectedClient.imovel || '' },
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
  };

  const stepIsValid = () => {
    if (currentStep === 0 && contractMode === 'client' && !selectedClient) return 'Selecione o cliente que receberá o contrato.';
    if (currentStep === 1 && data.vendedores.some(person => !person.nome || !person.cpf || !person.rg || !person.estadoCivil || !person.endereco)) return 'Preencha os dados obrigatórios dos vendedores.';
    if (currentStep === 2 && data.compradores.some(person => !person.nome || !person.cpf || !person.rg || !person.estadoCivil || !person.endereco)) return 'Preencha os dados obrigatórios dos compradores.';
    if (currentStep === 3 && !data.imovel.descricao && (!data.imovel.categoria || !data.imovel.matricula || !data.imovel.cartorio || !data.imovel.endereco)) return 'Informe a descrição ou todos os dados estruturados do imóvel.';
    if (currentStep === 4 && (data.valores.valorImovel <= 0 || Math.abs(difference) > 0.01 || !data.valores.banco || !data.valores.prazoDias)) return 'Revise o valor do imóvel e a composição do pagamento.';
    return '';
  };

  const nextStep = () => {
    const error = stepIsValid();
    if (error) return toast.error(error);
    setCurrentStep(step => Math.min(5, step + 1));
  };

  const handleGenerate = async (registerClient = false) => {
    if ((contractMode === 'client' && !selectedClient) || isGenerating) return;
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
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><FileSignature className="h-4 w-4" />Documentos</div><h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Gerador de Contratos</h1><p className="mt-1 text-sm text-gray-500">Preencha, revise e gere o contrato de compra e venda em Word.</p></div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4" />Modelo protegido e versionado</div>
        </div>

        <div className="mb-5 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          <div className="flex min-w-max items-center">
            {steps.map((step, index) => { const Icon = step.icon; const active = currentStep === index; const done = currentStep > index; return <button key={step.label} type="button" onClick={() => index <= currentStep && setCurrentStep(index)} className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${active ? 'bg-primary text-white shadow-sm' : done ? 'text-emerald-700 hover:bg-emerald-50' : 'cursor-default text-gray-400'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${active ? 'bg-white/20' : done ? 'bg-emerald-100' : 'bg-gray-100'}`}>{done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}</span>{index + 1}. {step.label}</button>; })}
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <main className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6"><h2 className="text-lg font-bold text-gray-900">{currentStep + 1}. {steps[currentStep].label}</h2></div>
            <div className="p-5 sm:p-6">
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
                      <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" /><input autoFocus value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Buscar por nome ou CPF" className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></div>
                      {isLoadingClients ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando clientes...</div> : <div className="grid gap-2 sm:grid-cols-2">{filteredClients.map(client => { const selected = selectedClient?.id === client.id; return <button key={client.id} type="button" onClick={() => setSelectedClient(client)} className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${selected ? 'border-primary bg-primary/5 ring-2 ring-primary/10' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>{selected ? <Check className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-gray-800">{client.nome || 'Cliente sem nome'}</span><span className="mt-0.5 block truncate text-xs text-gray-400">{client.cpf || 'CPF não informado'} · {client.imovel || 'Imóvel não informado'}</span></span></button>; })}</div>}
                    </div>
                  ) : (
                    <div className="border-t border-gray-100 pt-5">
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">O comprador será informado nas próximas etapas. Este contrato ficará no seu histórico de contratos avulsos, sem criar cadastro no CRM.</div>
                      <h3 className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">Contratos avulsos recentes</h3>
                      {isLoadingStandalone ? <div className="flex items-center gap-2 py-5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando histórico...</div> : standaloneContracts.length ? <div className="space-y-2">{standaloneContracts.slice(0, 5).map(contract => <article key={contract.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-bold text-gray-800">{contract.buyerName}</p><p className="mt-1 text-xs text-gray-500">{currency.format(Number(contract.propertyValue))} · {new Date(contract.createdAt).toLocaleDateString('pt-BR')}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => reopenStandaloneContract(contract)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary ring-1 ring-gray-200 hover:bg-primary hover:text-white">Reabrir</button><button type="button" disabled={downloadingContractId === contract.id} onClick={() => downloadContract(contract)} className="rounded-lg bg-white p-2 text-primary ring-1 ring-gray-200 hover:bg-primary hover:text-white disabled:opacity-50" title="Baixar Word">{downloadingContractId === contract.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button></div></article>)}</div> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Nenhum contrato avulso gerado ainda.</p>}
                    </div>
                  )}
                </div>
              )}

              {(currentStep === 1 || currentStep === 2) && (() => { const group = currentStep === 1 ? 'vendedores' : 'compradores'; const title = currentStep === 1 ? 'Vendedor' : 'Comprador'; return <div className="space-y-4">{data[group].map((person, index) => <PersonForm key={index} title={title} person={person} index={index} canRemove={data[group].length > 1} onChange={(key, value) => updatePerson(group, index, key, value)} onRemove={() => removePerson(group, index)} />)}{data[group].length < 2 && <button type="button" onClick={() => addPerson(group)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition hover:border-primary/50 hover:bg-primary/10"><Plus className="h-4 w-4" />Adicionar {title.toLowerCase()}</button>}</div>; })()}

              {currentStep === 3 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Categoria" value={data.imovel.categoria} onChange={event => updateSection('imovel', 'categoria', event.target.value)}><option value="">Selecione</option><option value="casa">Casa</option><option value="apartamento">Apartamento</option><option value="terreno">Terreno</option></SelectField><Field label="Número da matrícula" value={data.imovel.matricula} onChange={event => updateSection('imovel', 'matricula', event.target.value)} /><Field label="Cartório responsável" value={data.imovel.cartorio} onChange={event => updateSection('imovel', 'cartorio', event.target.value)} /><Field label="Endereço do imóvel" value={data.imovel.endereco} onChange={event => updateSection('imovel', 'endereco', event.target.value)} /></div><label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-600">Descrição jurídica completa <span className="font-normal text-gray-400">(opcional quando os campos acima estiverem completos)</span></span><textarea value={data.imovel.descricao} onChange={event => updateSection('imovel', 'descricao', event.target.value)} rows={6} placeholder="Cole aqui a descrição conforme consta na matrícula..." className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm leading-6 text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Confira a descrição diretamente na matrícula antes de gerar o contrato.</p></div>}

              {currentStep === 4 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><MoneyField label="Valor do imóvel" value={data.valores.valorImovel} onChange={value => updateSection('valores', 'valorImovel', value)} /><MoneyField label="Sinal" value={data.valores.sinal} onChange={value => updateSection('valores', 'sinal', value)} /><MoneyField label="FGTS" value={data.valores.fgts} onChange={value => updateSection('valores', 'fgts', value)} /><MoneyField label="Recursos próprios" value={data.valores.recursosProprios} onChange={value => updateSection('valores', 'recursosProprios', value)} /><MoneyField label="Financiamento" value={data.valores.financiamento} onChange={value => updateSection('valores', 'financiamento', value)} /><MoneyField label="Reserva para documentação" value={data.valores.reservaDocumentacao} onChange={value => updateSection('valores', 'reservaDocumentacao', value)} /><Field label="Banco" value={data.valores.banco} onChange={event => updateSection('valores', 'banco', event.target.value)} className="sm:col-span-2" /><Field label="Prazo do financiamento (dias)" type="number" min="1" max="730" value={data.valores.prazoDias} onChange={event => updateSection('valores', 'prazoDias', Number(event.target.value))} /></div><div className={`rounded-xl border p-4 ${Math.abs(difference) <= 0.01 && data.valores.valorImovel > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wide text-gray-500">Composição do pagamento</span><span className="text-sm font-bold text-gray-800">{currency.format(composition)}</span></div><div className="mt-2 flex items-center justify-between gap-3 border-t border-black/5 pt-2"><span className="text-xs text-gray-500">Diferença para o valor do imóvel</span><span className={`text-sm font-bold ${Math.abs(difference) <= 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>{currency.format(difference)}</span></div></div></div>}

              {currentStep === 5 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Cidade do contrato" value={data.contrato.cidade} onChange={event => updateSection('contrato', 'cidade', event.target.value)} /><Field label="Data do contrato" type="date" value={data.contrato.data} onChange={event => updateSection('contrato', 'data', event.target.value)} /></div><div className="rounded-2xl border border-gray-200 bg-gray-50 p-5"><h3 className="mb-4 text-sm font-bold text-gray-900">Conferência final</h3><div className="grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">{contractMode === 'client' ? 'Cliente vinculado' : 'Tipo de contrato'}</p><p className="mt-1 font-semibold text-gray-800">{contractMode === 'client' ? selectedClient?.nome || 'Não selecionado' : 'Contrato avulso'}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Partes</p><p className="mt-1 font-semibold text-gray-800">{data.vendedores.length} vendedor(es) · {data.compradores.length} comprador(es)</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Imóvel</p><p className="mt-1 font-semibold text-gray-800">{currency.format(data.valores.valorImovel)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Financiamento</p><p className="mt-1 font-semibold text-gray-800">{currency.format(data.valores.financiamento)} · {data.valores.banco}</p></div></div></div><div className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-5 text-blue-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>{contractMode === 'client' ? 'O contrato será registrado no histórico do cliente e baixado em Word.' : 'Você pode gerar apenas o contrato ou também cadastrar o primeiro comprador como cliente.'} Revise o documento antes da assinatura.</p></div></div>}
            </div>
            <footer className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><button type="button" disabled={currentStep === 0} onClick={() => setCurrentStep(step => Math.max(0, step - 1))} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Voltar</button>{currentStep < 5 ? <button type="button" onClick={nextStep} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#4a637a]">Continuar<ChevronRight className="h-4 w-4" /></button> : <div className="flex flex-col gap-2 sm:flex-row">{contractMode === 'standalone' && <button type="button" disabled={isGenerating || !data.contrato.cidade || !data.contrato.data} onClick={() => handleGenerate(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/5 disabled:cursor-wait disabled:opacity-60"><UserPlus className="h-4 w-4" />Gerar e cadastrar comprador</button>}<button type="button" disabled={isGenerating || !data.contrato.cidade || !data.contrato.data} onClick={() => handleGenerate(false)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{isGenerating ? 'Gerando...' : contractMode === 'standalone' ? 'Gerar somente contrato' : 'Gerar e baixar Word'}</button></div>}</footer>
          </main>

          <aside className="space-y-4 xl:sticky xl:top-5"><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" /><h2 className="text-sm font-bold text-gray-900">Resumo do contrato</h2></div><div className="space-y-4"><div><p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{contractMode === 'client' ? 'Cliente' : 'Modalidade'}</p><p className="mt-1 truncate text-sm font-semibold text-gray-800">{contractMode === 'client' ? selectedClient?.nome || 'Aguardando seleção' : 'Contrato avulso'}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Vendedores</p><p className="mt-1 text-lg font-bold text-gray-800">{data.vendedores.length}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Compradores</p><p className="mt-1 text-lg font-bold text-gray-800">{data.compradores.length}</p></div></div><div className="border-t border-gray-100 pt-4"><p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Valor do imóvel</p><p className="mt-1 text-xl font-bold text-gray-900">{currency.format(data.valores.valorImovel)}</p><p className="mt-1 text-xs text-gray-500">Financiamento {currency.format(data.valores.financiamento)}</p></div></div></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span><div><p className="text-sm font-bold text-gray-800">Motive Consultoria Imobiliária</p><p className="mt-1 text-xs leading-5 text-gray-500">Os dados institucionais permanecem protegidos no modelo oficial.</p></div></div></div><div className="flex items-center gap-2 rounded-xl px-2 text-xs text-gray-400"><CalendarDays className="h-4 w-4" />Modelo de contrato v1</div></aside>
        </div>
      </div>
    </div>
  );
}
