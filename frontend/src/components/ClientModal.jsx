import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast'; // Importar toast
import { X, User, FileText, Home, Briefcase, Hash, AlignLeft, Check, Trash2, MapPin, Loader2 } from 'lucide-react';
import ModernInput, { ModernTextArea } from './ModernInput';
import FancySelect from './FancySelect';
import { fetchProperties } from '../services/api';

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
    matricula: '',
    cidade: '',
    venda: false,
};

const ClientModal = ({ isOpen, onClose, onSave, clientToEdit, onDelete }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [propertyMode, setPropertyMode] = useState('map');
    const [properties, setProperties] = useState([]);
    const [loadingProperties, setLoadingProperties] = useState(false);
    const [propertiesError, setPropertiesError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const notify = useToast(); // Usar toast notifications

    useEffect(() => {
        // Popula o formulário quando um cliente é passado para edição,
        // ou limpa quando o modal é aberto para um novo cliente.
        if (isOpen) {
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
    }, [isOpen, clientToEdit]);

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
        } else if (type === 'checkbox') {
            setFormData({ ...formData, [id]: checked });
        } else {
            setFormData({ ...formData, [id]: value });
        }
    };

    const handleStatusChange = (value) => {
        setFormData({ ...formData, status: value });
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

        const clientPayload = {
            ...formData,
            cpf: formData.cpf.replace(/\D/g, '') || null,
            agencia: formData.agencia.replace(/\D/g, '') || null,
            valorFinanciado: valorFinanciadoParsed,
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
                        <ModernInput id="corretor" label="Corretor" Icon={Briefcase} value={formData.corretor} onChange={handleInputChange} required />
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
                                disabled={isSaving}
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
