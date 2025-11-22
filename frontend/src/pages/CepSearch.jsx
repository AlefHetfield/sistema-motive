import { useState } from 'react';
import { Search } from 'lucide-react';

const CepResultCard = ({ result }) => (
    <div className="bg-surface p-4 rounded-lg shadow-sm border">
        <p><strong>CEP:</strong> {result.cep}</p>
        <p><strong>Logradouro:</strong> {result.logradouro}</p>
        <p><strong>Bairro:</strong> {result.bairro}</p>
        <p><strong>Cidade:</strong> {result.localidade}</p>
        <p><strong>Estado:</strong> {result.uf}</p>
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
    
    const TabButton = ({ id, label }) => (
        <button
            onClick={() => { setActiveTab(id); setResults([]); setError(''); }}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div id="cep-view" className="fade-in max-w-4xl mx-auto p-6">
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <TabButton id="byCep" label="Buscar por CEP" />
                    <TabButton id="byAddress" label="Buscar por Endereço" />
                </nav>
            </div>

            {activeTab === 'byCep' && (
                <div id="cep-content-by-cep">
                    <div className="bg-surface p-6 rounded-lg shadow-md">
                        <form onSubmit={handleSearchByCep} className="flex flex-col sm:flex-row items-end gap-4">
                            <div className="flex-grow w-full sm:w-auto">
                                <label htmlFor="cep-input" className="block text-sm font-medium text-gray-700">Digite o CEP</label>
                                <input
                                    type="text"
                                    id="cep-input"
                                    className="form-input mt-1 block w-full"
                                    placeholder="00000-000"
                                    value={cepInput}
                                    onChange={(e) => setCepInput(handleCepMask(e.target.value))}
                                />
                            </div>
                            <button type="submit" disabled={isLoading} className="py-2 px-6 btn-primary rounded-md w-full sm:w-auto flex items-center justify-center gap-2">
                                <Search size={18} /> {isLoading ? 'Buscando...' : 'Buscar'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'byAddress' && (
                 <div id="cep-content-by-address">
                     <div className="bg-surface p-6 rounded-lg shadow-md">
                        <form onSubmit={handleSearchByAddress}>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label htmlFor="cep-state" className="block text-sm font-medium text-gray-700">Estado (UF)</label>
                                    <input type="text" id="cep-state" value={addressInput.state} onChange={(e) => setAddressInput({...addressInput, state: e.target.value.toUpperCase()})} className="form-input mt-1 block w-full" placeholder="SP" maxLength="2" required />
                                </div>
                                <div>
                                    <label htmlFor="cep-city" className="block text-sm font-medium text-gray-700">Cidade</label>
                                    <input type="text" id="cep-city" value={addressInput.city} onChange={(e) => setAddressInput({...addressInput, city: e.target.value})} className="form-input mt-1 block w-full" placeholder="São Paulo" required />
                                </div>
                                <div>
                                    <label htmlFor="cep-street" className="block text-sm font-medium text-gray-700">Rua / Logradouro</label>
                                    <input type="text" id="cep-street" value={addressInput.street} onChange={(e) => setAddressInput({...addressInput, street: e.target.value})} className="form-input mt-1 block w-full" placeholder="Av. Paulista" required />
                                </div>
                            </div>
                            <div className="mt-4 text-right">
                                 <button type="submit" disabled={isLoading} className="py-2 px-6 btn-primary rounded-md flex items-center justify-center gap-2 ml-auto">
                                     <Search size={18} /> {isLoading ? 'Buscando...' : 'Buscar'}
                                 </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div id="cep-results" className="mt-6">
                {isLoading && <p className="text-center text-gray-500">Buscando...</p>}
                {error && <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert"><p className="font-bold">Aviso</p><p>{error}</p></div>}
                {results.length > 0 && (
                    <div className="space-y-4">
                        {results.map((result, index) => <CepResultCard key={result.cep + index} result={result} />)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CepSearch;
