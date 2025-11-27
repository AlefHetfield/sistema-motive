/**
 * Define a URL base para todas as chamadas de API.
 * Prioriza a variável de ambiente VITE_API_URL, se disponível.
 * Caso contrário, usa um valor padrão para o ambiente de desenvolvimento local.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3000');

/**
 * Busca todos os clientes do backend.
 * @returns {Promise<Array>} Uma promessa que resolve para a lista de clientes.
 */
export async function fetchClients() {
    const response = await fetch(`${API_BASE_URL}/api/clients`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao buscar clientes.');
    return response.json();
}

/**
 * Busca um único cliente pelo ID.
 * @param {number|string} clientId O ID do cliente.
 * @returns {Promise<Object>} Uma promessa que resolve para os dados do cliente.
 */
export async function fetchClient(clientId) {
    const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao buscar dados do cliente.');
    return response.json();
}

/**
 * Salva um cliente (cria um novo ou atualiza um existente).
 * @param {Object} clientData Os dados do cliente.
 * @returns {Promise<Object>} Uma promessa que resolve para os dados do cliente salvo.
 */
export async function saveClient(clientData) {
    const { id, ...data } = clientData;
    const url = id ? `${API_BASE_URL}/api/clients/${id}` : `${API_BASE_URL}/api/clients`;
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Falha ao salvar cliente.');
    return response.json();
}

/**
 * Exclui um cliente do backend.
 * @param {number|string} clientId O ID do cliente a ser excluído.
 */
export async function deleteClient(clientId) {
    const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao excluir cliente.');
}

/**
 * Busca todos os usuários do backend.
 * @returns {Promise<Array>} Uma promessa que resolve para a lista de usuários.
 */
export async function fetchUsers() {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao buscar usuários.');
    return response.json();
}

/**
 * Salva um usuário (cria um novo ou atualiza um existente).
 * @param {Object} userData Os dados do usuário.
 * @returns {Promise<Object>} Uma promessa que resolve para os dados do usuário salvo.
 */
export async function saveUser(userData) {
    const { id, ...data } = userData;
    const url = id ? `${API_BASE_URL}/api/users/${id}` : `${API_BASE_URL}/api/users`;
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Falha ao salvar usuário.');
    return response.json();
}

/**
 * Exclui um usuário do backend.
 * @param {number|string} userId O ID do usuário a ser excluído.
 */
export async function deleteUser(userId) {
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao excluir usuário.');
}
