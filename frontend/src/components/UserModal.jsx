import { useState, useEffect } from 'react';
import { saveUser } from '../services/api';
import { X } from 'lucide-react';

const initialFormData = {
    nome: '',
    email: '',
    role: 'Corretor', // Valor padrão
};

const UserModal = ({ isOpen, onClose, onSave, userToEdit }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (userToEdit) {
                setFormData({
                    id: userToEdit.id,
                    nome: userToEdit.nome || '',
                    email: userToEdit.email || '',
                    role: userToEdit.role || 'Corretor',
                });
            } else {
                setFormData(initialFormData);
            }
        }
    }, [isOpen, userToEdit]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData({ ...formData, [id]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await saveUser(formData);
            onSave();
            onClose();
        } catch (error) {
            console.error("Erro ao salvar usuário:", error);
            // Idealmente, mostrar um toast de erro para o usuário
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div id="user-form-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col fade-in">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 id="user-form-title" className="text-lg font-semibold text-secondary">
                        {userToEdit ? 'Editar Usuário' : 'Adicionar Novo Usuário'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <form id="user-form" className="p-6 space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome Completo</label>
                        <input type="text" id="nome" value={formData.nome} onChange={handleInputChange} className="form-input mt-1 block w-full" required />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" id="email" value={formData.email} onChange={handleInputChange} className="form-input mt-1 block w-full" required />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700">Função</label>
                        <select id="role" value={formData.role} onChange={handleInputChange} className="form-select mt-1 block w-full">
                            <option value="Corretor">Corretor</option>
                            <option value="Administrador">Administrador</option>
                        </select>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                            Cancelar
                        </button>
                        <button type="submit" className="py-2 px-4 btn-primary rounded-md" disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'Salvar Usuário'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
