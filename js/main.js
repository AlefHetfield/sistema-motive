// Criamos uma Promise que será resolvida quando a API do Google Maps carregar.
const googleMapsApiReady = new Promise(resolve => {
    // A função initMap agora está no escopo global e sua única responsabilidade
    // é sinalizar que a API está pronta, resolvendo a Promise.
    window.initMap = () => resolve();
});

// Flag para garantir que o script seja solicitado apenas uma vez.
let isGoogleMapsScriptRequested = false;

/**
 * Carrega o script da API do Google Maps sob demanda.
 * A função é idempotente, ou seja, só adiciona o script uma vez.
 */
function loadGoogleMapsScript() {
    if (isGoogleMapsScriptRequested) {
        return;
    }
    isGoogleMapsScriptRequested = true;

    // VERIFICAÇÃO DE SEGURANÇA: Garante que a chave de API foi definida.
    if (typeof GOOGLE_MAPS_API_KEY === 'undefined' || !GOOGLE_MAPS_API_KEY) {
        console.error("Chave da API do Google Maps não foi encontrada. Verifique se o arquivo 'js/config.js' existe e está configurado corretamente.");
        showToast('Configuração da API do Google Maps ausente.', 'error');
        // Impede a criação da tag script sem a chave.
        return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=marker`;
    script.async = true;
    script.onerror = () => showToast('Falha ao carregar a API do Google Maps.', 'error');
    document.head.appendChild(script);
}

import { fetchClients, fetchClient, saveClient, deleteClient, fetchUsers, saveUser, deleteUser } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {

    // =================================================================================
    // DADOS MOCKADOS (Simulação de um banco de dados)
    // =================================================================================

    const STATUS_OPTIONS = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado"];
    const FINAL_STATUSES = ["Assinado"];

    const statusColorMap = {
        "Aprovado": "status-aprovado",
        "Engenharia": "status-engenharia",
        "Finalização": "status-finalização",
        "Conformidade": "status-conformidade",
        "Assinado": "status-assinado"
    };

    const cityPinColors = {
        'sumare': '#5B7C99',                 // Azul
        'hortolandia': '#FBBF24',            // Amarelo
        'santa barbara d\'oeste': '#4ADE80', // Verde
        'campinas': '#343E48',               // Preto/Grafite
        'nova odessa': '#A855F7',            // Roxo
        'americana': '#881337',              // Vinho
        'paulinia': '#9CA3AF',               // Cinza
        'monte mor': '#F97316',              // Laranja
        'valinhos': '#4ADE80',               // Verde
        'default': '#E11D48'                 // Cor Padrão (Rosa)
    };

    // Os dados dos clientes agora virão de um banco de dados através da API.
    // Este array mockado não é mais a fonte principal de dados.
    // let clients = [
    //     { id: 1, nome: 'João da Silva', cpf: '11122233344', areaInteresse: 'Apartamento 3 quartos', corretor: 'Carlos Silva', responsavel: 'Ana Souza', observacoes: 'Cliente quer visitar imóveis no centro.', agencia: 101, modalidade: 'Financiamento', status: 'Aprovado', ultimaAtualizacao: '2025-08-28T10:00:00Z', dataAssinaturaContrato: null, createdAt: '2025-09-04T10:00:00Z' },
    //     { id: 2, nome: 'Maria Oliveira', cpf: '55566677788', areaInteresse: 'Casa com quintal', corretor: 'Fernanda Lima', responsavel: 'Carlos Silva', observacoes: 'Prefere bairros residenciais.', agencia: 205, modalidade: 'À Vista', status: 'Aprovado', ultimaAtualizacao: '2025-08-27T15:30:00Z', dataAssinaturaContrato: null, createdAt: '2025-08-25T15:30:00Z' },
    //     { id: 3, nome: 'Pedro Martins', cpf: '99988877766', areaInteresse: 'Cobertura', corretor: 'Carlos Silva', responsavel: 'Carlos Silva', observacoes: 'Aguardando documentação do banco.', agencia: 101, modalidade: 'Consórcio', status: 'Engenharia', ultimaAtualizacao: '2025-08-29T11:00:00Z', dataAssinaturaContrato: null, createdAt: '2025-08-15T11:00:00Z' },
    //     { id: 4, nome: 'Juliana Costa', cpf: '12345678900', areaInteresse: 'Loft moderno', corretor: 'Ricardo Alves', responsavel: 'Ana Souza', observacoes: 'Processo em fase final.', agencia: 311, modalidade: 'Financiamento', status: 'Finalização', ultimaAtualizacao: '2025-08-25T09:00:00Z', dataAssinaturaContrato: null, createdAt: '2025-08-01T09:00:00Z' },
    //     { id: 5, nome: 'Lucas Ferreira', cpf: '09876543211', areaInteresse: 'Terreno comercial', corretor: 'Fernanda Lima', responsavel: 'Carlos Silva', observacoes: 'Análise de conformidade em andamento.', agencia: 205, modalidade: 'Permuta', status: 'Conformidade', ultimaAtualizacao: '2025-08-29T14:20:00Z', dataAssinaturaContrato: null, createdAt: '2025-09-02T14:20:00Z' },
    //     { id: 6, nome: 'Beatriz Almeida', cpf: '11223344556', areaInteresse: 'Apartamento 2 quartos', corretor: 'Carlos Silva', responsavel: 'Carlos Silva', observacoes: 'Contrato assinado com sucesso.', agencia: 101, modalidade: 'Financiamento', status: 'Assinado', ultimaAtualizacao: '2025-07-15T18:00:00Z', dataAssinaturaContrato: '2025-07-15', createdAt: '2025-06-10T18:00:00Z' },
    //     { id: 7, nome: 'Roberto Nunes', cpf: '66554433221', areaInteresse: 'Sítio', corretor: 'Ricardo Alves', responsavel: 'Ana Souza', observacoes: 'Cliente desistiu da compra.', agencia: 311, modalidade: 'À Vista', status: 'Assinado', ultimaAtualizacao: '2025-06-20T12:00:00Z', dataAssinaturaContrato: null, createdAt: '2025-05-20T12:00:00Z' },
    // ];
    
    let properties = [
        { id: 201, city: 'Sumaré', title: 'Casa Térrea no Jd. das Flores', address: 'Rua das Rosas, 123, Sumaré, SP', price: 650000, area: 200, photoUrl: 'https://placehold.co/300x200/5B7C99/FFFFFF?text=Im%C3%B3vel+1', lat: -22.8219, lng: -47.2662, description: 'Bela casa com 3 dormitórios, sendo 1 suíte. Amplo quintal com churrasqueira. Garagem para 2 carros.' },
        { id: 202, city: 'Sumaré', title: 'Apartamento com Varanda Gourmet', address: 'Avenida Rebouças, 900, Sumaré, SP', price: 480000, area: 90, photoUrl: 'https://placehold.co/300x200/343E48/FFFFFF?text=Im%C3%B3vel+2', lat: -22.8258, lng: -47.2715, description: 'Apartamento novo, nunca habitado. Condomínio com lazer completo.' },
        { id: 203, city: 'Campinas', title: 'Cobertura Duplex no Cambuí', address: 'Rua Coronel Quirino, 1500, Campinas, SP', price: 1200000, area: 250, photoUrl: 'https://placehold.co/300x200/5B7C99/FFFFFF?text=Im%C3%B3vel+3', lat: -22.8935, lng: -47.0497, description: '' },
        { id: 204, city: 'Paulínia', title: 'Casa em Condomínio Fechado', address: 'Avenida José Paulino, 2500, Paulínia, SP', price: 850000, area: 300, photoUrl: 'https://placehold.co/300x200/343E48/FFFFFF?text=Im%C3%B3vel+4', lat: -22.7633, lng: -47.1536, description: '' },
        { id: 205, city: 'Campinas', title: 'Kitnet Próxima à Unicamp', address: 'Rua Roxo Moreira, 123, Campinas, SP', price: 250000, area: 40, photoUrl: 'https://placehold.co/300x200/5B7C99/FFFFFF?text=Im%C3%B3vel+5', lat: -22.8164, lng: -47.0725, description: '' }
    ];

    let activityLog = [];

    // =================================================================================
    // SELETORES DE ELEMENTOS DOM
    // =================================================================================
    let statusPieChartInstance = null;
    const loginPage = document.getElementById('login-page');
    const appMenuView = document.getElementById('app-menu-view');
    const appStructure = document.getElementById('app-structure');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

    const loginForm = document.getElementById('login-form');
    
    const appCardDashboard = document.getElementById('app-card-dashboard');
    const appCardMap = document.getElementById('app-card-map');
    const appCardClients = document.getElementById('app-card-clients');
    const appCardCep = document.getElementById('app-card-cep');
    const appCardPdf = document.getElementById('app-card-pdf');
    const appCardSettings = document.getElementById('app-card-settings');

    const mainContent = document.getElementById('main-content');
    const pageTitle = document.getElementById('page-title');
    const views = {
        dashboard: document.getElementById('dashboard-view'),
        clients: document.getElementById('clients-view'),
        map: document.getElementById('map-view'),
        pdf: document.getElementById('pdf-editor-view'),
        cep: document.getElementById('cep-view'),
        settings: document.getElementById('settings-view'),
    };
    
    const navLinks = {
        appMenu: document.getElementById('nav-app-menu'),
        dashboard: document.getElementById('nav-dashboard'),
        clients: document.getElementById('nav-clients'),
        map: document.getElementById('nav-map'),
        pdf: document.getElementById('nav-pdf'),
        cep: document.getElementById('nav-cep'),
        settings: document.getElementById('nav-settings'),
    };

    const statsGrid = document.getElementById('stats-grid');
    const recentActivityList = document.getElementById('recent-activity-list');
    
    const clientsTableBody = document.getElementById('clients-table-body');
    const archivedTableBody = document.getElementById('archived-table-body');
    const usersTableBody = document.getElementById('users-table-body');
    
    const tabActive = document.getElementById('tab-active');
    const tabArchived = document.getElementById('tab-archived');
    const activeClientsContent = document.getElementById('active-clients-content');
    const archivedClientsContent = document.getElementById('archived-clients-content');

    const searchInput = document.getElementById('search-client');
    const filterStatus = document.getElementById('filter-status');
    const filterCorretor = document.getElementById('filter-corretor');
    // Novos seletores para os filtros da aba de arquivados
    const searchArchivedInput = document.getElementById('search-archived-client');
    const filterArchivedStatus = document.getElementById('filter-archived-status');
    const filterArchivedCorretor = document.getElementById('filter-archived-corretor');

    const clientFormModal = document.getElementById('client-form-modal');
    const clientForm = document.getElementById('client-form');
    const formTitle = document.getElementById('form-title');
    const addClientBtn = document.getElementById('add-client-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    
    const userFormModal = document.getElementById('user-form-modal');
    const userForm = document.getElementById('user-form');
    const userFormTitle = document.getElementById('user-form-title');
    const addUserBtn = document.getElementById('add-user-btn');
    const closeUserModalBtn = document.getElementById('close-user-modal-btn');
    const cancelUserFormBtn = document.getElementById('cancel-user-form-btn');

    const propertyFormModal = document.getElementById('property-form-modal');
    const propertyForm = document.getElementById('property-form');
    const propertyFormTitle = document.getElementById('property-form-title');
    const addPropertyBtn = document.getElementById('add-property-btn');
    const closePropertyModalBtn = document.getElementById('close-property-modal-btn');
    const cancelPropertyFormBtn = document.getElementById('cancel-property-form-btn');

    const archiveConfirmModal = document.getElementById('archive-confirm-modal');
    const cancelArchiveBtn = document.getElementById('cancel-archive-btn');
    const confirmArchiveBtn = document.getElementById('confirm-archive-btn');
    
    const deleteUserConfirmModal = document.getElementById('delete-user-confirm-modal');
    const cancelDeleteUserBtn = document.getElementById('cancel-delete-user-btn');
    const confirmDeleteUserBtn = document.getElementById('confirm-delete-user-btn');

    const deletePropertyConfirmModal = document.getElementById('delete-property-confirm-modal');
    const cancelDeletePropertyBtn = document.getElementById('cancel-delete-property-btn');
    const confirmDeletePropertyBtn = document.getElementById('confirm-delete-property-btn');

    const deleteClientConfirmModal = document.getElementById('delete-client-confirm-modal');
    const cancelDeleteClientBtn = document.getElementById('cancel-delete-client-btn');
    const confirmDeleteClientBtn = document.getElementById('confirm-delete-client-btn');

    const statusDropdownMenu = document.getElementById('status-dropdown-menu');
    
    const propertiesList = document.getElementById('properties-list');
    const orderByProperty = document.getElementById('order-by-property');
    const radiusSelect = document.getElementById('radius-select');
    const radiusSearchBtn = document.getElementById('radius-search-btn');
    const radiusClearBtn = document.getElementById('radius-clear-btn');
    const mapContainer = document.getElementById('map-container');
    
    const cepTabByCep = document.getElementById('cep-tab-by-cep');
    const cepTabByAddress = document.getElementById('cep-tab-by-address');
    const cepContentByCep = document.getElementById('cep-content-by-cep');
    const cepContentByAddress = document.getElementById('cep-content-by-address');
    const cepFormByCep = document.getElementById('cep-form-by-cep');
    const cepFormByAddress = document.getElementById('cep-form-by-address');
    const cepInput = document.getElementById('cep-input');
    const cepStreet = document.getElementById('cep-street');
    const cepCity = document.getElementById('cep-city');
    const cepState = document.getElementById('cep-state');
    const cepResults = document.getElementById('cep-results');

    // Seletores do Editor de PDF
    const pdfFileInputReplace = document.getElementById('pdf-file-input-replace');
    const pdfFileInputAppend = document.getElementById('pdf-file-input-append');
    const addMorePdfBtn = document.getElementById('add-more-pdf-btn');
    const clearPdfBtn = document.getElementById('clear-pdf-btn');
    const savePdfBtn = document.getElementById('save-pdf-btn');
    const pdfPagesPreview = document.getElementById('pdf-pages-preview');
    const pdfStatus = document.getElementById('pdf-status');

    // =================================================================================
    // LÓGICA DO MAPA
    // =================================================================================
    let map;
    let geocoder;
    let mapMarkers = [];
    let activeInfoWindow = null;
    let radiusCircle = null;
    let isMapInitialized = false;

    // Esta função agora é chamada internamente, depois de garantirmos que a API e o DOM estão prontos.
    async function initializeMap() {
        if (map) return; // Evita reinicialização

        // Espera a API do Google Maps estar pronta antes de prosseguir.
        await googleMapsApiReady;

        const sumare = { lat: -22.8219, lng: -47.2662 };
        map = new google.maps.Map(document.getElementById("map"), {
            zoom: 12,
            center: sumare,
            mapId: "MOTIVE_MAP_ID",
        });
        geocoder = new google.maps.Geocoder();
        isMapInitialized = true;
        
        renderPropertiesOnMap(properties);
        renderPropertiesList(properties);
    }
    
    // Função para calcular distância entre duas coordenadas (essencial para a busca por raio)
    function haversineDistance(coords1, coords2) {
        function toRad(x) {
            return x * Math.PI / 180;
        }

        const R = 6371; // Raio da Terra em km
        const dLat = toRad(coords2.lat - coords1.lat);
        const dLon = toRad(coords2.lng - coords1.lng);
        const lat1 = toRad(coords1.lat);
        const lat2 = toRad(coords2.lat);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function renderPropertiesOnMap(propertiesToRender) {
        if (!map) return;
        // Limpa marcadores antigos (a nova API usa marker.map = null)
        mapMarkers.forEach(marker => marker.map = null);
        mapMarkers = [];
        
        propertiesToRender.forEach(prop => {
            // Define a cor do pino com base na cidade
            const normalizedCity = prop.city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const pinColor = cityPinColors[normalizedCity] || cityPinColors['default'];

            // Mantém a diferenciação do ícone interno (casa vs. prédio)
            const isApartment = prop.title.toLowerCase().includes('apartamento');
            const iconElement = document.createElement('i');
            iconElement.className = isApartment ? 'fa-solid fa-building' : 'fa-solid fa-house';

            // Cria o pino no estilo "Google My Maps"
            const pinGlyph = new google.maps.marker.PinElement({
                glyph: iconElement,
                glyphColor: 'white',
                background: pinColor,
                borderColor: pinColor, // Mesma cor do fundo para "remover" a borda
            });

            const marker = new google.maps.marker.AdvancedMarkerElement({
                position: { lat: prop.lat, lng: prop.lng },
                map: map,
                title: prop.title,
                content: pinGlyph.element, // Define o pino como o conteúdo do marcador
            });

            const priceFormatted = prop.price ? `R$ ${prop.price.toLocaleString('pt-BR')}` : 'Preço a consultar';
            const areaFormatted = prop.area ? `${prop.area} m²` : '';

            const descriptionHTML = prop.description ? `<p class="text-xs text-gray-600 mt-2 border-t pt-2">${prop.description}</p>` : '';

            const contentString = `
                <div class="w-64">
                    <img src="${prop.photoUrl}" alt="${prop.title}" class="w-full h-32 object-cover">
                    <div class="p-3">
                        <h3 class="font-bold text-md text-secondary">${prop.title}</h3>
                        <p class="text-sm text-text-secondary mt-1">${prop.address}</p>
                        ${descriptionHTML}
                        <div class="flex justify-between items-center mt-3">
                            <p class="font-semibold text-primary text-lg">${priceFormatted}</p>
                            <p class="text-sm text-gray-500">${areaFormatted}</p>
                        </div>
                    </div>
                </div>
            `;
            const infowindow = new google.maps.InfoWindow({ content: contentString });

            marker.addListener("click", () => {
                if (activeInfoWindow) activeInfoWindow.close();
                infowindow.open(map, marker);
                activeInfoWindow = infowindow;
            });
            
            marker.propertyId = prop.id;
            mapMarkers.push(marker);
        });
    }
    
    function renderPropertiesList(propertiesToRender) {
        propertiesList.innerHTML = '';
        if (propertiesToRender.length === 0) {
            propertiesList.innerHTML = '<p class="p-4 text-center text-sm text-gray-500">Nenhum imóvel encontrado.</p>';
            return;
        }
        
        const sortOrder = orderByProperty.value;
        const sortedProperties = [...propertiesToRender].sort((a, b) => {
            if (sortOrder === 'price-asc') {
                return (a.price || Infinity) - (b.price || Infinity);
            } else {
                return (b.price || 0) - (a.price || 0);
            }
        });

        // Separa favoritos dos demais
        const favoriteProperties = sortedProperties.filter(p => p.isFavorite);
        const otherProperties = sortedProperties.filter(p => !p.isFavorite);

        // Agrupa os imóveis restantes por cidade
        const groupedByCity = otherProperties.reduce((acc, prop) => {
            const city = prop.city;
            if (!acc[city]) {
                acc[city] = [];
            }
            acc[city].push(prop);
            return acc;
        }, {});
        
        // Função auxiliar para criar um item da lista de imóvel
        const createPropertyItem = (prop) => {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-3 hover:bg-gray-100 border-b gap-2';
            item.dataset.propertyId = prop.id;

            const starIcon = prop.isFavorite 
                ? `<svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.31h5.418a.562.562 0 01.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.07a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988h5.418a.563.563 0 00.475-.31L11.48 3.5z"/></svg>`
                : `<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.31h5.418a.562.562 0 01.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.07a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988h5.418a.563.563 0 00.475-.31L11.48 3.5z"/></svg>`;

            const priceFormatted = prop.price ? `R$ ${prop.price.toLocaleString('pt-BR')}` : 'Preço a consultar';

            item.innerHTML = `
                <div class="flex-grow cursor-pointer pr-2 overflow-hidden">
                    <h4 class="font-semibold text-sm text-secondary truncate">${prop.title}</h4>
                    <p class="text-xs text-text-secondary truncate">${prop.address}</p>
                    <p class="text-sm font-semibold text-primary mt-1">${priceFormatted}</p>
                </div>
                <div class="flex items-center shrink-0">
                    <button class="favorite-btn p-2 rounded-full hover:bg-yellow-100 transition-colors">
                        ${starIcon}
                    </button>
                    <button class="edit-property-btn p-2 rounded-full hover:bg-blue-100 transition-colors">
                        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L13.196 5.2z"></path></svg>
                    </button>
                    <button class="delete-property-btn p-2 rounded-full hover:bg-red-100 transition-colors">
                        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            `;

            // Evento para clicar na área de texto e focar no mapa
            item.querySelector('.flex-grow').addEventListener('click', () => {
                const marker = mapMarkers.find(m => m.propertyId === prop.id);
                if (marker) {
                    map.panTo(marker.position);
                    map.setZoom(16);
                    google.maps.event.trigger(marker, 'click');
                }
            });

            // Evento para clicar no botão de favoritar
            item.querySelector('.favorite-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Impede que o clique se propague para o item pai
                const property = properties.find(p => p.id === prop.id);
                if (property) {
                    property.isFavorite = !property.isFavorite;
                    // Re-renderiza a lista para refletir a mudança (mover para/de favoritos)
                    renderPropertiesList(properties);
                }
            });

            // Evento para clicar no botão de deletar
            item.querySelector('.delete-property-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDeletePropertyBtn.dataset.propertyId = prop.id;
                deletePropertyConfirmModal.classList.remove('hidden');
            });

            // Evento para clicar no botão de editar
            item.querySelector('.edit-property-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openPropertyFormModal(prop.id);
            });

            return item;
        };

        // 1. Renderiza a seção de Favoritos
        if (favoriteProperties.length > 0) {
            const favHeader = document.createElement('h3');
            favHeader.className = 'text-xs font-bold uppercase text-yellow-800 bg-yellow-100 p-2 sticky top-0 flex items-center';
            favHeader.innerHTML = `
                <svg class="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                Favoritos
            `;
            propertiesList.appendChild(favHeader);
            favoriteProperties.forEach(prop => propertiesList.appendChild(createPropertyItem(prop)));
        }

        // 2. Ordena as cidades: Sumaré primeiro, depois o resto em ordem alfabética
        const sortedCities = Object.keys(groupedByCity).sort((a, b) => {
            if (a === 'Sumaré') return -1;
            if (b === 'Sumaré') return 1;
            return a.localeCompare(b);
        });

        // 3. Renderiza as cidades ordenadas
        sortedCities.forEach(city => {
            const cityHeader = document.createElement('h3');
            cityHeader.className = 'text-xs font-bold uppercase text-gray-500 bg-gray-100 p-2 sticky top-0';
            cityHeader.textContent = city;
            propertiesList.appendChild(cityHeader);
            groupedByCity[city].forEach(prop => propertiesList.appendChild(createPropertyItem(prop)));
        });
    }

    function startRadiusSearch() {
        if (!map) return;
        mapContainer.style.cursor = 'crosshair';
        radiusSearchBtn.textContent = 'Clique no mapa...';
        radiusSearchBtn.disabled = true;

        const listener = map.addListener('click', (e) => {
            const center = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            const radiusKm = parseFloat(radiusSelect.value);

            if (radiusCircle) radiusCircle.setMap(null);
            radiusCircle = new google.maps.Circle({
                strokeColor: '#5B7C99',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#5B7C99',
                fillOpacity: 0.2,
                map,
                center,
                radius: radiusKm * 1000, // Raio em metros
            });

            const propertiesInRadius = properties.filter(prop => {
                const propCoords = { lat: prop.lat, lng: prop.lng };
                const distance = haversineDistance(center, propCoords);
                return distance <= radiusKm;
            });

            renderPropertiesOnMap(propertiesInRadius);
            renderPropertiesList(propertiesInRadius);

            mapContainer.style.cursor = '';
            radiusSearchBtn.textContent = 'Buscar';
            radiusSearchBtn.disabled = false;
            radiusClearBtn.classList.remove('hidden');

            google.maps.event.removeListener(listener);
        });
    }
    
    function clearRadiusSearch() {
        if (radiusCircle) radiusCircle.setMap(null);
        radiusCircle = null;
        renderPropertiesOnMap(properties);
        renderPropertiesList(properties);
        radiusClearBtn.classList.add('hidden');
    }

    function openPropertyFormModal(propertyId = null) {
        propertyForm.reset();
        document.getElementById('property-id').value = '';

        if (propertyId) {
            const property = properties.find(p => p.id === propertyId);
            if (property) {
                propertyFormTitle.textContent = 'Editar Imóvel';
                document.getElementById('property-id').value = property.id;
                document.getElementById('property-title').value = property.title;
                document.getElementById('property-description').value = property.description || '';
                document.getElementById('property-address').value = property.address;
                document.getElementById('property-price').value = property.price;
                document.getElementById('property-area').value = property.area;
                document.getElementById('property-photo').value = property.photoUrl;
            }
        } else {
            propertyFormTitle.textContent = 'Adicionar Novo Imóvel';
        }
        propertyFormModal.classList.remove('hidden');
    }

    function closePropertyFormModal() {
        propertyFormModal.classList.add('hidden');
    }

    function handlePropertyFormSubmit(event) {
        event.preventDefault();
        const submitButton = propertyForm.querySelector('button[type="submit"]');
        const propertyId = document.getElementById('property-id').value;
        const address = document.getElementById('property-address').value;

        if (!geocoder) { // Função atualizada para lidar com Edição
            showToast('Serviço de mapa não inicializado.', 'error');
            return;
        }

        const processData = (location, city) => {
            const propertyData = {
                title: document.getElementById('property-title').value,
                description: document.getElementById('property-description').value,
                address: address,
                price: parseFloat(document.getElementById('property-price').value) || null,
                area: parseFloat(document.getElementById('property-area').value) || null,
                photoUrl: document.getElementById('property-photo').value || 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sem+Foto',
                lat: location.lat(),
                lng: location.lng(),
                city: city,
            };

            if (propertyId) { // Atualiza imóvel existente
                const index = properties.findIndex(p => p.id == propertyId);
                if (index !== -1) {
                    properties[index] = { ...properties[index], ...propertyData };
                }
            } else { // Cria novo imóvel
                propertyData.id = Date.now();
                properties.push(propertyData);
            }
            clearRadiusSearch();
            closePropertyFormModal();
            showToast('Imóvel salvo com sucesso!', 'success');
            // Após salvar, renderiza novamente o mapa e a lista
            renderPropertiesOnMap(properties);
            renderPropertiesList(properties);
        };

        const existingProperty = propertyId ? properties.find(p => p.id == propertyId) : null;
        const addressChanged = !existingProperty || existingProperty.address !== address;

        if (addressChanged) {
            toggleButtonLoading(submitButton, true);
            geocoder.geocode({ 'address': address }, (results, status) => {
                toggleButtonLoading(submitButton, false);
                if (status !== 'OK') {
                    showToast('Endereço não encontrado. Verifique os dados.', 'error');
                    return;
                }

                const location = results[0].geometry.location;
                const cityComponent = results[0].address_components.find(c => c.types.includes('administrative_area_level_2'));
                const city = cityComponent ? cityComponent.long_name : 'Não informada';
                processData(location, city);
            });
        } else {
            const location = { lat: () => existingProperty.lat, lng: () => existingProperty.lng };
            processData(location, existingProperty.city);
        }
    }
    
    // =================================================================================
    // FUNÇÕES DE UI/UX (User Interface / User Experience)
    // =================================================================================

    /**
     * Renderiza um estado de "carregando" com linhas de esqueleto.
     * @param {HTMLElement} container O elemento (tbody) onde o loader será inserido.
     * @param {number} columns O número de colunas da tabela.
     * @param {number} rows O número de linhas de esqueleto a serem exibidas.
     */
    function renderSkeletonLoader(container, columns, rows = 5) {
        let skeletonHTML = '';
        for (let i = 0; i < rows; i++) {
            skeletonHTML += '<tr class="bg-white border-b">';
            for (let j = 0; j < columns; j++) {
                skeletonHTML += `
                    <td class="px-6 py-4">
                        <div class="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                `;
            }
            skeletonHTML += '</tr>';
        }
        container.innerHTML = skeletonHTML;
    }

    /**
     * Renderiza uma mensagem de "estado vazio" para tabelas.
     * @param {HTMLElement} container O elemento (tbody) onde a mensagem será inserida.
     * @param {string} icon O HTML do ícone SVG.
     * @param {string} title O título da mensagem.
     * @param {string} subtitle O subtítulo ou descrição.
     * @param {number} colspan O número de colunas que a célula deve ocupar.
     */
    function renderEmptyState(container, icon, title, subtitle, colspan = 12) {
        container.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center p-10">
                    <div class="flex flex-col items-center text-gray-400 max-w-md mx-auto">
                        ${icon}
                        <h3 class="text-lg font-semibold text-gray-600 mt-4">${title}</h3>
                        <p class="text-sm">${subtitle}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Exibe uma notificação toast na tela.
     * @param {string} message A mensagem a ser exibida.
     * @param {'success'|'error'} type O tipo de notificação.
     * @param {number} duration Duração em milissegundos.
     */
    function showToast(message, type = 'success', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconHtml = '';
        if (type === 'success') {
            iconHtml = `<svg class="w-6 h-6 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else if (type === 'error') {
            iconHtml = `<svg class="w-6 h-6 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        }

        toast.innerHTML = `${iconHtml}<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }

    /**
     * Alterna o estado de carregamento de um botão.
     * @param {HTMLButtonElement} button O elemento do botão.
     * @param {boolean} isLoading Define se o estado é de carregamento.
     */
    function toggleButtonLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || 'Salvar';
        }
    }

    // =================================================================================
    // LÓGICA DO EDITOR DE PDF
    // =================================================================================
    let loadedPdfFiles = [];

    async function handlePdfFileSelection(event, append = false) {
        const files = event.target.files;
        const { pdfjsLib } = window;

        if (files.length === 0) return;

        if (!pdfjsLib) {
            pdfStatus.textContent = 'Erro: Biblioteca PDF não foi carregada.';
            console.error('PDF.js library (pdfjsLib) is not available.');
            return;
        }

        if (!append) {
            pdfPagesPreview.innerHTML = '';
            loadedPdfFiles = [];
        }

        pdfStatus.textContent = 'Carregando arquivos...';
        savePdfBtn.disabled = true; // Desabilita enquanto processa
        addMorePdfBtn.disabled = true;
        clearPdfBtn.disabled = true;

        // Configura o worker do PDF.js
        const initialFileIndex = loadedPdfFiles.length;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            pdfStatus.textContent = `Processando ${file.name}...`;
            
            const fileReader = new FileReader();
            const fileBuffer = await new Promise(resolve => {
                fileReader.onload = (e) => resolve(e.target.result);
                fileReader.readAsArrayBuffer(file);
            });

            loadedPdfFiles.push(fileBuffer);
            const pdfDoc = await pdfjsLib.getDocument({ data: fileBuffer }).promise;

            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: 0.5 });
                
                const pageContainer = document.createElement('div');
                pageContainer.className = 'p-1 border rounded-md shadow-sm cursor-grab bg-white relative group';
                pageContainer.dataset.fileIndex = initialFileIndex + i;
                pageContainer.dataset.pageIndex = pageNum - 1;

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.className = 'w-full h-auto';

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                const pageLabel = document.createElement('span');
                pageLabel.className = 'absolute top-1 right-1 bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center';

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'absolute top-1 left-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity';
                deleteBtn.innerHTML = '<i class="fa-solid fa-times fa-xs"></i>';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    pageContainer.remove();
                    updatePageNumbers();
                    checkPdfState();
                };
                
                pageContainer.appendChild(canvas);
                pageContainer.appendChild(pageLabel);
                pageContainer.appendChild(deleteBtn);
                pdfPagesPreview.appendChild(pageContainer);
            }
        }

        updatePageNumbers();
        new Sortable(pdfPagesPreview, {
            animation: 150,
            ghostClass: 'bg-blue-100',
            onEnd: updatePageNumbers
        });

        pdfStatus.textContent = `${pdfPagesPreview.children.length} páginas carregadas. Arraste para reordenar.`;
        checkPdfState();
        pdfFileInputReplace.value = ''; // Limpa os inputs para permitir selecionar o mesmo arquivo novamente
        pdfFileInputAppend.value = '';
    }

    function checkPdfState() {
        const hasPages = pdfPagesPreview.children.length > 0;
        savePdfBtn.disabled = !hasPages;
        addMorePdfBtn.disabled = !hasPages;
        clearPdfBtn.disabled = !hasPages;
    }

    function clearAllPdfPages() {
        pdfPagesPreview.innerHTML = '';
        loadedPdfFiles = [];
        pdfStatus.textContent = '';
        checkPdfState();
    }

    function updatePageNumbers() {
        const pages = pdfPagesPreview.children;
        for (let i = 0; i < pages.length; i++) {
            pages[i].querySelector('span').textContent = i + 1;
        }
    }

    async function saveMergedPdf() {
        pdfStatus.textContent = 'Criando novo PDF... Isso pode levar um momento.';
        savePdfBtn.disabled = true;
        clearPdfBtn.disabled = true;

        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        const pageElements = Array.from(pdfPagesPreview.children);

        for (const pageElement of pageElements) {
            const fileIndex = parseInt(pageElement.dataset.fileIndex);
            const pageIndex = parseInt(pageElement.dataset.pageIndex);
            const rotation = parseInt(pageElement.dataset.rotation || '0');

            if (!loadedPdfFiles[fileIndex]) continue; // Segurança

            const sourcePdfDoc = await PDFDocument.load(loadedPdfFiles[fileIndex]);
            const [copiedPage] = await mergedPdf.copyPages(sourcePdfDoc, [pageIndex]);
            mergedPdf.addPage(copiedPage);
        }

        // A compressão avançada não é trivial no cliente.
        // O pdf-lib por padrão já otimiza o arquivo ao salvar.
        const pdfBytes = await mergedPdf.save({ useObjectStreams: true });

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `documento_unificado_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        pdfStatus.textContent = 'PDF salvo com sucesso!';
        showToast('PDF combinado salvo com sucesso!', 'success');
        checkPdfState();
    }

    // =================================================================================
    // FUNÇÕES GERAIS E DE RENDERIZAÇÃO
    // =================================================================================
    
    // Função de navegação atualizada para gerenciar o padding
    function navigateTo(viewName) {
        Object.values(views).forEach(v => v.classList.add('hidden'));
        views[viewName].classList.remove('hidden');

        pageTitle.textContent = {
            dashboard: 'Dashboard',
            clients: 'Clientes',
            map: 'Mapa de Imóveis',
            pdf: 'Editor de PDF',
            cep: 'Buscador de CEP',
            settings: 'Configurações'
        }[viewName];
        
        Object.values(navLinks).forEach(link => link.classList.remove('bg-gray-700', 'text-white'));
        const activeLink = navLinks[viewName];
        if (activeLink) activeLink.classList.add('bg-gray-700', 'text-white');
        
        if (viewName === 'map') {
            mainContent.classList.remove('p-6');
            // Carrega o script da API (se ainda não foi carregado)
            loadGoogleMapsScript();
            // Chama a inicialização do mapa (que aguardará a API estar pronta)
            initializeMap();
        } else {
            mainContent.classList.add('p-6');
        }
        
        if (viewName === 'dashboard') renderDashboard();
        if (viewName === 'clients') showActiveTab();
        if (viewName === 'settings') renderUsersTable();
    }
    
    /**
     * Formata uma string de CPF para o padrão 000.000.000-00.
     * @param {string} cpf O CPF a ser formatado (pode conter ou não a máscara).
     * @returns {string} O CPF formatado.
     */
    function formatCPF(cpf) {
        if (!cpf) return '';
        let value = cpf.toString().replace(/\D/g, ''); // Remove tudo que não é dígito
        value = value.substring(0, 11); // Limita a 11 caracteres

        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        return value;
    }

    // O resto das suas funções (renderDashboard, updateStatusBadge, etc.)
    // continuam aqui...
    function logActivity(clientName, action) {
        activityLog.unshift({ clientName, action, timestamp: new Date() });
        if (activityLog.length > 10) activityLog.pop();
    }

    function formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " anos atrás";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " meses atrás";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " dias atrás";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " horas atrás";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutos atrás";
        return "agora mesmo";
    }

    async function renderDashboard() {
        let statusCounts = {};
        try {
            const clients = await fetchClients();
            statusCounts = clients.reduce((acc, client) => {
                if (!FINAL_STATUSES.includes(client.status)) {
                    acc[client.status] = (acc[client.status] || 0) + 1;
                }
                return acc;
            }, {});
        } catch (error) {
            console.error("Erro ao renderizar dashboard:", error);
        }

        statsGrid.innerHTML = '';
        STATUS_OPTIONS.filter(s => !FINAL_STATUSES.includes(s)).forEach(status => {
            const count = statusCounts[status] || 0;
            const colorClass = statusColorMap[status];
            const card = `
                <div class="bg-surface p-4 rounded-lg shadow-md flex items-center">
                    <div class="p-3 rounded-full ${colorClass} mr-4">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-secondary">${count}</div>
                        <div class="text-sm text-text-secondary">${status}</div>
                    </div>
                </div>
            `;
            statsGrid.innerHTML += card;
        });
        await renderStatusPieChart();

        recentActivityList.innerHTML = '';
        if (activityLog.length === 0) {
            recentActivityList.innerHTML = `<li class="p-4 text-center text-gray-500">Nenhuma atividade recente.</li>`;
            return;
        }
        activityLog.slice(0, 5).forEach(log => {
            const item = `
                <li class="p-4 flex justify-between items-center hover:bg-gray-50">
                    <div>
                        <p class="font-medium text-sm text-secondary">${log.clientName}</p>
                        <p class="text-xs text-text-secondary">${log.action}</p>
                    </div>
                    <span class="text-xs text-gray-400">${formatTimeAgo(log.timestamp)}</span>
                </li>
            `;
            recentActivityList.innerHTML += item;
        });
    }

    async function renderStatusPieChart() {
        const ctx = document.getElementById('status-pie-chart')?.getContext('2d');
        if (!ctx) return;

        let statusCounts = {};
        try {
            const clients = await fetchClients();
            const activeClients = clients.filter(client => !FINAL_STATUSES.includes(client.status));
            statusCounts = activeClients.reduce((acc, client) => {
                acc[client.status] = (acc[client.status] || 0) + 1;
                return acc;
            }, {});
        } catch (error) {
            console.error("Erro ao renderizar gráfico:", error);
        }

        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);

        // Cores mais vibrantes para o gráfico
        const chartColors = {
            "Aprovado": "#A8A29E",       // Cinza/Pedra
            "Engenharia": "#F87171",     // Vermelho
            "Finalização": "#FBBF24",    // Amarelo/Âmbar
            "Conformidade": "#4ADE80",   // Verde
            "Assinado": "#60A5FA"        // Azul
        };

        const backgroundColors = labels.map(label => chartColors[label] || '#CCCCCC');

        // Destrói o gráfico anterior para evitar sobreposição e vazamento de memória
        if (statusPieChartInstance) {
            statusPieChartInstance.destroy();
        }

        statusPieChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Clientes',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: '#FFFFFF',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function updateStatusBadge(badgeElement, status) {
        badgeElement.querySelector('span').textContent = status;
        Object.values(statusColorMap).forEach(cls => badgeElement.classList.remove(cls));
        const colorClass = statusColorMap[status];
        if (colorClass) badgeElement.classList.add(colorClass);
    }
    
    async function showActiveTab() {
        activeClientsContent.classList.remove('hidden');
        archivedClientsContent.classList.add('hidden');
        tabActive.classList.add('border-primary', 'text-primary');
        tabActive.classList.remove('border-transparent', 'text-gray-500');
        tabArchived.classList.add('border-transparent', 'text-gray-500');
        tabArchived.classList.remove('border-primary', 'text-primary');
        await renderClientsTable();
    }

    async function showArchivedTab() {
        activeClientsContent.classList.add('hidden');
        archivedClientsContent.classList.remove('hidden');
        tabArchived.classList.add('border-primary', 'text-primary');
        tabArchived.classList.remove('border-transparent', 'text-gray-500');
        tabActive.classList.add('border-transparent', 'text-gray-500');
        tabActive.classList.remove('border-primary', 'text-primary');
        await renderArchivedTable();
    }
    
    async function populateFilters() {
        filterStatus.innerHTML = '<option value="">Todos os Status</option>';
        STATUS_OPTIONS.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            filterStatus.appendChild(option);
        });
        
        try {
            const allClients = await fetchClients();
            filterCorretor.innerHTML = '<option value="">Todos os Corretores</option>';
            // Filtra para pegar apenas corretores não nulos ou vazios
            const corretores = [...new Set(allClients.map(c => c.corretor).filter(Boolean))];
            corretores.forEach(corretor => {
                const option = document.createElement('option');
                option.value = corretor;
                option.textContent = corretor;
                filterCorretor.appendChild(option);
            });

            // Reutiliza os dados dos clientes para os filtros de arquivados
            const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            filterArchiveMonth.innerHTML = '<option value="">Todos os Meses</option>';
            meses.forEach((mes, index) => {
                const option = document.createElement('option');
                option.value = index + 1;
                option.textContent = mes;
                filterArchiveMonth.appendChild(option);
            });

            filterArchiveYear.innerHTML = '<option value="">Todos os Anos</option>';
            const anos = [...new Set(allClients.filter(c => c.dataAssinaturaContrato).map(c => new Date(c.dataAssinaturaContrato).getFullYear()))].sort().reverse();
            anos.forEach(ano => {
                const option = document.createElement('option');
                option.value = ano;
                option.textContent = ano;
                filterArchiveYear.appendChild(option);
            });

        } catch (error) {
            console.error("Erro ao popular filtros:", error);
            filterCorretor.innerHTML = '<option value="">Falha ao carregar</option>';
        }
    }

    function getDayCounter(creationDate) {
        const today = new Date();
        const created = new Date(creationDate);
        const diffTime = Math.abs(today - created);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let colorClass = '';
        if (diffDays < 10) colorClass = 'bg-green-100 text-green-800';
        else if (diffDays < 20) colorClass = 'bg-yellow-100 text-yellow-800';
        else if (diffDays < 30) colorClass = 'bg-orange-100 text-orange-800';
        else colorClass = 'bg-red-100 text-red-800';
        
        return {
            days: diffDays.toString().padStart(2, '0'),
            color: colorClass
        };
    }

    async function renderClientsTable() {
      renderSkeletonLoader(clientsTableBody, 11); // Mostra o esqueleto de carregamento
  
      try {
          const allClients = await fetchClients();
          const searchTerm = searchInput.value.toLowerCase();
          const statusFilter = filterStatus.value;
          const corretorFilter = filterCorretor.value;
  
          const activeClients = allClients.filter(client => 
              !FINAL_STATUSES.includes(client.status) &&
              client.nome.toLowerCase().includes(searchTerm) &&
              (statusFilter === '' || client.status === statusFilter) &&
              (corretorFilter === '' || client.corretor === corretorFilter)
          );
  
          clientsTableBody.innerHTML = ''; // Limpa o loader
          if (activeClients.length === 0) {
              const icon = `<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>`;
              renderEmptyState(clientsTableBody, icon, 'Nenhum cliente encontrado', 'Tente ajustar seus filtros ou adicione um novo cliente.', 11);
              return;
          }
  
          activeClients.forEach(client => {
          const row = document.createElement('tr');
          row.className = 'bg-white border-b';
          const dayCounter = getDayCounter(client.createdAt);
          
          row.innerHTML = `
              <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${client.nome}</td>
              <td class="px-6 py-4">${formatCPF(client.cpf || '')}</td>
              <td class="px-6 py-4">${client.areaInteresse}</td>
              <td class="px-6 py-4">${client.corretor}</td>
              <td class="px-6 py-4">${client.responsavel || ''}</td>
              <td class="px-6 py-4">${client.agencia || ''}</td>
              <td class="px-6 py-4">${client.modalidade || ''}</td>
              <td class="px-6 py-4">
                  <div class="relative">
                      <button data-id="${client.id}" class="status-badge text-xs font-medium px-3 py-1.5 rounded-full w-full text-left flex justify-between items-center">
                          <span>${client.status}</span>
                          <svg class="w-3 h-3 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                      </button>
                  </div>
              </td>
              <td class="px-6 py-4 text-center">
                  <span class="text-sm font-bold px-2.5 py-1 rounded-full ${dayCounter.color}">${dayCounter.days}</span>
              </td>
              <td class="px-6 py-4">
                  <input type="date" data-id="${client.id}" class="signature-date-input form-input text-xs p-1 rounded-md" value="${client.dataAssinaturaContrato || ''}">
              </td>
              <td class="px-6 py-4 text-center space-x-3 whitespace-nowrap">
                  <button data-id="${client.id}" class="edit-btn font-medium text-primary hover:underline">Detalhes</button>
                  <button data-id="${client.id}" class="delete-client-btn font-medium text-red-600 hover:underline">Excluir</button>
                  <button data-id="${client.id}" class="archive-btn py-1 px-3 rounded-md shadow-sm text-xs font-medium btn-primary disabled:bg-gray-300 disabled:cursor-not-allowed" ${!client.dataAssinaturaContrato ? 'disabled' : ''}>Arquivar</button>
              </td>
          `;
          clientsTableBody.appendChild(row);

          const newBadge = row.querySelector('.status-badge');
          updateStatusBadge(newBadge, client.status);
      });
      } catch (error) {
          console.error("Erro ao renderizar tabela de clientes:", error);
          const icon = `<svg class="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
          renderEmptyState(clientsTableBody, icon, 'Falha ao carregar dados', 'Verifique a conexão com o servidor e tente novamente.', 11);
      }
    }
    
    async function renderArchivedTable() {
        renderSkeletonLoader(archivedTableBody, 11); // Agora com 11 colunas

        try {
            const allClients = await fetchClients();
            // Utiliza os novos filtros
            const searchTerm = searchArchivedInput.value.toLowerCase();
            const statusFilter = filterArchivedStatus.value;
            const corretorFilter = filterArchivedCorretor.value;

            const archivedClients = allClients.filter(client => {
                return FINAL_STATUSES.includes(client.status) &&
                       client.nome.toLowerCase().includes(searchTerm) &&
                       (statusFilter === '' || client.status === statusFilter) &&
                       (corretorFilter === '' || client.corretor === corretorFilter);
            });

            archivedTableBody.innerHTML = ''; // Limpa o loader
            if (archivedClients.length === 0) {
                const icon = `<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>`;
                renderEmptyState(archivedTableBody, icon, 'Nenhum cliente arquivado encontrado', 'Ajuste os filtros ou verifique se há clientes com status final.', 11);
                return;
            }

            archivedClients.forEach(client => {
                const row = document.createElement('tr');
                row.className = 'bg-white border-b';

                // Calcula a duração do processo (criação até assinatura)
                let durationDays = 'N/A';
                let durationColor = 'bg-gray-100 text-gray-800';
                if (client.createdAt && client.dataAssinaturaContrato) {
                    const created = new Date(client.createdAt);
                    const signed = new Date(client.dataAssinaturaContrato);
                    const diffTime = Math.abs(signed - created);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    durationDays = diffDays.toString().padStart(2, '0');
                    if (diffDays < 30) durationColor = 'bg-green-100 text-green-800';
                    else if (diffDays < 60) durationColor = 'bg-yellow-100 text-yellow-800';
                    else durationColor = 'bg-red-100 text-red-800';
                }

                row.innerHTML = `
                    <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${client.nome}</td>
                    <td class="px-6 py-4">${client.corretor}</td>
                    <td class="px-6 py-4">${formatCPF(client.cpf || '')}</td>
                    <td class="px-6 py-4">${client.areaInteresse}</td>
                    <td class="px-6 py-4">${client.responsavel || ''}</td>
                    <td class="px-6 py-4">${client.agencia || ''}</td>
                    <td class="px-6 py-4">${client.modalidade || ''}</td>
                    <td class="px-6 py-4">
                        <span class="status-badge text-xs font-medium px-3 py-1.5 rounded-full">
                            <span>${client.status}</span>
                        </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="text-sm font-bold px-2.5 py-1 rounded-full ${durationColor}">${durationDays}</span>
                    </td>
                    <td class="px-6 py-4">${client.dataAssinaturaContrato ? new Date(client.dataAssinaturaContrato + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</td>
                    <td class="px-6 py-4 text-center space-x-3 whitespace-nowrap">
                        <button data-id="${client.id}" class="edit-btn font-medium text-primary hover:underline">Detalhes</button>
                        <button data-id="${client.id}" class="restore-client-btn font-medium text-green-600 hover:underline">Restaurar</button>
                        <button data-id="${client.id}" class="delete-client-btn font-medium text-red-600 hover:underline">Excluir</button>
                    </td>
                `;
                archivedTableBody.appendChild(row);

                const newBadge = row.querySelector('.status-badge');
                updateStatusBadge(newBadge, client.status);
            });
        } catch (error) {
            console.error("Erro ao renderizar tabela de arquivados:", error);
            const icon = `<svg class="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
            renderEmptyState(archivedTableBody, icon, 'Falha ao carregar dados', 'Verifique a conexão com o servidor e tente novamente.', 11);
        }
    }
    
    async function renderUsersTable() {
        renderSkeletonLoader(usersTableBody, 4);

        try {
            const users = await fetchUsers();
            usersTableBody.innerHTML = '';

            if (users.length === 0) {
                const icon = `<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
                renderEmptyState(usersTableBody, icon, 'Nenhum usuário cadastrado', 'Adicione o primeiro usuário da sua equipe clicando no botão acima.', 4);
                return;
            }

            users.forEach(user => {
                const row = document.createElement('tr');
                row.className = 'bg-white border-b';
                const roleClass = user.role === 'Administrador' ? 'bg-primary/20 text-primary' : 'bg-gray-200 text-gray-800';
                row.innerHTML = `
                    <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${user.nome}</td>
                    <td class="px-6 py-4">${user.email}</td>
                    <td class="px-6 py-4">
                        <span class="text-xs font-medium px-2.5 py-0.5 rounded ${roleClass}">${user.role}</span>
                    </td>
                    <td class="px-6 py-4 text-center space-x-4 whitespace-nowrap">
                        <button data-id="${user.id}" class="edit-user-btn font-medium text-primary hover:underline">Editar</button>
                        <button data-id="${user.id}" class="delete-user-btn font-medium text-red-600 hover:underline">Excluir</button>
                    </td>
                `;
                usersTableBody.appendChild(row);
            });
        } catch (error) {
            console.error("Erro ao renderizar tabela de usuários:", error);
            const icon = `<svg class="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
            renderEmptyState(usersTableBody, icon, 'Falha ao carregar usuários', 'Verifique a conexão com o servidor e tente novamente.', 4);
        }
    }
    
    async function openFormModal(clientId = null) {
        clientForm.reset();
        if (clientId) {
            try {
                const client = await fetchClient(clientId);
                formTitle.textContent = 'Editar Detalhes do Cliente';
                document.getElementById('client-id').value = client.id;
                document.getElementById('nome').value = client.nome;            
                document.getElementById('cpf').value = formatCPF(client.cpf || '');
                document.getElementById('areaInteresse').value = client.areaInteresse;
                document.getElementById('corretor').value = client.corretor;
                document.getElementById('responsavel').value = client.responsavel;
                document.getElementById('agencia').value = client.agencia || '';
                document.getElementById('modalidade').value = client.modalidade || '';
                document.getElementById('observacoes').value = client.observacoes;
            } catch (error) {
                showToast('Erro ao carregar dados do cliente.', 'error');
                return;
            }
        } else {
            formTitle.textContent = 'Adicionar Novo Cliente';
            document.getElementById('client-id').value = '';
        }
        clientFormModal.classList.remove('hidden');
    }

    function closeFormModal() {
        clientFormModal.classList.add('hidden');
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const id = document.getElementById('client-id').value;
        const cpfValue = document.getElementById('cpf').value.replace(/\D/g, '');
        const agenciaValue = document.getElementById('agencia').value.replace(/\D/g, '');
        
        const clientData = {
            nome: document.getElementById('nome').value,
            cpf: cpfValue || null, // Envia null se a string for vazia
            areaInteresse: document.getElementById('areaInteresse').value,
            corretor: document.getElementById('corretor').value,
            responsavel: document.getElementById('responsavel').value,
            agencia: agenciaValue || null, // Envia null se a string for vazia
            modalidade: document.getElementById('modalidade').value,
            observacoes: document.getElementById('observacoes').value,
            status: 'Aprovado', // <<<< ADICIONE ESTA LINHA
        };

        if (id) {
            clientData.id = id;
        }

        try {
            const savedClient = await saveClient(clientData);
            logActivity(savedClient.nome, id ? 'Dados atualizados' : 'Cliente adicionado');
            
            closeFormModal();
            showToast('Cliente salvo com sucesso!', 'success');
            await renderClientsTable();
            await populateFilters(); 
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            showToast('Não foi possível salvar o cliente. Tente novamente.', 'error');
        }
    }
    
    async function openUserFormModal(userId = null) {
        userForm.reset();
        document.getElementById('user-id').value = '';
        if (userId) {
            try {
                // Para não criar um endpoint `GET /users/:id`, buscamos todos e filtramos.
                // Para um número grande de usuários, o ideal seria ter o endpoint específico.
                const allUsers = await fetchUsers();
                const user = allUsers.find(u => u.id === userId);
                if (user) {
                    userFormTitle.textContent = 'Editar Usuário';
                    document.getElementById('user-id').value = user.id;
                    document.getElementById('user-nome').value = user.nome;
                    document.getElementById('user-email').value = user.email;
                    document.getElementById('user-role').value = user.role;
                }
            } catch (error) {
                showToast('Erro ao carregar dados do usuário.', 'error');
                return;
            }
        } else {
            userFormTitle.textContent = 'Adicionar Novo Usuário';
            document.getElementById('user-id').value = '';
        }
        userFormModal.classList.remove('hidden');
    }
    
    function closeUserFormModal() {
        userFormModal.classList.add('hidden');
    }

    async function handleUserFormSubmit(event) {
        event.preventDefault();
        const id = document.getElementById('user-id').value;
        const userData = {
            nome: document.getElementById('user-nome').value,
            email: document.getElementById('user-email').value,
            role: document.getElementById('user-role').value,
        };

        if (id) userData.id = id;

        try {
            await saveUser(userData);
            closeUserFormModal();
            showToast('Usuário salvo com sucesso!', 'success');
            await renderUsersTable();
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
            showToast('Não foi possível salvar o usuário. Tente novamente.', 'error');
        }
    }
    
    function showCepByCepTab() {
        cepContentByCep.classList.remove('hidden');
        cepContentByAddress.classList.add('hidden');
        cepTabByCep.classList.add('border-primary', 'text-primary');
        cepTabByCep.classList.remove('border-transparent', 'text-gray-500');
        cepTabByAddress.classList.add('border-transparent', 'text-gray-500');
        cepTabByAddress.classList.remove('border-primary', 'text-primary');
        cepResults.innerHTML = '';
    }

    function showCepByAddressTab() {
        cepContentByAddress.classList.remove('hidden');
        cepContentByCep.classList.add('hidden');
        cepTabByAddress.classList.add('border-primary', 'text-primary');
        cepTabByAddress.classList.remove('border-transparent', 'text-gray-500');
        cepTabByCep.classList.add('border-transparent', 'text-gray-500');
        cepTabByCep.classList.remove('border-primary', 'text-primary');
        cepResults.innerHTML = '';
    }

    function renderCepResults(data, isList = false) {
        cepResults.innerHTML = '';
        if ((isList && data.length === 0) || (!isList && data.erro)) {
            cepResults.innerHTML = `<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert"><p class="font-bold">Aviso</p><p>Nenhum endereço encontrado para os termos informados.</p></div>`;
            return;
        }

        const resultsArray = isList ? data : [data];

        const resultCards = resultsArray.map(item => `
            <div class="bg-surface p-4 rounded-lg shadow-sm border">
                <p><strong>CEP:</strong> ${item.cep}</p>
                <p><strong>Logradouro:</strong> ${item.logradouro}</p>
                <p><strong>Bairro:</strong> ${item.bairro}</p>
                <p><strong>Cidade:</strong> ${item.localidade}</p>
                <p><strong>Estado:</strong> ${item.uf}</p>
            </div>
        `).join('');

        cepResults.innerHTML = `<div class="space-y-4">${resultCards}</div>`;
    }

    async function handleCepSearch(event) {
        event.preventDefault();
        const submitButton = cepFormByCep.querySelector('button[type="submit"]');
        const cep = cepInput.value.replace(/\D/g, '');
        if (cep.length !== 8) {
            showToast('CEP inválido. Por favor, digite 8 números.', 'error');
            return;
        }
        cepResults.innerHTML = `<p class="text-center text-gray-500">Buscando...</p>`;
        toggleButtonLoading(submitButton, true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (!response.ok) throw new Error('Falha na busca');
            const data = await response.json();
            renderCepResults(data);
        } catch (error) {
            showToast('Não foi possível realizar a busca. Tente novamente.', 'error');
            cepResults.innerHTML = '';
        } finally {
            toggleButtonLoading(submitButton, false);
        }
    }
    
    async function handleAddressSearch(event) {
        event.preventDefault();
        const state = cepState.value;
        const city = cepCity.value;
        const street = cepStreet.value;
        const submitButton = cepFormByAddress.querySelector('button[type="submit"]');

        if (!state || !city || !street || street.length < 3) {
            showToast('Preencha todos os campos. A rua deve ter no mínimo 3 caracteres.', 'error');
            return;
        }
        cepResults.innerHTML = `<p class="text-center text-gray-500">Buscando...</p>`;
        toggleButtonLoading(submitButton, true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${state}/${city}/${street}/json/`);
            if (!response.ok) throw new Error('Falha na busca');
            const data = await response.json();
            renderCepResults(data, true);
        } catch (error) {
            showToast('Não foi possível realizar a busca. Tente novamente.', 'error');
            cepResults.innerHTML = '';
        } finally {
            toggleButtonLoading(submitButton, false);
        }
    }

    // =================================================================================
    // EVENT LISTENERS
    // =================================================================================
    let currentStatusBadge = null;

    const hideStatusMenu = () => {
        if (!statusDropdownMenu.classList.contains('hidden')) {
            statusDropdownMenu.classList.add('hidden');
            document.removeEventListener('click', hideStatusMenu, true);
            currentStatusBadge = null;
        }
    }

    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('w-64');
        sidebar.classList.toggle('w-0');
        document.querySelectorAll('.sidebar-text').forEach(text => text.classList.toggle('hidden'));
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Remove a página de login do DOM em vez de apenas escondê-la.
        // Isso evita que o gerenciador de senhas do navegador seja acionado em outras telas.
        loginPage.remove();
        appMenuView.classList.remove('hidden');
    });
    
    // Função auxiliar para colapsar a sidebar.
    const collapseSidebar = () => {
        // Apenas colapsa se já não estiver colapsada, para evitar que a interface "pisque".
        if (!sidebar.classList.contains('w-0')) {
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-0');
            document.querySelectorAll('.sidebar-text').forEach(text => text.classList.add('hidden'));
        }
    };

    // Função para entrar em uma das aplicações a partir do menu principal.
    // Esta é a única ação que deve colapsar a sidebar por padrão.
    const enterApplication = (viewName, setupFunction = null) => {
        appMenuView.classList.add('hidden');
        appStructure.classList.remove('hidden');
        collapseSidebar();
        
        if (setupFunction) {
            setupFunction();
        }
        navigateTo(viewName);
    };

    appCardDashboard.addEventListener('click', () => enterApplication('dashboard'));
    appCardClients.addEventListener('click', () => enterApplication('clients', populateFilters));
    appCardMap.addEventListener('click', () => enterApplication('map'));
    appCardPdf.addEventListener('click', () => enterApplication('pdf'));
    appCardCep.addEventListener('click', () => enterApplication('cep'));
    appCardSettings.addEventListener('click', () => enterApplication('settings', renderUsersTable));

    navLinks.appMenu.addEventListener('click', (e) => {
        e.preventDefault();
        appStructure.classList.add('hidden');
        appMenuView.classList.remove('hidden');
    });


    Object.keys(navLinks).forEach(key => {
        if (key === 'appMenu') return; 
        navLinks[key].addEventListener('click', (e) => {
            e.preventDefault();
            // A navegação interna não colapsa a sidebar
            navigateTo(key);
            // Adicionado para garantir que a tabela de usuários seja renderizada ao clicar no link da sidebar
            if (key === 'settings') renderUsersTable();
        });
    });
    
    tabActive.addEventListener('click', () => showActiveTab());
    tabArchived.addEventListener('click', () => showArchivedTab());
    
    cepTabByCep.addEventListener('click', showCepByCepTab);
    cepTabByAddress.addEventListener('click', showCepByAddressTab);

    searchInput.addEventListener('input', () => renderClientsTable());
    filterStatus.addEventListener('change', () => renderClientsTable());
    filterCorretor.addEventListener('change', renderClientsTable);
    
    // Adiciona listeners para os novos filtros da aba de arquivados
    searchArchivedInput.addEventListener('input', renderArchivedTable);
    filterArchivedStatus.addEventListener('change', renderArchivedTable);
    filterArchivedCorretor.addEventListener('change', renderArchivedTable);

    orderByProperty.addEventListener('change', () => renderPropertiesList(properties));
    radiusSearchBtn.addEventListener('click', startRadiusSearch);
    radiusClearBtn.addEventListener('click', clearRadiusSearch);

    clientsTableBody.addEventListener('input', async (e) => {
        if (e.target.classList.contains('signature-date-input')) {
            const clientId = parseInt(e.target.dataset.id, 10);
            const dateString = e.target.value; // Ex: "2025-09-05"
            const archiveBtn = e.target.closest('tr').querySelector('.archive-btn');

            // Se a data for apagada, enviamos null. Se não, convertemos para o formato ISO.
            // O 'T12:00:00.000Z' ajuda a evitar problemas de fuso horário (timezone).
            const dateValue = dateString ? new Date(`${dateString}T12:00:00.000Z`).toISOString() : null;

            try {
                // Atualiza a data no backend
                await saveClient({ id: clientId, dataAssinaturaContrato: dateValue });
                showToast('Data de assinatura atualizada.', 'success');
            } catch (error) {
                console.error("Erro ao atualizar data:", error);
                showToast('Falha ao salvar a data.', 'error');
                e.target.value = e.target.dataset.originalValue || ''; // Reverte a mudança na UI
            }

            if (archiveBtn) archiveBtn.disabled = !dateString;
        }
    });

    clientsTableBody.addEventListener('click', async e => {
        const badge = e.target.closest('.status-badge');
        if (badge) {
            e.stopPropagation(); 
            if (currentStatusBadge === badge) {
                hideStatusMenu();
                return;
            }
            currentStatusBadge = badge;
            const clientId = parseInt(badge.dataset.id, 10);
            
            statusDropdownMenu.innerHTML = '';
            STATUS_OPTIONS.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'px-3 py-1.5 hover:bg-gray-100 cursor-pointer';
                item.textContent = opt;
                item.dataset.status = opt;
                item.dataset.clientId = clientId;
                statusDropdownMenu.appendChild(item);
            });

            const rect = badge.getBoundingClientRect();
            statusDropdownMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
            statusDropdownMenu.style.left = `${rect.left + window.scrollX}px`;
            statusDropdownMenu.classList.remove('hidden');

            document.addEventListener('click', hideStatusMenu, true);
        }

        if (e.target.classList.contains('edit-btn')) {
            await openFormModal(parseInt(e.target.dataset.id));
        } else if (e.target.classList.contains('archive-btn')) {
            confirmArchiveBtn.dataset.clientId = parseInt(e.target.dataset.id, 10);
            archiveConfirmModal.classList.remove('hidden');
        } else if (e.target.classList.contains('delete-client-btn')) {
            confirmDeleteClientBtn.dataset.clientId = parseInt(e.target.dataset.id, 10);
            deleteClientConfirmModal.classList.remove('hidden');
        }
    });

    // Adiciona listener para a tabela de arquivados
    archivedTableBody.addEventListener('click', async e => {
        if (e.target.classList.contains('edit-btn')) {
            await openFormModal(parseInt(e.target.dataset.id));
        } else if (e.target.classList.contains('delete-client-btn')) {
            confirmDeleteClientBtn.dataset.clientId = parseInt(e.target.dataset.id, 10);
            deleteClientConfirmModal.classList.remove('hidden');
        } else if (e.target.classList.contains('restore-client-btn')) {
            const clientId = parseInt(e.target.dataset.id, 10);
            try {
                const updatedClient = await saveClient({ id: clientId, status: 'Aprovado' }); // Volta para o status inicial
                logActivity(updatedClient.nome, 'Cliente restaurado para processos ativos');
                showToast('Cliente restaurado com sucesso!', 'success');
                await showArchivedTab(); // Atualiza a tabela de arquivados
            } catch (error) {
                showToast('Falha ao restaurar o cliente.', 'error');
            }
        }
    });

    statusDropdownMenu.addEventListener('click', async e => {
        const target = e.target;
        if (target.dataset.status) {
            const newStatus = target.dataset.status;
            const clientId = parseInt(target.dataset.clientId, 10);
            
            try {
                const updatedClient = await saveClient({ id: clientId, status: newStatus });
                logActivity(updatedClient.nome, `Status alterado para ${newStatus}`);
                showToast(`Status de ${updatedClient.nome} alterado para ${newStatus}.`, 'success');
                
                const originalBadge = document.querySelector(`.status-badge[data-id="${clientId}"]`);
                if(originalBadge) updateStatusBadge(originalBadge, newStatus);
            } catch (error) {
                console.error("Erro ao atualizar status:", error);
                showToast('Falha ao alterar o status.', 'error');
            }
            hideStatusMenu();
        }
    });
    
    usersTableBody.addEventListener('click', async e => {
        if (e.target.classList.contains('edit-user-btn')) {
            await openUserFormModal(parseInt(e.target.dataset.id));
        }
        if (e.target.classList.contains('delete-user-btn')) {
            confirmDeleteUserBtn.dataset.userId = parseInt(e.target.dataset.id, 10);
            deleteUserConfirmModal.classList.remove('hidden');
        }
    });

    addClientBtn.addEventListener('click', () => openFormModal(null));
    closeModalBtn.addEventListener('click', closeFormModal);
    cancelFormBtn.addEventListener('click', closeFormModal);
    clientForm.addEventListener('submit', handleFormSubmit);
    
    // Adiciona máscara de formatação para campos no formulário de cliente
    clientForm.addEventListener('input', (e) => {
        if (e.target.id === 'cpf') {
            e.target.value = formatCPF(e.target.value);
        } else if (e.target.id === 'agencia') {
            e.target.value = e.target.value.replace(/\D/g, '');
        }
    });

    addUserBtn.addEventListener('click', () => openUserFormModal(null));
    closeUserModalBtn.addEventListener('click', closeUserFormModal);
    cancelUserFormBtn.addEventListener('click', closeUserFormModal);
    userForm.addEventListener('submit', handleUserFormSubmit);
    
    addPropertyBtn.addEventListener('click', () => openPropertyFormModal());
    closePropertyModalBtn.addEventListener('click', closePropertyFormModal);
    cancelPropertyFormBtn.addEventListener('click', closePropertyFormModal);
    propertyForm.addEventListener('submit', handlePropertyFormSubmit);
    
    cepInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 5) value = value.replace(/^(\d{5})(\d)/, '$1-$2');
        e.target.value = value;
    });
    cepFormByCep.addEventListener('submit', handleCepSearch);
    cepFormByAddress.addEventListener('submit', handleAddressSearch);

    cancelArchiveBtn.addEventListener('click', () => archiveConfirmModal.classList.add('hidden'));
    confirmArchiveBtn.addEventListener('click', async () => {
        const clientId = parseInt(confirmArchiveBtn.dataset.clientId, 10);
        archiveConfirmModal.classList.add('hidden');

        try {
            const updatedClient = await saveClient({ id: clientId, status: 'Assinado' });
            logActivity(updatedClient.nome, 'Cliente arquivado');
            showToast('Cliente arquivado com sucesso!', 'success');
            await renderClientsTable();
        } catch (error) {
            console.error("Erro ao arquivar cliente:", error);
            showToast('Falha ao arquivar o cliente.', 'error');
        }
    });
    
    cancelDeleteUserBtn.addEventListener('click', () => deleteUserConfirmModal.classList.add('hidden'));
    confirmDeleteUserBtn.addEventListener('click', async () => {
        const userId = parseInt(confirmDeleteUserBtn.dataset.userId, 10);
        deleteUserConfirmModal.classList.add('hidden');
        try {
            await deleteUser(userId);
            showToast('Usuário excluído com sucesso.', 'success');
            await renderUsersTable();
        } catch (error) {
            showToast('Falha ao excluir o usuário.', 'error');
        }
    });

    cancelDeletePropertyBtn.addEventListener('click', () => deletePropertyConfirmModal.classList.add('hidden'));
    confirmDeletePropertyBtn.addEventListener('click', () => {
        const propertyId = parseInt(confirmDeletePropertyBtn.dataset.propertyId, 10);
        properties = properties.filter(p => p.id !== propertyId);
        deletePropertyConfirmModal.classList.add('hidden');
        showToast('Imóvel excluído com sucesso.', 'success');
        renderPropertiesOnMap(properties);
        renderPropertiesList(properties);
    });

    cancelDeleteClientBtn.addEventListener('click', () => deleteClientConfirmModal.classList.add('hidden'));
    confirmDeleteClientBtn.addEventListener('click', async () => {
        const clientId = parseInt(confirmDeleteClientBtn.dataset.clientId, 10);
        deleteClientConfirmModal.classList.add('hidden');
        try {
            await deleteClient(clientId);
            showToast('Cliente excluído com sucesso.', 'success');
            await renderClientsTable();
        } catch (error) {
            console.error("Erro ao excluir cliente:", error);
            showToast('Falha ao excluir o cliente.', 'error');
        }
    });

    // Event Listeners do Editor de PDF
    pdfFileInputReplace.addEventListener('change', (e) => handlePdfFileSelection(e, false));
    pdfFileInputAppend.addEventListener('change', (e) => handlePdfFileSelection(e, true));
    addMorePdfBtn.addEventListener('click', () => pdfFileInputAppend.click());
    clearPdfBtn.addEventListener('click', clearAllPdfPages);
    savePdfBtn.addEventListener('click', saveMergedPdf);
});