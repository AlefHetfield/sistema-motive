import { useState, useEffect, useId, useRef } from 'react';
import { useToast } from '../hooks/useToast'; // Importar toast
import { X, User, FileText, Home, Briefcase, Hash, AlignLeft, Check, Trash2, MapPin, Loader2, LockKeyhole } from 'lucide-react';
import ModernInput, { ModernTextArea } from './ModernInput';
import FancySelect from './FancySelect';
import { fetchProperties } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatClientCommission, getClientCommissionBreakdown, isVaniaBroker } from '../utils/clientCommission';

// A função de formatação de CPF pode ser movida para um arquivo 'utils' no futuro
const formatCPF = (cpf) => {
    if (!cpf) return '';
    let value = cpf.toString().replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    return value
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatCurrencyBR = (value) => {
    if (value === null || value === undefined || value === '') return '';
    
    // Remove tudo que não é dígito
    const digits = value.toString().replace(/\D/g, '');
    if (!digits) return '';
    
    // Converte para número (considerando os últimos 2 dígitos como centavos)
    const numValue = Number(digits) / 100;
    
    // Formata como moeda brasileira
    return numValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// Formata valor numérico do DB para exibição
const formatCurrencyFromDB = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const numValue = Number(value);
    if (isNaN(numValue)) return '';
    return numValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const parseCurrencyBR = (value) => {
    if (value === null || value === undefined || value === '') return null;
    
    // Se já é um número, retorna direto
    if (typeof value === 'number') return value;
    
    // Remove tudo que não é dígito
    const digits = value.toString().replace(/\D/g, '');
    if (!digits) return null;
    
    // Converte considerando os últimos 2 dígitos como centavos
    const result = Number(digits) / 100;
    
    // Validação: valores muito grandes provavelmente são erro
    if (result > 100000000) { // Maior que 100 milhões
        console.error('Valor financiado suspeito:', { original: value, resultado: result });
        return null;
    }
    
    return result;
};

const parseCommissionBR = value => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return null;
    const padded = digits.padStart(3, '0');
    return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
};

const cleanPropertyTitle = value => String(value || '')
    .replace(/^\s*\d+(?:[.,]\d+)?\s*[-–]\s*/i, '')
    .replace(/\s*[-–]\s*\d+\s*(?:dorm(?:it[oó]rios?)?|quartos?).*$/i, '')
    .replace(/\s*,?\s*R\$\s*[\d.\s]+(?:,\d{2})?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const propertyLocation = property => {
    const type = String(property?.propertyType || '').toLocaleLowerCase('pt-BR');
    const condominium = cleanPropertyTitle(property?.title);
    const neighborhood = String(property?.neighborhood || '').trim();
    const condominiumClues = [property?.title, property?.address, property?.description, property?.additionalInformation]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');
    const isCondominium = type.includes('apartamento') || type.includes('condom') || /condom[ií]nio|\bcond\b/.test(condominiumClues);
    return isCondominium ? condominium || neighborhood : neighborhood || condominium;
};

const propertyPrice = value => Number.isFinite(Number(value))
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value))
    : '';

const propertyOptionLabel = property => [
    property.code || property.propertyType || 'Imóvel',
    propertyLocation(property) || 'Bairro/condomínio não informado',
    String(property.ownerName || '').trim(),
    propertyPrice(property.price),
].filter(Boolean).join(' - ');

const propertyClientLabel = property => [
    property.code || property.propertyType || 'Imóvel',
    propertyLocation(property),
].filter(Boolean).join(' - ');

const initialFormData = {
    propertyId: null,
    nome: '',
    cpf: '',
    imovel: '',
    corretor: '',
    responsavel: '',
    agencia: '',
    modalidade: '',
    observacoes: '',
    valorFinanciado: '',
    comissaoEstimada: '',
    visitaDiego: false,
    reservaAnuncios: false,
    descontosComissao: [],
    matricula: '',
    cidade: '',
    venda: false,
};

