import { useState } from 'react';
import { Search, MapPin, Navigation, Building2, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ModernInput } from '../components/ModernInput';
import LoadingSpinner from '../components/LoadingSpinner';

const CepResultCard = ({ result, index }) => (
    <div 
        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:border-primary/30 animate-fade-in"
        style={{ animationDelay: `${index * 100}ms` }}
    >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Mail size={18} className="text-primary" />
                </div>
                <div>
                    <p className="text-xs text-gray-500 mb-1">CEP</p>
                    <p className="font-semibold text-gray-800">{result.cep}</p>
                </div>
            </div>
            
            <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                    <Navigation size={18} className="text-blue-600" />
                </div>
                <div>
                    <p className="text-xs text-gray-500 mb-1">Logradouro</p>
                    <p className="font-semibold text-gray-800">{result.logradouro || 'Não informado'}</p>
                </div>
            </div>
            
            <div className="flex items-start gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                    <Building2 size={18} className="text-green-600" />
                </div>
                <div>
                    <p className="text-xs text-gray-500 mb-1">Bairro</p>
                    <p className="font-semibold text-gray-800">{result.bairro || 'Não informado'}</p>
                </div>
            </div>
            
            <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                    <MapPin size={18} className="text-purple-600" />
                </div>
                <div>
                    <p className="text-xs text-gray-500 mb-1">Cidade / Estado</p>
                    <p className="font-semibold text-gray-800">{result.localidade} - {result.uf}</p>
                </div>
            </div>
        </div>
    </div>
);

