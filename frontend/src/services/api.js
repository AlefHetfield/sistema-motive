/**
 * Define a URL base para todas as chamadas de API.
 * Em produção, usa o mesmo domínio (origin).
 * Em desenvolvimento, usa localhost:3000.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');

const apiError = async (response, fallback) => {
    const data = await response.json().catch(() => ({}));
    return new Error(data.error || fallback);
};

// Loga a URL base uma vez para facilitar diagnóstico em prod/dev
if (typeof window !== 'undefined') {
    // Evita log repetitivo
    if (!window.__API_BASE_URL_LOGGED__) {
        window.__API_BASE_URL_LOGGED__ = true;
        console.log('[API] Base URL:', API_BASE_URL);
    }
}

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

export async function fetchClientActivities(clientId) {
    const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}/activities`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao buscar o histórico do cliente.');
    return response.json();
}

export async function fetchClientSimulations(clientId) {
    const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}/simulations`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao buscar as simulações do cliente.');
    return response.json();
}

export async function saveClientSimulation(clientId, simulationData) {
    const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}/simulations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(simulationData),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao salvar a simulação no cliente.');
    }
    return response.json();
}

export async function deleteClientSimulation(clientId, simulationId) {
    const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}/simulations/${simulationId}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao excluir a simulação.');
    }
}

export async function fetchClientContracts(clientId) {
    const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}/contracts`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao buscar os contratos do cliente.');
    return response.json();
}

export async function createClientContract(clientId, contractData) {
    const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(contractData),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao gerar o contrato.');
    }
    return response.json();
}

export async function fetchStandaloneContracts() {
    const response = await fetch(`${API_BASE_URL}/api/contracts/standalone`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao buscar os contratos avulsos.');
    return response.json();
}

export async function createStandaloneContract(contractData) {
    const response = await fetch(`${API_BASE_URL}/api/contracts/standalone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(contractData),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao gerar o contrato avulso.');
    }
    return response.json();
}

export async function createContractWithNewClient(contractData) {
    const response = await fetch(`${API_BASE_URL}/api/contracts/from-new-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(contractData),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao cadastrar o comprador e gerar o contrato.');
    }
    return response.json();
}

export async function downloadContractDocx(contractId) {
    const response = await fetch(`${API_BASE_URL}/api/contracts/${contractId}/download`, {
        credentials: 'include',
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao baixar o contrato.');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/i);
    return { blob, fileName: match?.[1] || 'Contrato.docx' };
}

export async function deleteClientContract(contractId) {
    const response = await fetch(`${API_BASE_URL}/api/contracts/${contractId}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao excluir o contrato.');
    }
}

export async function fetchProperties(filters = {}) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined));
    const response = await fetch(`${API_BASE_URL}/api/properties?${query}`, { credentials: 'include' });
    if (!response.ok) throw await apiError(response, 'Falha ao buscar os imóveis.');
    return response.json();
}

export async function fetchNextPropertyReference(propertyType) {
    const query = new URLSearchParams({ propertyType: propertyType || 'Outro' });
    const response = await fetch(`${API_BASE_URL}/api/properties/next-reference?${query}`, { credentials: 'include' });
    if (!response.ok) throw await apiError(response, 'Falha ao gerar a referência do imóvel.');
    return response.json();
}

export async function fetchPropertySitePreview(sourceUrl) {
    const response = await fetch(`${API_BASE_URL}/api/properties/site-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceUrl }),
    });
    if (!response.ok) throw await apiError(response, 'Falha ao buscar a foto do anúncio.');
    return response.json();
}

export async function refreshPropertyListings(cursor = 0, limit = 6) {
    const response = await fetch(`${API_BASE_URL}/api/properties/refresh-listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cursor, limit }),
    });
    if (!response.ok) throw await apiError(response, 'Falha ao atualizar os anúncios.');
    return response.json();
}

export async function createProperty(property) {
    const response = await fetch(`${API_BASE_URL}/api/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(property),
    });
    if (!response.ok) throw await apiError(response, 'Falha ao cadastrar o imóvel.');
    return response.json();
}

export async function updateProperty(propertyId, property) {
    const response = await fetch(`${API_BASE_URL}/api/properties/${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(property),
    });
    if (!response.ok) throw await apiError(response, 'Falha ao atualizar o imóvel.');
    return response.json();
}

export async function setPropertyFavorite(propertyId, isFavorite) {
    const response = await fetch(`${API_BASE_URL}/api/properties/${propertyId}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isFavorite }),
    });
    if (!response.ok) throw await apiError(response, 'Falha ao atualizar o favorito.');
    return response.json();
}

export async function deleteProperty(propertyId) {
    const response = await fetch(`${API_BASE_URL}/api/properties/${propertyId}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) throw await apiError(response, 'Falha ao excluir o imóvel.');
}

export async function geocodePropertyAddress(address) {
    const response = await fetch(`${API_BASE_URL}/api/properties/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address }),
    });
    if (!response.ok) throw await apiError(response, 'Falha ao localizar o endereço.');
    return response.json();
}

export async function geocodePropertyPlace(placeId) {
    const response = await fetch(`${API_BASE_URL}/api/properties/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ placeId }),
    });
    if (!response.ok) throw await apiError(response, 'Falha ao localizar o endereço selecionado.');
    return response.json();
}

export async function reverseGeocodePropertyCoordinates(latitude, longitude) {
    const response = await fetch(`${API_BASE_URL}/api/properties/reverse-geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ latitude, longitude }),
    });
    if (!response.ok) throw await apiError(response, 'Falha ao identificar o endereço deste ponto.');
    return response.json();
}

export async function importProperties(content, format) {
    const response = await fetch(`${API_BASE_URL}/api/properties/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, format }),
    });
    if (!response.ok) throw await apiError(response, 'Falha ao importar os imóveis.');
    return response.json();
}

/**
 * Salva um cliente (cria um novo ou atualiza um existente).
 * @param {Object} clientData Os dados do cliente.
 * @returns {Promise<Object>} Uma promessa que resolve para os dados do cliente salvo.
 */
export async function saveClient(clientData) {
    // Proteção contra clientData undefined
    if (!clientData) {
        console.error('[API] saveClient chamado com clientData undefined', clientData);
        throw new Error('Dados do cliente não fornecidos');
    }
    
    const { id, ...data } = clientData;
    const url = id ? `${API_BASE_URL}/api/clients/${id}` : `${API_BASE_URL}/api/clients`;
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Falha ao salvar cliente (${response.status})`);
        }
        
        const result = await response.json();
        
        // Proteção - garantir que temos um objeto válido
        if (!result || typeof result !== 'object') {
            console.warn('[API] Resposta inválida do servidor ao salvar cliente:', result);
            throw new Error('Resposta inválida do servidor');
        }
        
        return result;
    } catch (error) {
        console.error('[API] Erro detalhado em saveClient:', error, { url, method, data });
        throw error;
    }
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
 * Healthcheck da API/DB com timeout para não bloquear
 * @returns {Promise<Object>} status da API e do banco se o backend expõe `/api/health`
 */
export async function getHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos timeout

        const response = await fetch(`${API_BASE_URL}/api/health`, {
            credentials: 'include',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Se a rota não existir, ainda assim retornamos algo útil
        if (!response.ok) {
            return { ok: false, status: response.status, message: 'Health endpoint indisponível' };
        }
        const data = await response.json().catch(() => ({}));
        return { ok: true, ...data };
    } catch (error) {
        if (error.name === 'AbortError') {
            return { ok: false, status: 'timeout', message: 'Health check timeout (API lenta)' };
        }
        return { ok: false, message: error.message };
    }
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