const ClientModal = ({ isOpen, onClose, onSave, clientToEdit, onDelete, brokerSuggestions = [] }) => {
    const { user } = useAuth();
    const canManageCommission = user?.role === 'ADM';
    const [formData, setFormData] = useState(initialFormData);
    const [propertyMode, setPropertyMode] = useState('map');
    const [properties, setProperties] = useState([]);
    const [loadingProperties, setLoadingProperties] = useState(false);
    const [propertiesError, setPropertiesError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [discountErrors, setDiscountErrors] = useState({});
    const brokerListId = useId();
    const discountId = useId();
    const nextDiscountKey = useRef(0);
    const addDiscountButton = useRef(null);
    const notify = useToast(); // Usar toast notifications

    const commissionDiscounts = formData.descontosComissao.map(discount => ({
        descricao: discount.descricao.trim(),
        valor: parseCommissionBR(discount.valor),
    }));
    const commission = canManageCommission ? getClientCommissionBreakdown({
        venda: formData.venda,
        corretor: formData.corretor,
        comissaoEstimada: parseCommissionBR(formData.comissaoEstimada),
        visitaDiego: formData.visitaDiego,
        reservaAnuncios: formData.reservaAnuncios,
        descontosComissao: commissionDiscounts,
    }) : null;
    const requiresCommissionReview = Boolean(canManageCommission && formData.venda && commission.requiresReview);
    const hasDiscountErrors = Object.values(discountErrors).some(errors => errors.descricao || errors.valor);
    const brokerOptions = new Map();
    for (const value of ['Vânia', ...brokerSuggestions]) {
        const name = String(value || '').trim().replace(/\s+/g, ' ');
        if (name) {
            const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
            brokerOptions.set(key, isVaniaBroker(name) ? 'Vânia' : name);
        }
    }

    useEffect(() => {
        // Popula o formulário quando um cliente é passado para edição,
        // ou limpa quando o modal é aberto para um novo cliente.
        if (isOpen) {
            setDiscountErrors({});
            if (clientToEdit) {
                setFormData({
                    id: clientToEdit.id,
                    propertyId: clientToEdit.propertyId || null,
                    nome: clientToEdit.nome || '',
                    cpf: clientToEdit.cpf ? formatCPF(clientToEdit.cpf) : '',
                    imovel: clientToEdit.imovel || '',
                    corretor: clientToEdit.corretor || '',
                    responsavel: clientToEdit.responsavel || '',
                    agencia: clientToEdit.agencia || '',
                    modalidade: clientToEdit.modalidade || '',
                    observacoes: clientToEdit.observacoes || '',
                    valorFinanciado: clientToEdit.valorFinanciado ? formatCurrencyFromDB(clientToEdit.valorFinanciado) : '',
                    comissaoEstimada: canManageCommission ? formatCurrencyFromDB(clientToEdit.comissaoEstimada) : '',
                    visitaDiego: canManageCommission && clientToEdit.visitaDiego === true,
                    reservaAnuncios: canManageCommission && clientToEdit.reservaAnuncios === true,
                    descontosComissao: canManageCommission && Array.isArray(clientToEdit.descontosComissao)
                        ? clientToEdit.descontosComissao.map(discount => ({ key: nextDiscountKey.current++, descricao: discount.descricao || '', valor: formatCurrencyFromDB(discount.valor) }))
                        : [],
                    matricula: clientToEdit.matricula || '',
                    cidade: clientToEdit.cidade || '',
                    venda: clientToEdit.venda || false,
                    // Mantém o status existente ao editar
                    status: clientToEdit.status 
                });
                setPropertyMode(clientToEdit.propertyId ? 'map' : 'manual');
            } else {
                setFormData(initialFormData);
                setPropertyMode('map');
            }
        }
    }, [isOpen, clientToEdit, canManageCommission]);

    useEffect(() => {
        if (!isOpen) return undefined;
        let active = true;
        setLoadingProperties(true);
        setPropertiesError('');
        fetchProperties()
            .then(items => {
                if (active) setProperties(Array.isArray(items) ? items : []);
            })
            .catch(error => {
                if (active) setPropertiesError(error.message || 'Não foi possível carregar os imóveis do mapa.');
            })
            .finally(() => {
                if (active) setLoadingProperties(false);
            });
        return () => { active = false; };
    }, [isOpen]);

    // control modal entry animation mounted state (must be declared unconditionally)
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // trigger entry animation
            requestAnimationFrame(() => setMounted(true));
        } else {
            setMounted(false);
        }
    }, [isOpen]);

    const handleInputChange = (e) => {
        const { id, value, type, checked } = e.target;
        if (id === 'cpf') {
            setFormData({ ...formData, [id]: formatCPF(value) });
        } else if (id === 'valorFinanciado') {
            setFormData({ ...formData, [id]: formatCurrencyBR(value) });
        } else if (id === 'comissaoEstimada') {
            const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
            if (digits.length > 15) return;
            setFormData({ ...formData, [id]: formatCurrencyBR(digits) });
        } else if (type === 'checkbox') {
            setFormData({ ...formData, [id]: checked });
        } else {
            setFormData({ ...formData, [id]: value });
        }
    };

    const handleStatusChange = (value) => {
        setFormData({ ...formData, status: value });
    };

    const addDiscount = () => {
        const key = nextDiscountKey.current++;
        setFormData(current => ({ ...current, descontosComissao: [...current.descontosComissao, { key, descricao: '', valor: '' }] }));
        requestAnimationFrame(() => document.getElementById(`${discountId}-${key}-descricao`)?.focus());
    };

    const updateDiscount = (key, field, value) => {
        let formatted = value;
        if (field === 'valor') {
            const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
            if (digits.length > 15) return;
            formatted = formatCurrencyBR(digits);
        }
        setFormData(current => ({ ...current, descontosComissao: current.descontosComissao.map(discount => discount.key === key ? { ...discount, [field]: formatted } : discount) }));
        setDiscountErrors(current => ({ ...current, [key]: { ...current[key], [field]: undefined } }));
    };

    const removeDiscount = key => {
        setFormData(current => ({ ...current, descontosComissao: current.descontosComissao.filter(discount => discount.key !== key) }));
        setDiscountErrors(current => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        addDiscountButton.current?.focus();
    };

    const handleModalidadeChange = (value) => {
        setFormData({ ...formData, modalidade: value });
    };

    const handlePropertyModeChange = (mode) => {
        setPropertyMode(mode);
        if (mode === 'manual') setFormData(current => ({ ...current, propertyId: null }));
    };

    const handlePropertyChange = (value) => {
        const property = properties.find(item => String(item.id) === String(value));
        setFormData(current => ({
            ...current,
            propertyId: property?.id || null,
            imovel: property ? propertyClientLabel(property) : '',
            cidade: property?.city || current.cidade,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (canManageCommission) {
            const errors = {};
            formData.descontosComissao.forEach((discount, index) => {
                const value = commissionDiscounts[index].valor;
                const fields = {};
                if (!discount.descricao.trim()) fields.descricao = 'Informe a descrição do desconto.';
                if (value === null || value === '0.00') fields.valor = 'Informe um valor maior que zero.';
                if (Object.keys(fields).length) errors[discount.key] = fields;
            });
            setDiscountErrors(errors);
            const [invalidKey] = Object.keys(errors);
            if (invalidKey) {
                const field = errors[invalidKey].descricao ? 'descricao' : 'valor';
                requestAnimationFrame(() => document.getElementById(`${discountId}-${invalidKey}-${field}`)?.focus());
                return;
            }
            if (requiresCommissionReview) {
                document.getElementById('comissaoEstimada')?.focus();
                return;
            }
        }
        setIsSaving(true);

        const valorFinanciadoParsed = parseCurrencyBR(formData.valorFinanciado);
        
        // Log para debug
        if (valorFinanciadoParsed && valorFinanciadoParsed > 10000000) {
            console.warn('Tentando salvar valor financiado muito alto:', {
                nome: formData.nome,
                valorOriginal: formData.valorFinanciado,
                valorParsed: valorFinanciadoParsed
            });
        }

        const { comissaoEstimada, visitaDiego, reservaAnuncios, descontosComissao: _discountDrafts, ...clientData } = formData;
        void _discountDrafts;
        const clientPayload = {
            ...clientData,
            cpf: formData.cpf.replace(/\D/g, '') || null,
            agencia: formData.agencia.replace(/\D/g, '') || null,
            valorFinanciado: valorFinanciadoParsed,
            ...(canManageCommission ? { comissaoEstimada: parseCommissionBR(comissaoEstimada), visitaDiego, reservaAnuncios, descontosComissao: commissionDiscounts } : {}),
        };

        // Adiciona status 'Documentação Recebida' para novos clientes
        const isNewClient = !formData.id;
        if (isNewClient) {
            clientPayload.status = 'Documentação Recebida';
        }

        try {
            // Passa dados para o componente pai tratar o salvamento
            await onSave(clientPayload);
            onClose(); // Fecha o modal após sucesso
        } catch (error) {
            console.error("Erro ao salvar cliente:", error);
            notify.error(`Erro ao salvar cliente: ${error.message || 'Tente novamente'}`);
        } finally {
            setIsSaving(false);
        }
    };


    if (!isOpen) {
        return null;
    }

    // A lista de status para o dropdown do formulário
    const STATUS_OPTIONS = ["Documentação Recebida", "Aprovado", "Solicitando Engenharia", "Engenharia Solicitada", "Baixando FGTS", "Preenchendo Fichas", "Assinando Fichas", "Finalizando", "Aguardando Reserva", "Enviando para Conformidade", "Aguardando Conformidade", "Inconforme", "Conforme - Ag. Contrato", "Assinando Contrato"];

    return (
        <div id="client-form-modal" className="mobile-safe-overlay fixed inset-0 z-[9700] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className={`flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transform transition-all duration-200 ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="flex items-center justify-between gap-3 p-4 sm:p-6">
                    <h3 id="form-title" className="text-2xl font-bold text-secondary">
                        {clientToEdit ? 'Editar Cliente' : 'Dados do Emissor'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <form id="client-form" className="space-y-4 overflow-y-auto p-4 sm:p-6 sm:pt-0" onSubmit={handleSubmit}>
                    <div className="md:col-span-3">
                        <ModernInput id="nome" label="Nome do Cliente" Icon={User} value={formData.nome} onChange={handleInputChange} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ModernInput id="cpf" label="CPF" Icon={FileText} value={formData.cpf} onChange={handleInputChange} placeholder="000.000.000-00" maxLength={14} />

                        {/* Campo de Status (visível apenas na edição) */}
                        {clientToEdit && STATUS_OPTIONS.includes(formData.status) && (
                            <div>
                                <div className="text-xs text-gray-600 mb-1">Status</div>
                                <FancySelect
                                    value={formData.status || ''}
                                    onChange={handleStatusChange}
                                    options={STATUS_OPTIONS.map(status => ({ value: status, label: status }))}
                                    placeholder="Selecione o status..."
                                />
                            </div>
                        )}

                        <div className="md:col-span-3">
                            <div className="mb-1 flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-gray-600">Imóvel</span>
                                <div className="flex rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Origem do imóvel">
                                    <button type="button" onClick={() => handlePropertyModeChange('map')} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${propertyMode === 'map' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Do mapa</button>
                                    <button type="button" onClick={() => handlePropertyModeChange('manual')} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${propertyMode === 'manual' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Digitar</button>
                                </div>
                            </div>
                            {propertyMode === 'map' ? <>
                                <FancySelect
                                    searchable
                                    ariaLabel="Imóvel vinculado ao cliente"
                                    value={formData.propertyId ? String(formData.propertyId) : ''}
                                    onChange={handlePropertyChange}
                                    disabled={loadingProperties}
                                    placeholder={loadingProperties ? 'Carregando imóveis...' : 'Selecione um imóvel do mapa'}
                                    searchPlaceholder="Buscar por código, bairro, condomínio, proprietário ou valor..."
                                    options={properties.map(property => ({
                                        value: String(property.id),
                                        label: propertyOptionLabel(property),
                                        searchText: [property.code, property.title, property.neighborhood, property.address, property.ownerName, property.price].filter(Boolean).join(' '),
                                    }))}
                                />
                                {loadingProperties && <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400"><Loader2 className="h-3 w-3 animate-spin" />Carregando imóveis cadastrados no mapa</p>}
                                {propertiesError && <p className="mt-1.5 text-[11px] text-red-500">{propertiesError} Você ainda pode usar a opção “Digitar”.</p>}
                            </> : <ModernInput id="imovel" Icon={Home} value={formData.imovel} onChange={handleInputChange} placeholder="Digite o imóvel, condomínio ou endereço" />}
                        </div>
                        <div>
                            <ModernInput id="corretor" label="Corretor" Icon={Briefcase} value={formData.corretor} onChange={handleInputChange} list={brokerListId} required />
                            <datalist id={brokerListId}>{[...brokerOptions.values()].map(name => <option key={name} value={name} />)}</datalist>
                        </div>
                        <ModernInput id="responsavel" label="Responsável" Icon={User} value={formData.responsavel} onChange={handleInputChange} />
                        <ModernInput id="agencia" label="Agência (Nº)" Icon={Hash} value={formData.agencia} onChange={handleInputChange} placeholder="Apenas números" />
                        
                        {/* Matrícula e Cidade - lado a lado */}
                        <ModernInput id="matricula" label="Matrícula" Icon={FileText} value={formData.matricula} onChange={handleInputChange} placeholder="Nº da Matrícula" />
                        <ModernInput id="cidade" label="Cidade" Icon={MapPin} value={formData.cidade} onChange={handleInputChange} placeholder="Cidade" />
                        
                        {/* Modalidade - dropdown com opções específicas */}
                        <div>
                            <div className="text-xs text-gray-600 mb-1">Modalidade</div>
                            <FancySelect
                                value={formData.modalidade || ''}
                                onChange={handleModalidadeChange}
                                options={[
                                    { value: 'FGTS', label: 'FGTS' },
                                    { value: 'SBPE', label: 'SBPE' },
                                    { value: 'Pró-Cotista', label: 'Pró-Cotista' }
                                ]}
                                placeholder="Selecione a modalidade..."
                            />
                        </div>
                        
                        {/* Valor Financiado e Checkbox Venda */}
                        <div className="md:col-span-2">
                            <ModernInput 
                                id="valorFinanciado" 
                                label="Valor Financiado (R$)" 
                                value={formData.valorFinanciado} 
                                onChange={handleInputChange} 
                                placeholder="0,00"
                                type="text"
                                inputMode="decimal"
                            />
                        </div>
                        
                        <div className="md:col-span-1 flex items-end">
                            <label className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-all duration-200 w-full">
                                <input
                                    type="checkbox"
                                    id="venda"
                                    checked={formData.venda}
                                    onChange={handleInputChange}
                                    className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary focus:ring-2 cursor-pointer"
                                />
                                <span className="text-sm font-medium text-gray-700">Venda</span>
                            </label>
                        </div>
                    </div>
                    {canManageCommission && (formData.venda || hasDiscountErrors) && (
                        <section aria-label="Comissão administrativa" className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <ModernInput
                                id="comissaoEstimada"
                                label="Comissão bruta (R$)"
                                value={formData.comissaoEstimada}
                                onChange={handleInputChange}
                                placeholder="0,00"
                                inputMode="numeric"
                                inputClassName="font-semibold text-primary"
                                aria-invalid={requiresCommissionReview}
                                aria-describedby={requiresCommissionReview ? 'commission-estimate-help commission-review-error' : 'commission-estimate-help'}
                            />
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <p id="commission-estimate-help" className="text-xs text-gray-500">Valor previsto antes dos descontos</p>
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary"><LockKeyhole size={12} aria-hidden="true" />Administrativo</span>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium text-gray-700">
                                    <input id="visitaDiego" type="checkbox" checked={formData.visitaDiego} onChange={handleInputChange} className="h-4 w-4 accent-primary" />
                                    <span>Visita Diego<span className="mt-0.5 block text-xs font-normal text-gray-500">Desconto de R$ 1.000,00</span></span>
                                </label>
                                <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium text-gray-700">
                                    <input id="reservaAnuncios" type="checkbox" checked={formData.reservaAnuncios} onChange={handleInputChange} className="h-4 w-4 accent-primary" />
                                    <span>Reserva Anúncios<span className="mt-0.5 block text-xs font-normal text-gray-500">Desconto de R$ 500,00</span></span>
                                </label>
                            </div>
                            <div className="mt-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-gray-800">Outros descontos</h4>
                                    <button ref={addDiscountButton} type="button" onClick={addDiscount} disabled={formData.descontosComissao.length >= 100} className="min-h-10 rounded-lg px-2 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50">+ Adicionar desconto</button>
                                </div>
                                <div className="space-y-3">
                                    {formData.descontosComissao.map((discount, index) => {
                                        const descriptionId = `${discountId}-${discount.key}-descricao`;
                                        const valueId = `${discountId}-${discount.key}-valor`;
                                        const errors = discountErrors[discount.key] || {};
                                        return <div key={discount.key} data-discount-row className="grid grid-cols-[minmax(0,1fr)_44px] items-start gap-2 border-b border-primary/10 pb-3 sm:grid-cols-[minmax(0,1fr)_9rem_44px]">
                                            <div className="col-span-2 sm:col-span-1">
                                                <ModernInput id={descriptionId} label="Descrição" aria-label={`Descrição do desconto ${index + 1}`} value={discount.descricao} onChange={event => updateDiscount(discount.key, 'descricao', event.target.value)} maxLength={100} placeholder="Ex. ajuste comercial" aria-invalid={Boolean(errors.descricao)} aria-describedby={errors.descricao ? `${descriptionId}-error` : undefined} />
                                                {errors.descricao && <p id={`${descriptionId}-error`} role="alert" className="mt-1 text-xs text-red-600">{errors.descricao}</p>}
                                            </div>
                                            <div>
                                                <ModernInput id={valueId} label="Valor (R$)" aria-label={`Valor do desconto ${index + 1} (R$)`} value={discount.valor} onChange={event => updateDiscount(discount.key, 'valor', event.target.value)} inputMode="numeric" placeholder="0,00" aria-invalid={Boolean(errors.valor)} aria-describedby={errors.valor ? `${valueId}-error` : undefined} />
                                                {errors.valor && <p id={`${valueId}-error`} role="alert" className="mt-1 text-xs text-red-600">{errors.valor}</p>}
                                            </div>
                                            <button type="button" onClick={() => removeDiscount(discount.key)} aria-label={`Remover desconto ${index + 1}`} className="mt-5 flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={17} aria-hidden="true" /></button>
                                        </div>;
                                    })}
                                </div>
                            </div>
                            <div className="mt-4 rounded-xl border border-primary/15 bg-white/60 p-3.5 text-sm" aria-label="Cálculo da comissão" aria-live="polite">
                                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="text-gray-500">Comissão bruta</span><span className="font-semibold tabular-nums text-gray-800">{formatClientCommission(commission.gross)}</span></div>
                                {commission.discounts.map((discount, index) => <div key={`${index}-${discount.descricao}`} className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-gray-500"><span className="min-w-0 break-words">{discount.descricao}</span><span className="tabular-nums">− {formatClientCommission(discount.valor)}</span></div>)}
                                <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-primary/10 pt-3 text-xs text-gray-500"><span>Total de descontos</span><span className="font-semibold tabular-nums">{formatClientCommission(commission.discountTotal)}</span></div>
                                <p className="mt-3 text-xs font-semibold text-primary">Comissão líquida estimada</p>
                                <p className={`mt-1 text-xl font-bold tabular-nums [overflow-wrap:anywhere] ${requiresCommissionReview ? 'text-red-600' : 'text-primary'}`}>{formatClientCommission(commission.net)}</p>
                            </div>
                            {requiresCommissionReview && <p id="commission-review-error" role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Os descontos superam a comissão bruta em {formatClientCommission(commission.excess)}. Revise os valores antes de salvar.</p>}
                        </section>
                    )}
                    {canManageCommission && !formData.venda && Object.values(discountErrors).some(errors => errors.descricao || errors.valor) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Há descontos incompletos. Marque Venda para revisar ou remover essas linhas antes de salvar.</p>}
                    <div>
                        <ModernTextArea id="observacoes" label="Observações" Icon={AlignLeft} value={formData.observacoes} onChange={handleInputChange} rows={1} placeholder="Adicionar uma observação (opcional)" />
                    </div>
                    <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* Botão de excluir à esquerda (só aparece ao editar) */}
                        {clientToEdit && onDelete && (
                            <button
                                type="button"
                                onClick={() => {
                                    onDelete(clientToEdit);
                                    onClose();
                                }}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-2.5 text-white shadow-lg shadow-red-500/30 transform transition-all duration-200 hover:-translate-y-0.5 hover:from-red-600 hover:to-red-700 sm:w-auto"
                            >
                                <Trash2 size={16} />
                                Excluir Cliente
                            </button>
                        )}
                        
                        {/* Botões de ação à direita */}
                        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto sm:gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 rounded-xl bg-transparent px-4 py-2.5 font-semibold text-gray-800 transition hover:bg-gray-100 sm:flex-none"
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-600 px-4 py-2.5 text-white shadow-lg shadow-blue-500/30 transform transition-all duration-200 sm:flex-none ${isSaving ? 'opacity-60 pointer-events-none' : 'hover:-translate-y-0.5'}`}
                                disabled={isSaving || requiresCommissionReview}
                            >
                                <Check size={16} />
                                {isSaving ? 'Salvando...' : 'Salvar Cliente'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClientModal;
