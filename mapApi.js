let isGoogleMapsScriptRequested = false;

const googleMapsApiReady = new Promise(resolve => {
    window.initMap = () => resolve();
});

/**
 * Carrega o script da API do Google Maps sob demanda.
 * A função é idempotente, ou seja, só adiciona o script uma vez.
 */
export function loadGoogleMapsScript() {
    if (isGoogleMapsScriptRequested) {
        return;
    }
    isGoogleMapsScriptRequested = true;

    if (typeof GOOGLE_MAPS_API_KEY === 'undefined' || !GOOGLE_MAPS_API_KEY) {
        console.error("Chave da API do Google Maps não foi encontrada. Verifique se o arquivo 'js/config.js' existe e está configurado corretamente.");
        // Idealmente, você teria uma função de toast global acessível aqui.
        // Por enquanto, vamos manter o console.error.
        return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=marker`;
    script.async = true;
    script.onerror = () => console.error('Falha ao carregar a API do Google Maps.');
    document.head.appendChild(script);
}

/**
 * Aguarda a API do Google Maps estar pronta e inicializa o mapa.
 * @param {HTMLElement} mapElement - O elemento DOM onde o mapa será renderizado.
 * @param {object} options - Opções de configuração do mapa (zoom, center, etc.).
 * @returns {Promise<{map: google.maps.Map, geocoder: google.maps.Geocoder}>}
 */
export async function initializeMap(mapElement, options) {
    await googleMapsApiReady;
    const map = new google.maps.Map(mapElement, options);
    const geocoder = new google.maps.Geocoder();
    return { map, geocoder };
}

/**
 * Busca coordenadas para um endereço usando o Geocoder.
 * @param {google.maps.Geocoder} geocoder - A instância do Geocoder.
 * @param {string} address - O endereço para geocodificar.
 * @returns {Promise<google.maps.LatLng>}
 */
export async function geocodeAddress(geocoder, address) {
    const { results, status } = await geocoder.geocode({ address });
    if (status !== 'OK' || !results[0]) {
        throw new Error('Endereço não encontrado ou falha na geocodificação.');
    }
    return results[0].geometry.location;
}