import { useState, useEffect } from 'react';
import {
    calcularINSS,
    calcularIR,
    formatarMoeda
} from '../utils/taxCalculations';

const initialTaxes = {
    inss: { valor: 0, aliquotaEfetiva: 0 },
    ir: { valor: 0, aliquota: 0 },
    liquido: 0,
};

const ReceiptGenerator = () => {
    const [prolaboreBruto, setProlaboreBruto] = useState('');
    const [calculatedTaxes, setCalculatedTaxes] = useState(initialTaxes);

    useEffect(() => {
        const brutoValue = parseFloat(prolaboreBruto) || 0;

        if (brutoValue <= 0) {
            setCalculatedTaxes(initialTaxes);
            return;
        }

        const inssResult = calcularINSS(brutoValue);
        const baseCalculoIR = brutoValue - inssResult.valor;
        const irResult = calcularIR(baseCalculoIR);
        const liquidoResult = brutoValue - inssResult.valor - irResult.valor;

        setCalculatedTaxes({
            inss: inssResult,
            ir: irResult,
            liquido: liquidoResult,
        });

    }, [prolaboreBruto]);

    return (
        <div id="receipt-view" className="fade-in p-6">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Gerador de Recibo de Pró-Labore</h1>
                <p className="text-gray-600 mb-8">Preencha o valor bruto para simular os impostos e o valor líquido.</p>
                
                {/* Seção de Valores */}
                <div className="form-section p-6 rounded-lg mb-6">
                    <h2 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">Valores e Referência</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label htmlFor="prolabore-bruto" className="block text-sm font-medium text-gray-600">Valor do Pró-Labore Bruto (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                id="prolabore-bruto"
                                className="form-input mt-1 block w-full rounded-md text-lg"
                                value={prolaboreBruto}
                                onChange={(e) => setProlaboreBruto(e.target.value)}
                                placeholder="Digite o valor bruto"
                            />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:col-span-2">
                            <div>
                                <label htmlFor="valor-inss" className="block text-sm font-medium text-gray-600">Valor INSS (R$)</label>
                                <input type="text" id="valor-inss" value={formatarMoeda(calculatedTaxes.inss.valor)} className="form-input display-field mt-1 block w-full rounded-md" readOnly />
                            </div>
                            <div>
                               <label htmlFor="perc-inss" className="block text-sm font-medium text-gray-600">Alíquota INSS (%)</label>
                                <input type="text" id="perc-inss" value={`${formatarMoeda(calculatedTaxes.inss.aliquotaEfetiva)}%`} className="form-input display-field mt-1 block w-full rounded-md" readOnly />
                            </div>
                            <div>
                                <label htmlFor="valor-ir" className="block text-sm font-medium text-gray-600">Valor IR (R$)</label>
                                <input type="text" id="valor-ir" value={formatarMoeda(calculatedTaxes.ir.valor)} className="form-input display-field mt-1 block w-full rounded-md" readOnly />
                            </div>
                            <div>
                                 <label htmlFor="perc-ir" className="block text-sm font-medium text-gray-600">Alíquota IR (%)</label>
                                <input type="text" id="perc-ir" value={`${formatarMoeda(calculatedTaxes.ir.aliquota)}%`} className="form-input display-field mt-1 block w-full rounded-md" readOnly />
                            </div>
                            <div>
                                <label htmlFor="valor-liquido" className="block text-sm font-medium text-gray-600">Valor Líquido (R$)</label>
                                <input type="text" id="valor-liquido" value={formatarMoeda(calculatedTaxes.liquido)} className="form-input display-field mt-1 block w-full rounded-md" readOnly />
                            </div>
                        </div>
                    </div>
                </div>
    
                <div className="mt-8 text-center">
                    <button id="generate-pdf-btn" className="btn-primary font-bold py-3 px-8 rounded-lg shadow-md transition-shadow opacity-50 cursor-not-allowed" disabled>
                        Gerar PDF (Em breve)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptGenerator;
