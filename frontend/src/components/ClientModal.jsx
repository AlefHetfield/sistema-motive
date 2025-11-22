import { useState, useEffect } from 'react';
import { saveClient } from '../services/api';
import useActivityLog from '../hooks/useActivityLog'; // Importar o hook
import { X, User, FileText, Home, Briefcase, Hash, AlignLeft, Check } from 'lucide-react';
import ModernInput, { ModernTextArea } from './ModernInput';

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

const initialFormData = {
    nome: '',
    cpf: '',
    imovel: '',
    corretor: '',
    responsavel: '',
    agencia: '',
    modalidade: '',
    observacoes: '',
};

const ClientModal = ({ isOpen, onClose, onSave, clientToEdit }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [isSaving, setIsSaving] = useState(false);
    const { logActivity } = useActivityLog(); // Usar o hook de log

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
        const { id, value } = e.target;
        if (id === 'cpf') {
            setFormData({ ...formData, [id]: formatCPF(value) });
        } else {
            setFormData({ ...formData, [id]: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const isNewClient = !formData.id;

        const clientPayload = {
            ...formData,
            cpf: formData.cpf.replace(/\D/g, '') || null,
            agencia: formData.agencia.replace(/\D/g, '') || null,
        };

        // Adiciona status 'Aprovado' para novos clientes
        if (isNewClient) {
            clientPayload.status = 'Aprovado';
        }

        try {
            const savedClient = await saveClient(clientPayload);
            
            // Log de atividade
            if (isNewClient) {
                logActivity(`Cliente '${savedClient.nome}' adicionado.`);
            } else {
                logActivity(`Cliente '${savedClient.nome}' atualizado.`);
                // Se o status foi alterado, loga também
                if (clientToEdit && clientToEdit.status !== savedClient.status) {
                    logActivity(`Status de '${savedClient.nome}' alterado para '${savedClient.status}'.`);
                }
            }

            onSave(); // Recarrega a lista no componente pai
            onClose(); // Fecha o modal
        } catch (error) {
            console.error("Erro ao salvar cliente:", error);
        } finally {
            setIsSaving(false);
        }
    };


    if (!isOpen) {
        return null;
    }

    // A lista de status para o dropdown do formulário
    const STATUS_OPTIONS = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado", "Assinado-Movido", "Arquivado"];

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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ModernInput id="nome" label="Nome do Cliente" Icon={User} value={formData.nome} onChange={handleInputChange} required />
                        <ModernInput id="cpf" label="CPF" Icon={FileText} value={formData.cpf} onChange={handleInputChange} placeholder="000.000.000-00" maxLength={14} />

                        {/* Campo de Status (visível apenas na edição) */}
                        {clientToEdit && (
                            <div>
                                <div className="text-xs text-gray-600 mb-1">Status</div>
                                <select
                                    id="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="block w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 outline-none"
                                >
                                    {STATUS_OPTIONS.map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <ModernInput id="imovel" label="Imóvel" Icon={Home} value={formData.imovel} onChange={handleInputChange} />
                        <ModernInput id="corretor" label="Corretor" Icon={Briefcase} value={formData.corretor} onChange={handleInputChange} required />
                        <ModernInput id="responsavel" label="Responsável" Icon={User} value={formData.responsavel} onChange={handleInputChange} />
                        <ModernInput id="agencia" label="Agência (Nº)" Icon={Hash} value={formData.agencia} onChange={handleInputChange} placeholder="Apenas números" />
                        <div className="md:col-span-3">
                            <ModernInput id="modalidade" label="Modalidade" value={formData.modalidade} onChange={handleInputChange} placeholder="Ex: Financiamento, À Vista..." />
                        </div>
                    </div>
                    <div>
                        <ModernTextArea id="observacoes" label="Observações" Icon={AlignLeft} value={formData.observacoes} onChange={handleInputChange} rows={4} />
                    </div>
                    <div className="flex justify-end gap-3">
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
                </form>
            </div>
        </div>
    );
};

export default ClientModal;
