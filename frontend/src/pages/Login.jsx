import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, TriangleAlert } from 'lucide-react';
import ModernInput from '../components/ModernInput';
import LoadingAnimation from '../components/LoadingAnimation';
import LoadingSpinner from '../components/LoadingSpinner';
import LoginPropertyScene from '../components/LoginPropertyScene';
import { controlClass, formLabelClass } from '../components/ui/styles';
import { usePerformanceMonitor } from '../hooks/usePerformance';
import logoDark from '../assets/logo-dark.png';
import { toast } from 'sonner';

const Login = () => {
    const [email, setEmail] = useState(() => {
        try {
            return localStorage.getItem('motive:last-login-email') || '';
        } catch {
            return '';
        }
    });
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginSucceeded, setLoginSucceeded] = useState(false);
    const [loginTransitionActive, setLoginTransitionActive] = useState(false);
    const cardRef = useRef(null);
    const { login, isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    // Monitora performance da página
    usePerformanceMonitor('LoginPage');

    const animateLoginError = () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        cardRef.current?.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-7px)' },
            { transform: 'translateX(6px)' },
            { transform: 'translateX(-4px)' },
            { transform: 'translateX(3px)' },
            { transform: 'translateX(0)' },
        ], { duration: 360, easing: 'ease-out' });
    };

    const updateCapsLock = event => setCapsLockOn(event.getModifierState('CapsLock'));

    const changeEmail = event => {
        setEmail(event.target.value);
        setEmailError('');
        setError('');
    };

    const changePassword = event => {
        setPassword(event.target.value);
        setPasswordError('');
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const normalizedEmail = email.trim();
        const nextEmailError = !normalizedEmail
            ? 'Informe seu e-mail.'
            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
                ? 'Digite um e-mail válido.'
                : '';
        const nextPasswordError = password ? '' : 'Informe sua senha.';

        setEmailError(nextEmailError);
        setPasswordError(nextPasswordError);
        setError('');
        if (nextEmailError || nextPasswordError) {
            animateLoginError();
            return;
        }

        setIsSubmitting(true);
        setLoginTransitionActive(true);

        try {
            const result = await login(normalizedEmail, password);
            
            if (result.success) {
                try {
                    localStorage.setItem('motive:last-login-email', normalizedEmail);
                } catch {
                    // O acesso continua normalmente caso o navegador bloqueie o armazenamento local.
                }
                setLoginSucceeded(true);
                await new Promise(resolve => setTimeout(resolve, 700));
                navigate('/dashboard');
            } else {
                setLoginTransitionActive(false);
                const message = result.error || 'Credenciais inválidas. Tente novamente.';
                if (/servidor|conectar|conex[aã]o/i.test(message)) setError(message);
                else setPasswordError('E-mail ou senha incorretos. Confira os dados e tente novamente.');
                animateLoginError();
            }
        } catch (err) {
            setLoginTransitionActive(false);
            setError('Ocorreu um erro ao tentar fazer login.');
            animateLoginError();
            console.error('Erro no login:', err);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Se já estiver autenticado, redireciona
    if (isAuthenticated && !loginTransitionActive) {
        return <Navigate to="/dashboard" replace />;
    }

    // Mostra loading inicial enquanto verifica autenticação
    if (isLoading) {
        return <LoadingAnimation fullScreen size="lg" message="Verificando autenticação..." />;
    }

    return (
        <main id="login-page" className="min-h-screen bg-[#f3f6f8] lg:grid lg:grid-cols-[minmax(520px,0.96fr)_minmax(480px,1.04fr)]">
            <LoginPropertyScene emailFocused={emailFocused} passwordFocused={passwordFocused} showPassword={showPassword} isSubmitting={isSubmitting} loginSucceeded={loginSucceeded} />
            <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-8 lg:min-h-0">
                <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
                <div className="absolute -bottom-36 -left-36 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" />
                <div className="relative w-full max-w-md animate-fade-in">
                  <div ref={cardRef} className="rounded-[28px] border border-white bg-white/95 p-6 shadow-[0_24px_70px_rgba(52,62,72,0.12)] backdrop-blur sm:p-8">
                    {/* Logo e Header */}
                    <div className="mb-8 text-center">
                        <div className="mb-5 inline-block rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 p-3 lg:hidden">
                            <img 
                                src={logoDark} 
                                alt="Logo Motive" 
                                className="w-32 h-auto"
                            />
                        </div>
                        <p className="mb-2 hidden text-xs font-bold uppercase tracking-[0.18em] text-primary lg:block">Área segura</p>
                        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">
                            Bem-vindo de volta
                        </h1>
                        <p className="text-sm leading-6 text-gray-500">
                            Acesse sua área de gestão imobiliária.
                        </p>
                    </div>

                    {/* Formulário */}
                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        {/* Email */}
                        <div>
                            <ModernInput
                                label="Email"
                                type="email"
                                value={email}
                                onChange={changeEmail}
                                onFocus={() => setEmailFocused(true)}
                                onBlur={() => setEmailFocused(false)}
                                placeholder="seu@email.com"
                                Icon={Mail}
                                required
                                disabled={isSubmitting}
                                autoComplete="email"
                                aria-invalid={Boolean(emailError)}
                                aria-describedby={emailError ? 'login-email-error' : undefined}
                                inputClassName={emailError ? '!border-red-300 focus:!border-red-400 focus:!ring-red-100' : ''}
                            />
                            {emailError && <p id="login-email-error" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600"><AlertCircle size={13} />{emailError}</p>}
                        </div>

                        {/* Senha */}
                        <div>
                            <label className={formLabelClass}>
                                Senha
                            </label>
                            <div className="group relative">
                                <div className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-gray-400 transition-colors group-focus-within:text-primary">
                                    <Lock size={16} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={changePassword}
                                    required
                                    disabled={isSubmitting}
                                    autoComplete="current-password"
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => { setPasswordFocused(false); setCapsLockOn(false); }}
                                    onKeyDown={updateCapsLock}
                                    onKeyUp={updateCapsLock}
                                    aria-invalid={Boolean(passwordError)}
                                    aria-describedby={passwordError ? 'login-password-error' : capsLockOn ? 'login-caps-lock' : undefined}
                                    className={`${controlClass} pl-10 pr-12 ${passwordError ? '!border-red-300 focus:!border-red-400 focus:!ring-red-100' : ''}`}
                                    placeholder="Digite sua senha"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={isSubmitting}
                                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95 group-focus-within:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {passwordError && <p id="login-password-error" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-5 text-red-600"><AlertCircle size={13} className="mt-0.5 shrink-0" />{passwordError}</p>}
                            {capsLockOn && !passwordError && <p id="login-caps-lock" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600"><TriangleAlert size={13} />Caps Lock está ativado.</p>}
                            <div className="mt-2 text-right">
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => toast.info('Contate o administrador do sistema para redefinir sua senha.')}
                                    className="text-xs font-medium text-primary transition-colors underline-offset-4 hover:text-secondary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Esqueci minha senha
                                </button>
                            </div>
                        </div>

                        {/* Mensagem de Erro */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 
                                          rounded-xl text-red-700 text-sm animate-fade-in">
                                <AlertCircle size={16} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Botão de Login */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full min-h-[52px] py-3 px-4 bg-gradient-to-r from-primary to-secondary
                                     text-white font-medium rounded-xl shadow-md
                                     hover:shadow-xl hover:-translate-y-0.5
                                     active:translate-y-0 active:scale-[0.99]
                                     disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md
                                     transition-[transform,box-shadow] duration-200 flex items-center justify-center"
                        >
                            <span className="inline-flex items-center justify-center gap-2 min-w-[170px] transition-opacity duration-200">
                                {loginSucceeded ? (
                                    <>
                                        <CheckCircle2 size={18} />
                                        <span>Acesso autorizado</span>
                                    </>
                                ) : isSubmitting ? (
                                    <>
                                        <LoadingSpinner size={18} />
                                        <span>Entrando...</span>
                                    </>
                                ) : (
                                    'Entrar no sistema'
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-gray-400">
                        <Lock size={12} /> Ambiente protegido
                    </div>
                  </div>
                  <p className="mt-5 text-center text-xs text-gray-400">Motive Consultoria Imobiliária</p>
                </div>
            </section>
        </main>
    );
};

export default Login;
