import { useState, useEffect } from 'react';
import { saveClient } from '../services/api';
import useActivityLog from '../hooks/useActivityLog'; // Importar o hook
import { useToast } from '../hooks/useToast'; // Importar toast
import { X, User, FileText, Home, Briefcase, Hash, AlignLeft, Check, Trash2, MapPin } from 'lucide-react';
import ModernInput, { ModernTextArea } from './ModernInput';
import FancySelect from './FancySelect';

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

const initialFormData = {
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
    const [isSaving, setIsSaving] = useState(false);
    const { logActivity } = useActivityLog(); // Usar o hook de log
    const notify = useToast(); // Usar toast notifications

    useEffect(() => {
        // Popula o formulário quando um cliente é passado para edição,
        // ou limpa quando o modal é aberto para um novo cliente.
        if (isOpen) {
            if (clientToEdit) {
                setFormData({
                    id: clientToEdit.id,
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
            } else {
                setFormData(initialFormData);
            }
        }
    }, [isOpen, clientToEdit]);

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
    const STATUS_OPTIONS = ["Documentação Recebida", "Aprovado", "Solicitando Engenharia", "Engenharia Solicitada", "Baixando FGTS", "Preenchendo Fichas", "Assinando Fichas", "Finalizando", "Aguardando Reserva", "Enviando para Conformidade", "Aguardando Conformidade", "Inconforme", "Conforme - Ag. Contrato", "Assinando Contrato", "Assinado", "Assinado-Movido", "Arquivado"];

    return (
        <div id="client-form-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col overflow-hidden transform transition-all duration-200 ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="flex justify-between items-center p-6">
                    <h3 id="form-title" className="text-2xl font-bold text-secondary">
                        {clientToEdit ? 'Editar Cliente' : 'Dados do Emissor'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <form id="client-form" className="p-6 space-y-4 overflow-y-auto" onSubmit={handleSubmit}>
                    <div className="md:col-span-3">
                        <ModernInput id="nome" label="Nome do Cliente" Icon={User} value={formData.nome} onChange={handleInputChange} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ModernInput id="cpf" label="CPF" Icon={FileText} value={formData.cpf} onChange={handleInputChange} placeholder="000.000.000-00" maxLength={14} />

                        {/* Campo de Status (visível apenas na edição) */}
                        {clientToEdit && (
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

                        <ModernInput id="imovel" label="Imóvel" Icon={Home} value={formData.imovel} onChange={handleInputChange} />
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
                        <ModernTextArea id="observacoes" label="Observações" Icon={AlignLeft} value={formData.observacoes} onChange={handleInputChange} rows={4} />
                    </div>
                    <div className="flex justify-between items-center">
                        {/* Botão de excluir à esquerda (só aparece ao editar) */}
                        {clientToEdit && onDelete && (
                            <button
                                type="button"
                                onClick={() => {
                                    onDelete(clientToEdit);
                                    onClose();
                                }}
                                className="inline-flex items-center gap-2 py-2 px-4 text-white rounded-md bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30 transform transition-all duration-200 hover:-translate-y-0.5"
                            >
                                <Trash2 size={16} />
                                Excluir Cliente
                            </button>
                        )}
                        
                        {/* Botões de ação à direita */}
                        <div className="flex gap-3 ml-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                className="py-2 px-4 text-gray-800 font-semibold rounded-md bg-transparent hover:bg-gray-100 transition"
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                className={`inline-flex items-center gap-2 py-2 px-4 text-white rounded-md shadow-lg shadow-blue-500/30 transform transition-all duration-200 ${isSaving ? 'opacity-60 pointer-events-none' : 'hover:-translate-y-0.5'} bg-gradient-to-r from-primary to-blue-600`}
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
