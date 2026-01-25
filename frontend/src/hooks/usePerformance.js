import { useEffect } from 'react';

/**
 * Hook para medir e logar performance de operações
 * Útil para debugar gargalos de performance
 * 
 * Uso:
 * usePerformanceMonitor('LoginPage');
 */
export const usePerformanceMonitor = (componentName = 'Component') => {
  useEffect(() => {
    // Mede o tempo de render
    const startTime = performance.now();
    const markName = `${componentName}-render`;
    
    performance.mark(`${markName}-start`);
    
    return () => {
      performance.mark(`${markName}-end`);
      
      try {
        performance.measure(markName, `${markName}-start`, `${markName}-end`);
        const measure = performance.getEntriesByName(markName)[0];
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`📊 [${componentName}] Render time: ${measure.duration.toFixed(2)}ms`);
        }
      } catch (e) {
        // Ignorar erros de performance API
      }
    };
  }, [componentName]);
};

/**
 * Hook para medir tempo de requisições HTTP
 * 
 * Uso:
 * const { measureFetch } = useRequestPerformance();
 * const response = await measureFetch('/api/login', {...});
 */
export const useRequestPerformance = () => {
  const measureFetch = async (url, options = {}) => {
    const startTime = performance.now();
    const requestId = `request-${Date.now()}`;
    
    try {
      const response = await fetch(url, options);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏱️ [${url}] Time: ${duration.toFixed(2)}ms | Status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`❌ [${url}] Failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  };
  
  return { measureFetch };
};

/**
 * Hook para monitorar Web Vitals nativos do navegador
 * 
 * Uso:
 * useWebVitals();
 */
export const useWebVitals = () => {
  useEffect(() => {
    // Usa Web Performance API nativa do navegador
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        // Monitora Largest Contentful Paint (LCP)
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (process.env.NODE_ENV === 'development') {
            console.log(`📊 [LCP] ${lastEntry.renderTime || lastEntry.loadTime}ms`);
          }
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        
        return () => observer.disconnect();
      } catch (e) {
        console.debug('PerformanceObserver não disponível');
      }
    }
  }, []);
};
