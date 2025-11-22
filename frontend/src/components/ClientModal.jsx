import { useState, useEffect } from 'react';
import { saveClient } from '../services/api';
import { X } from 'lucide-react';

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
                });
            } else {
                setFormData(initialFormData);
            }
        }
    }, [isOpen, clientToEdit]);

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

        const clientPayload = {
            ...formData,
            cpf: formData.cpf.replace(/\D/g, '') || null,
            agencia: formData.agencia.replace(/\D/g, '') || null,
        };

        // Adiciona status 'Aprovado' para novos clientes, como no script original
        if (!clientPayload.id) {
            clientPayload.status = 'Aprovado';
        }

        try {
            await saveClient(clientPayload);
            onSave(); // Recarrega a lista no componente pai
            onClose(); // Fecha o modal
            // No futuro, podemos chamar uma função de toast aqui: showToast('Cliente salvo!')
        } catch (error) {
            console.error("Erro ao salvar cliente:", error);
            // showToast('Falha ao salvar cliente.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div id="client-form-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-full flex flex-col fade-in">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 id="form-title" className="text-lg font-semibold text-secondary">
                        {clientToEdit ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <form id="client-form" className="p-6 space-y-4 overflow-y-auto" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome do Cliente</label>
                            <input type="text" id="nome" value={formData.nome} onChange={handleInputChange} className="form-input mt-1 block w-full" required />
                        </div>
                        <div>
                            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700">CPF</label>
                            <input type="text" id="cpf" value={formData.cpf} onChange={handleInputChange} className="form-input mt-1 block w-full" placeholder="000.000.000-00" maxLength="14" />
                        </div>
                        <div>
                            <label htmlFor="imovel" className="block text-sm font-medium text-gray-700">Imóvel</label>
                            <input type="text" id="imovel" value={formData.imovel} onChange={handleInputChange} className="form-input mt-1 block w-full" />
                        </div>
                        <div>
                            <label htmlFor="corretor" className="block text-sm font-medium text-gray-700">Corretor</label>
                            <input type="text" id="corretor" value={formData.corretor} onChange={handleInputChange} className="form-input mt-1 block w-full" required />
                        </div>
                        <div>
                            <label htmlFor="responsavel" className="block text-sm font-medium text-gray-700">Responsável</label>
                            <input type="text" id="responsavel" value={formData.responsavel} onChange={handleInputChange} className="form-input mt-1 block w-full" />
                        </div>
                        <div>
                            <label htmlFor="agencia" className="block text-sm font-medium text-gray-700">Agência (Nº)</label>
                            <input type="text" id="agencia" value={formData.agencia} onChange={handleInputChange} className="form-input mt-1 block w-full" placeholder="Apenas números" />
                        </div>
                        <div className="md:col-span-3">
                            <label htmlFor="modalidade" className="block text-sm font-medium text-gray-700">Modalidade</label>
                            <input type="text" id="modalidade" value={formData.modalidade} onChange={handleInputChange} className="form-input mt-1 block w-full" placeholder="Ex: Financiamento, À Vista..." />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="observacoes" className="block text-sm font-medium text-gray-700">Observações</label>
                        <textarea id="observacoes" value={formData.observacoes} onChange={handleInputChange} rows="4" className="form-input mt-1 block w-full"></textarea>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                            Cancelar
                        </button>
                        <button type="submit" className="py-2 px-4 btn-primary rounded-md" disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'Salvar Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClientModal;
