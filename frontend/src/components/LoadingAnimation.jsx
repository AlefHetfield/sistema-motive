import { useEffect, useState } from 'react';

/**
 * Componente de loading animado baseado no formato do logo
 * Apresenta barras diagonais animadas que simulam o design do logo
 */
const LoadingAnimation = ({ 
  size = 'md', 
  message = 'Carregando...', 
  fullScreen = false,
  showMessage = true 
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tamanhos predefinidos
  const sizes = {
    sm: { container: 60, bar: 40, thickness: 6 },
    md: { container: 100, bar: 70, thickness: 10 },
    lg: { container: 140, bar: 100, thickness: 14 },
    xl: { container: 180, bar: 130, thickness: 18 }
  };

  const dimensions = sizes[size] || sizes.md;

  const containerClass = fullScreen 
    ? 'fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 z-50'
    : 'flex items-center justify-center';

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center gap-6">
        {/* Container da animação */}
        <div 
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl"
          style={{ 
            width: dimensions.container,
            height: dimensions.container,
            transform: mounted ? 'scale(1)' : 'scale(0.8)',
            opacity: mounted ? 1 : 0,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          {/* Barra 1 - Azul claro */}
          <div
            className="absolute animate-slide-diagonal-1"
            style={{
              width: dimensions.bar,
              height: dimensions.thickness,
              background: 'linear-gradient(135deg, #5B8FB9 0%, #7BA5C7 100%)',
              transform: 'rotate(-45deg)',
              transformOrigin: 'center',
              left: '50%',
              top: '25%',
              marginLeft: `-${dimensions.bar / 2}px`,
              boxShadow: '0 4px 12px rgba(91, 143, 185, 0.4)',
              borderRadius: '999px'
            }}
          />

          {/* Barra 2 - Azul médio */}
          <div
            className="absolute animate-slide-diagonal-2"
            style={{
              width: dimensions.bar,
              height: dimensions.thickness,
              background: 'linear-gradient(135deg, #4A7BA7 0%, #5B8FB9 100%)',
              transform: 'rotate(-45deg)',
              transformOrigin: 'center',
              left: '50%',
              top: '50%',
              marginLeft: `-${dimensions.bar / 2}px`,
              boxShadow: '0 4px 12px rgba(74, 123, 167, 0.4)',
              borderRadius: '999px'
            }}
          />

          {/* Barra 3 - Azul escuro */}
          <div
            className="absolute animate-slide-diagonal-3"
            style={{
              width: dimensions.bar,
              height: dimensions.thickness,
              background: 'linear-gradient(135deg, #3D5A73 0%, #4A7BA7 100%)',
              transform: 'rotate(-45deg)',
              transformOrigin: 'center',
              left: '50%',
              top: '75%',
              marginLeft: `-${dimensions.bar / 2}px`,
              boxShadow: '0 4px 12px rgba(61, 90, 115, 0.4)',
              borderRadius: '999px'
            }}
          />

          {/* Efeito de brilho */}
          <div 
            className="absolute inset-0 animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
              transform: 'translateX(-100%)',
            }}
          />
        </div>

        {/* Mensagem de loading */}
        {showMessage && (
          <div 
            className="text-center"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(10px)',
              transition: 'all 0.5s ease-out 0.2s'
            }}
          >
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200 animate-pulse">
              {message}
            </p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-diagonal-1 {
          0%, 100% {
            transform: rotate(-45deg) translateX(-120%);
            opacity: 0;
          }
          10%, 90% {
            opacity: 1;
          }
          50% {
            transform: rotate(-45deg) translateX(0%);
            opacity: 1;
          }
        }

        @keyframes slide-diagonal-2 {
          0%, 100% {
            transform: rotate(-45deg) translateX(-120%);
            opacity: 0;
          }
          10%, 90% {
            opacity: 1;
          }
          50% {
            transform: rotate(-45deg) translateX(0%);
            opacity: 1;
          }
        }

        @keyframes slide-diagonal-3 {
          0%, 100% {
            transform: rotate(-45deg) translateX(-120%);
            opacity: 0;
          }
          10%, 90% {
            opacity: 1;
          }
          50% {
            transform: rotate(-45deg) translateX(0%);
            opacity: 1;
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }

        .animate-slide-diagonal-1 {
          animation: slide-diagonal-1 2s ease-in-out infinite;
        }

        .animate-slide-diagonal-2 {
          animation: slide-diagonal-2 2s ease-in-out infinite 0.2s;
        }

        .animate-slide-diagonal-3 {
          animation: slide-diagonal-3 2s ease-in-out infinite 0.4s;
        }

        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingAnimation;