const CepSearch = () => {
    const [activeTab, setActiveTab] = useState('byCep');
    const [cepInput, setCepInput] = useState('');
    const [addressInput, setAddressInput] = useState({ state: '', city: '', street: '' });
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCepMask = (value) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .substring(0, 9);
    };

    const handleSearchByCep = async (e) => {
        e.preventDefault();
        const cep = cepInput.replace(/\D/g, '');
        if (cep.length !== 8) {
            setError('CEP inválido. Por favor, digite 8 números.');
            return;
        }
        
        setIsLoading(true);
        setError('');
        setResults([]);

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (!response.ok) throw new Error('Falha na comunicação com a API.');
            const data = await response.json();
            if (data.erro) {
                setError('CEP não encontrado.');
            } else {
                setResults([data]);
            }
        } catch (err) {
            setError(err.message || 'Não foi possível realizar a busca. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchByAddress = async (e) => {
        e.preventDefault();
        const { state, city, street } = addressInput;
        if (!state || !city || street.length < 3) {
            setError('Preencha todos os campos. A rua deve ter no mínimo 3 caracteres.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResults([]);

        try {
            const response = await fetch(`https://viacep.com.br/ws/${state}/${city}/${street}/json/`);
            if (!response.ok) throw new Error('Falha na comunicação com a API.');
            const data = await response.json();
            if (data.length === 0) {
                setError('Nenhum endereço encontrado para os termos informados.');
            } else {
                setResults(data);
            }
        } catch (err) {
            setError(err.message || 'Não foi possível realizar a busca. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => { setActiveTab(id); setResults([]); setError(''); setCepInput(''); setAddressInput({ state: '', city: '', street: '' }); }}
            className={`group relative whitespace-nowrap py-4 px-6 font-medium text-sm transition-all duration-300 rounded-t-2xl ${
                activeTab === id
                ? 'text-primary bg-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
            <span className="flex items-center gap-2">
                <Icon size={16} />
                {label}
            </span>
            {activeTab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
            )}
        </button>
    );

    const SkeletonCard = () => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <div className="p-2 bg-gray-200 rounded-lg w-10 h-10"></div>
                        <div className="flex-1">
                            <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
                            <div className="h-4 bg-gray-300 rounded w-32"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div id="cep-view" className="fade-in max-w-5xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Busca de CEP</h2>
                <p className="text-gray-500">Encontre endereços completos por CEP ou localize CEPs por endereço</p>
            </div>

            {/* Tabs Navigation */}
            <div className="bg-gray-50 p-1 rounded-2xl mb-6 inline-flex gap-2">
                <TabButton id="byCep" label="Buscar por CEP" icon={Mail} />
                <TabButton id="byAddress" label="Buscar por Endereço" icon={MapPin} />
            </div>

            {activeTab === 'byCep' && (
                <div id="cep-content-by-cep" className="animate-fade-in">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <form onSubmit={handleSearchByCep} className="flex flex-col sm:flex-row items-end gap-4">
                            <div className="flex-grow w-full sm:w-auto">
                                <ModernInput
                                    id="cep-input"
                                    label="Digite o CEP"
                                    Icon={Mail}
                                    type="text"
                                    placeholder="00000-000"
                                    value={cepInput}
                                    onChange={(e) => setCepInput(handleCepMask(e.target.value))}
                                    disabled={isLoading}
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={isLoading || cepInput.length < 9} 
                                className="py-2.5 px-8 bg-primary hover:bg-primary/90 text-white font-medium rounded-2xl w-full sm:w-auto flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                                >
                                {isLoading ? (
                                    <>
                                        <LoadingSpinner size={18} />
                                        Buscando...
                                    </>
                                ) : (
                                    <>
                                        <Search size={18} />
                                        Buscar
                                    </>
                                )}
                                </button>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'byAddress' && (
                 <div id="cep-content-by-address" className="animate-fade-in">
                     <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <form onSubmit={handleSearchByAddress}>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <ModernInput
                                    id="cep-state"
                                    label="Estado (UF)"
                                    Icon={MapPin}
                                    type="text"
                                    placeholder="SP"
                                    value={addressInput.state}
                                    onChange={(e) => setAddressInput({...addressInput, state: e.target.value.toUpperCase()})}
                                    maxLength={2}
                                    required
                                    disabled={isLoading}
                                />
                                
                                <ModernInput
                                    id="cep-city"
                                    label="Cidade"
                                    Icon={Building2}
                                    type="text"
                                    placeholder="São Paulo"
                                    value={addressInput.city}
                                    onChange={(e) => setAddressInput({...addressInput, city: e.target.value})}
                                    required
                                    disabled={isLoading}
                                />
                                
                                <ModernInput
                                    id="cep-street"
                                    label="Rua / Logradouro"
                                    Icon={Navigation}
                                    type="text"
                                    placeholder="Av. Paulista"
                                    value={addressInput.street}
                                    onChange={(e) => setAddressInput({...addressInput, street: e.target.value})}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="mt-6 flex justify-end">
                                 <button 
                                    type="submit" 
                                    disabled={isLoading || !addressInput.state || !addressInput.city || addressInput.street.length < 3} 
                                    className="py-2.5 px-8 bg-primary hover:bg-primary/90 text-white font-medium rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                                >
                                    {isLoading ? (
                                        <>
                                            <LoadingSpinner size={18} />
                                            Buscando...
                                        </>
                                    ) : (
                                        <>
                                            <Search size={18} />
                                            Buscar
                                        </>
                                    )}
                                 </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div id="cep-results" className="mt-8">
                {isLoading && (
                    <div className="space-y-4">
                        <SkeletonCard />
                        {activeTab === 'byAddress' && (
                            <>
                                <SkeletonCard />
                                <SkeletonCard />
                            </>
                        )}
                    </div>
                )}
                
                {error && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 p-5 rounded-2xl shadow-sm animate-fade-in" role="alert">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="font-semibold text-amber-800 mb-1">Atenção</p>
                                <p className="text-amber-700 text-sm">{error}</p>
                            </div>
                        </div>
                    </div>
                )}
                
                {results.length > 0 && !isLoading && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle2 className="text-green-600" size={20} />
                            <p className="text-sm font-medium text-gray-700">
                                {results.length === 1 ? 'Endereço encontrado' : `${results.length} endereços encontrados`}
                            </p>
                        </div>
                        {results.map((result, index) => <CepResultCard key={result.cep + index} result={result} index={index} />)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CepSearch;
