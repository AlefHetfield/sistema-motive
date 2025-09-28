// Usar um caminho relativo permite que a API funcione tanto localmente (com 'vercel dev') quanto em produção.
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

/**
 * Busca todos os clientes do backend.
 * @returns {Promise<Array>} Uma promessa que resolve para a lista de clientes.
 */
export async function fetchClients() {
    const response = await fetch(`${API_BASE_URL}/clients`);
    if (!response.ok) throw new Error('Falha ao buscar clientes.');
    return response.json();
}

/**
 * Busca um único cliente pelo ID.
 * @param {number|string} clientId O ID do cliente.
 * @returns {Promise<Object>} Uma promessa que resolve para os dados do cliente.
 */
export async function fetchClient(clientId) {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}`);
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
    const url = id ? `${API_BASE_URL}/clients/${id}` : `${API_BASE_URL}/clients`;
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Falha ao excluir cliente.');
}

/**
 * Busca todos os usuários do backend.
 * @returns {Promise<Array>} Uma promessa que resolve para a lista de usuários.
 */
export async function fetchUsers() {
    const response = await fetch(`${API_BASE_URL}/users`);
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
    const url = id ? `${API_BASE_URL}/users/${id}` : `${API_BASE_URL}/users`;
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Falha ao excluir usuário.');
}