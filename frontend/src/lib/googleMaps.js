const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
let loaderPromise;

export const googleMapsIsConfigured = Boolean(GOOGLE_MAPS_KEY);

export function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('O mapa só pode ser carregado no navegador.'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Configure VITE_GOOGLE_MAPS_API_KEY para exibir o mapa.'));
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const callbackName = '__motiveGoogleMapsReady';
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };
    const script = document.createElement('script');
    const query = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      callback: callbackName,
      libraries: 'marker,places',
      loading: 'async',
      language: 'pt-BR',
      region: 'BR',
      v: 'weekly',
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${query}`;
    script.async = true;
    script.onerror = () => {
      delete window[callbackName];
      loaderPromise = null;
      reject(new Error('Não foi possível carregar o Google Maps.'));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}
