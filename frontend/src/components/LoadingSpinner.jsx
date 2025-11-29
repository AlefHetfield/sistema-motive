/**
 * Spinner compacto baseado no logo para uso inline
 * Ideal para botões e elementos menores
 */
const LoadingSpinner = ({ size = 24, className = '' }) => {
  return (
    <div 
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 animate-spin-slow">
        {/* Barra 1 */}
        <div
          className="absolute"
          style={{
            width: '70%',
            height: '15%',
            background: 'linear-gradient(135deg, #5B8FB9 0%, #7BA5C7 100%)',
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
            left: '15%',
            top: '20%',
            borderRadius: '999px',
            boxShadow: '0 2px 6px rgba(91, 143, 185, 0.4)'
          }}
        />
        
        {/* Barra 2 */}
        <div
          className="absolute"
          style={{
            width: '70%',
            height: '15%',
            background: 'linear-gradient(135deg, #4A7BA7 0%, #5B8FB9 100%)',
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
            left: '15%',
            top: '42.5%',
            borderRadius: '999px',
            boxShadow: '0 2px 6px rgba(74, 123, 167, 0.4)'
          }}
        />
        
        {/* Barra 3 */}
        <div
          className="absolute"
          style={{
            width: '70%',
            height: '15%',
            background: 'linear-gradient(135deg, #3D5A73 0%, #4A7BA7 100%)',
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
            left: '15%',
            top: '65%',
            borderRadius: '999px',
            boxShadow: '0 2px 6px rgba(61, 90, 115, 0.4)'
          }}
        />
      </div>

      <style>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin-slow {
          animation: spin-slow 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
