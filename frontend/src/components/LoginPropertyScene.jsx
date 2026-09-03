import { useRef } from 'react';
import { Building2, Calculator, MapPin, Users } from 'lucide-react';
import logoLight from '../assets/logo-light.png';

const metricItems = [
  { icon: <Users className="h-4 w-4 text-[#8fb5d1]" />, label: 'Clientes', detail: 'Jornada organizada' },
  { icon: <Calculator className="h-4 w-4 text-[#8fb5d1]" />, label: 'Simulações', detail: 'Decisões mais rápidas' },
  { icon: <Building2 className="h-4 w-4 text-[#8fb5d1]" />, label: 'Imóveis', detail: 'Portfólio no mapa' },
];

export default function LoginPropertyScene({ emailFocused, passwordFocused, showPassword, isSubmitting, loginSucceeded }) {
  const sceneRef = useRef(null);
  const shuttersClosed = passwordFocused && !showPassword;

  const moveScene = event => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    sceneRef.current?.style.setProperty('--scene-x', x.toFixed(3));
    sceneRef.current?.style.setProperty('--scene-y', y.toFixed(3));
  };

  const resetScene = () => {
    sceneRef.current?.style.setProperty('--scene-x', '0');
    sceneRef.current?.style.setProperty('--scene-y', '0');
  };

  return (
    <section
      ref={sceneRef}
      onPointerMove={moveScene}
      onPointerLeave={resetScene}
      style={{ '--scene-x': 0, '--scene-y': 0 }}
      className="relative hidden min-h-screen overflow-hidden bg-[#2d3944] px-10 py-9 text-white lg:flex lg:flex-col xl:px-14"
    >
      <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-[#6f9abd]/20 blur-3xl" />
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between">
        <img src={logoLight} alt="Motive Consultoria Imobiliária" className="h-auto w-40 xl:w-44" />
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Gestão imobiliária</span>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-8">
        <div className="max-w-xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#8fb5d1]">Tudo em um só lugar</p>
          <h1 className="text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">Sua operação imobiliária, mais clara e conectada.</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/60 xl:text-base xl:leading-7">Acompanhe clientes, simulações, contratos e imóveis em uma experiência feita para a rotina da Motive.</p>
        </div>

        <div className="relative mt-7 h-[300px] overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20 xl:h-[340px]">
          <svg viewBox="0 0 660 360" aria-hidden="true" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="login-sky" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#435461" />
                <stop offset="1" stopColor="#26333d" />
              </linearGradient>
              <linearGradient id="login-house" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f8fafc" />
                <stop offset="1" stopColor="#dbe5eb" />
              </linearGradient>
              <filter id="door-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>
            <rect width="660" height="360" fill="url(#login-sky)" />

            <g opacity="0.13" fill="none" stroke="#d9e8f2" strokeWidth="1.3">
              <path d="M-20 63C80 40 143 81 232 59s145-17 226 3 146 16 226-9" />
              <path d="M-10 112c75-29 139-7 210 8s139 21 218-13 161-22 249 7" />
              <path d="M50-20c15 80 5 132-21 192s-3 126 35 201" />
              <path d="M154-20c-5 70 18 114 47 165s29 116 10 235" />
              <path d="M505-20c-30 80-20 139 18 185s54 111 47 215" />
              <path d="M598-20c-17 77 4 130 25 178s15 116-5 216" />
              <path d="M8 255c93-22 155 9 222 24s136 18 211-9 145-25 227 5" />
            </g>

            <g style={{ transform: 'translate(calc(var(--scene-x) * -7px), calc(var(--scene-y) * -5px))' }} className="transition-transform duration-300 ease-out motion-reduce:transition-none">
              <path d="M0 312h660v48H0z" fill="#21303a" />
              <path d="M0 315c124-21 189-13 282 2s187 20 378-11v54H0z" fill="#31424d" />

              <g opacity="0.7">
                <rect x="78" y="169" width="92" height="144" rx="4" fill="#51636f" />
                <rect x="92" y="190" width="16" height="19" rx="2" fill="#89a8bc" opacity="0.45" />
                <rect x="119" y="190" width="16" height="19" rx="2" fill="#89a8bc" opacity="0.75" />
                <rect x="146" y="190" width="12" height="19" rx="2" fill="#89a8bc" opacity="0.4" />
                <rect x="92" y="224" width="16" height="19" rx="2" fill="#89a8bc" opacity="0.7" />
                <rect x="119" y="224" width="16" height="19" rx="2" fill="#89a8bc" opacity="0.35" />
                <rect x="146" y="224" width="12" height="19" rx="2" fill="#89a8bc" opacity="0.65" />
              </g>

              <g>
                <path d="M232 182 362 88l130 94v132H232z" fill="url(#login-house)" />
                <path d="m211 188 151-110 151 110-17 21-134-96-134 96z" fill="#6f91aa" />
                <path d="M262 210h69v61h-69zM393 210h69v61h-69z" fill="#7698ae" />
                <path d="M272 220h49v41h-49zM403 220h49v41h-49z" fill="#a9d1e5" />
                <g
                  style={{ transform: `scaleY(${shuttersClosed ? 1 : 0})`, transformOrigin: '362px 241px' }}
                  className="transition-transform duration-500 ease-in-out motion-reduce:transition-none"
                  fill="#455865"
                >
                  <rect x="272" y="220" width="49" height="41" rx="2" />
                  <rect x="403" y="220" width="49" height="41" rx="2" />
                </g>
                <g opacity={shuttersClosed ? 0 : 0.45} style={{ transform: 'translate(calc(var(--scene-x) * 5px), calc(var(--scene-y) * 3px))' }} className="transition-all duration-300 ease-out motion-reduce:transition-none">
                  <path d="m276 224 18 0-16 33h-5zM407 224h18l-16 33h-5z" fill="#fff" />
                </g>
                <g style={{ transform: `scaleX(${loginSucceeded ? 0.14 : 1})`, transformOrigin: '382px 269px' }} className="transition-transform duration-700 ease-in-out motion-reduce:transition-none">
                  <rect x="343" y="224" width="39" height="90" rx="4" fill={loginSucceeded ? '#43b88a' : isSubmitting ? '#587a93' : '#40525f'} className="transition-colors duration-500" />
                  <circle cx="373" cy="270" r="2.5" fill="#d8e4ea" />
                </g>
                {(isSubmitting || loginSucceeded) && <rect x="350" y="234" width="25" height="69" rx="8" fill={loginSucceeded ? '#58d5a7' : '#8fb5d1'} opacity="0.45" filter="url(#door-glow)" />}
                <path d="M211 314h302" stroke="#9bb2c1" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
              </g>
            </g>
          </svg>

          <div
            style={{ transform: 'translate(calc(var(--scene-x) * 18px), calc(var(--scene-y) * 13px))' }}
            className={`absolute top-[17%] transition-[left,transform] duration-500 ease-out motion-reduce:transition-none ${emailFocused ? 'left-[53%]' : 'left-[70%]'}`}
          >
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#69a2c8] text-white shadow-[0_12px_30px_rgba(0,0,0,0.32)] ring-4 ring-white/15">
              <MapPin className="h-6 w-6" />
              <span className="absolute -bottom-3 h-3 w-5 rounded-full bg-black/25 blur-sm" />
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[#283640]/85 px-4 py-3 text-xs text-white/65 backdrop-blur">
            <span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" />Sistema Motive</span>
            <span className="font-semibold text-white/80">Encontre. Acompanhe. Conclua.</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {metricItems.map(({ icon, label, detail }) => <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3.5">{icon}<p className="mt-2 text-xs font-bold text-white/90">{label}</p><p className="mt-0.5 text-[10px] leading-4 text-white/40">{detail}</p></div>)}
        </div>
      </div>

      <p className="relative z-10 text-xs text-white/35">Motive Consultoria Imobiliária</p>
    </section>
  );
}
