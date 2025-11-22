import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import {
    calcularINSS,
    calcularIR,
    formatarMoeda,
    SALARIO_MINIMO_2025,
    TETO_INSS_2025
} from '../utils/taxCalculations';
import { Building, User, Calendar, Download, CircleDollarSign, Percent, FileDown, TrendingDown, Wallet, Edit } from 'lucide-react';
import ReceiptPreview from '../components/ReceiptPreview';


const initialTaxes = {
    inss: { valor: 0, aliquotaEfetiva: 0 },
    ir: { valor: 0, aliquota: 0 },
    liquido: 0,
};

// Função para obter o mês/ano atual formatado
const getMesReferenciaAtual = () => {
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const data = new Date();
    return `${meses[data.getMonth()]}/${data.getFullYear()}`;
};

const ReceiptGenerator = () => {
    // Estados para os dados da empresa e sócio
    const [empresaNome, setEmpresaNome] = useState('MOTIVE SOLUCOES IMOBILIARIAS LTDA');
    const [empresaCnpj, setEmpresaCnpj] = useState('53.834.731/0001-2');
    const [empresaEndereco, setEmpresaEndereco] = useState('SCIA QUADRA 14 CONJUNTO 2, LOTE 12');
    const [empresaCidade, setEmpresaCidade] = useState('Brasília/DF');
    const [empresaCep, setEmpresaCep] = useState('71250-110');
    const [socioNome, setSocioNome] = useState('ALEF ADREAN SARAIVA DE SOUSA');
    const [socioFuncao, setSocioFuncao] = useState('Sócio Administrador');
    const [mesReferencia, setMesReferencia] = useState(getMesReferenciaAtual());

    // Estados para o cálculo
    const [prolaboreBruto, setProlaboreBruto] = useState(SALARIO_MINIMO_2025.toFixed(2));
    const [calculatedTaxes, setCalculatedTaxes] = useState(initialTaxes);
    const [inputError, setInputError] = useState('');
    const [isEditingEmitter, setIsEditingEmitter] = useState(false);


    const isFormValid = prolaboreBruto > 0 && !inputError && empresaNome && empresaCnpj && socioNome && mesReferencia;

    const [isCnpjLoading, setIsCnpjLoading] = useState(false);


    const handleCnpjSearch = async () => {
        const cnpj = empresaCnpj.replace(/\D/g, '');
        if (cnpj.length !== 14) {
            alert('CNPJ inválido. Digite 14 números.'); // Usando alert por simplicidade
            return;
        }

        setIsCnpjLoading(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
            if (!response.ok) {
                throw new Error('Não foi possível buscar os dados do CNPJ.');
            }
            const data = await response.json();
            setEmpresaNome(data.razao_social || '');
            setEmpresaEndereco(`${data.logradouro || ''}, ${data.numero || ''}`);
            setEmpresaCidade(`${data.municipio || ''} / ${data.uf || ''}`);
            setEmpresaCep(data.cep || '');
        } catch (error) {
            alert(error.message);
        } finally {
            setIsCnpjLoading(false);
        }
    };
    
    // Efeito para calcular os impostos
    useEffect(() => {
        const brutoValue = parseFloat(prolaboreBruto) || 0;

        // If brutoValue is invalid or there's an input error, reset taxes and stop calculations
        if (brutoValue <= 0 || inputError) {
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

    }, [prolaboreBruto, inputError]); // Depend on inputError to recalculate or reset when validation changes

    const handleProlaboreChange = (e) => {
        const value = e.target.value;
        if (parseFloat(value) < 0) {
            setInputError('O valor não pode ser negativo.');
        } else {
            setInputError('');
        }
        setProlaboreBruto(value);
    };

    const handleSuggestionClick = (value) => {
        setProlaboreBruto(value);
        setInputError('');
    };

    const handleGeneratePdf = () => {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const brutoProlabore = parseFloat(prolaboreBruto);
        const inss = calculatedTaxes.inss;
        const ir = calculatedTaxes.ir;
        const totalDescontos = inss.valor + ir.valor;
        const liquido = calculatedTaxes.liquido;
        const salariosMinimos = (brutoProlabore / SALARIO_MINIMO_2025).toFixed(1).replace('.', ',');
        
        // --- INÍCIO DA RENDERIZAÇÃO DO LAYOUT DO PDF ---
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 20;
    
        // Título
        doc.setFont('helvetica', 'bold').setFontSize(14);
        doc.text("Recibo de Pagamento de Pró-Labore", pageW / 2, y, { align: 'center' });
        y += 10;

        // Dados da Empresa
        doc.setFont('helvetica', 'bold').setFontSize(10);
        doc.text(empresaNome, margin, y); y += 4;
        doc.setFont('helvetica', 'normal').setFontSize(9);
        doc.text(empresaEndereco, margin, y); y += 4;
        doc.text(`${empresaCep}   ${empresaCidade}`, margin, y); y += 4;
        doc.text(`CNPJ: ${empresaCnpj}`, margin, y);
        
        // Mês de referência
        doc.setFont('helvetica', 'bold').setFontSize(9).text(`Referente ao mês: ${mesReferencia}`, pageW - margin, 30, { align: 'right' });
        
        y += 12;
    
        // Dados do Sócio
        doc.setFont('helvetica', 'bold').setFontSize(10).text(`Nome: ${socioNome}`, margin, y);
        doc.setFont('helvetica', 'normal').setFontSize(9).text(`Função: ${socioFuncao}`, margin, y + 5);
        y += 12;
        
        // Linha divisória
        doc.setDrawColor(200).setLineWidth(0.2);
        doc.line(margin, y, pageW - margin, y); y += 5;
    
        // Cabeçalho da Tabela
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 4, pageW - (margin * 2), 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50);
        doc.text("CÓDIGO", margin, y);
        doc.text("DESCRIÇÕES", 35, y);
        doc.text("REFERÊNCIAS", 110, y);
        doc.text("VENCIMENTOS", 145, y);
        doc.text("DESCONTOS", pageW - margin, y, { align: 'right' });
        y += 6;
    
        // Corpo da Tabela
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text("35", margin, y);
        doc.text("Honorário pro-labore", 35, y);
        doc.text(formatarMoeda(brutoProlabore), 160, y, { align: 'right' }); y += 5;
    
        doc.text("91006", margin, y);
        doc.text("INSS pro-labore", 35, y);
        doc.text(`${formatarMoeda(inss.aliquotaEfetiva)}%`, 128, y, { align: 'right' });
        doc.text(formatarMoeda(inss.valor), pageW - margin, y, { align: 'right' }); y += 5;
    
        doc.text("91506", margin, y);
        doc.text("IR pro-labore", 35, y);
        doc.text(`${formatarMoeda(ir.aliquota)}%`, 128, y, { align: 'right' });
        doc.text(formatarMoeda(ir.valor), pageW - margin, y, { align: 'right' }); y += 10;
        
        // Seção de Totais
        const boxStartX = 115;
        doc.setDrawColor(200);
        doc.line(boxStartX, y, pageW - margin, y); y += 4;
    
        doc.setFontSize(9).setFont('helvetica', 'normal');
        doc.text("Total", boxStartX + 2, y);
        doc.text(formatarMoeda(brutoProlabore), 160, y, { align: 'right' });
        doc.text(formatarMoeda(totalDescontos), pageW - margin, y, { align: 'right' }); y += 2;
        doc.line(boxStartX, y, pageW - margin, y); y += 4;
    
        doc.setFont('helvetica', 'bold');
        doc.text("VALOR LÍQUIDO", boxStartX + 2, y);
        doc.text(`R$ ${formatarMoeda(liquido)}`, pageW - margin, y, { align: 'right' }); y += 2;
        doc.line(boxStartX, y, pageW - margin, y); y += 15;
        
        // Texto do Recibo
        doc.setFont('helvetica', 'normal').setFontSize(10);
        const textBody = `Recebi de ${empresaNome} a importância de R$ ${formatarMoeda(liquido)}, referente ao meu PRO LABORE de ${mesReferencia}, com os descontos exigidos em Lei. Declaro, outrossim, que meu salário base para fins de desconto das contribuições ao INSS é equivalente a ${salariosMinimos} salário(s) mínimo(s).\nSalário mínimo vigente: R$ ${formatarMoeda(SALARIO_MINIMO_2025)}`;
        const splitText = doc.splitTextToSize(textBody, pageW - (margin * 2));
        doc.text(splitText, margin, y); y += splitText.length * 4 + 20;
    
        // Assinatura
        const signatureLineWidth = 70;
        const signatureLineX = (pageW - signatureLineWidth) / 2;
        doc.line(signatureLineX, y, signatureLineX + signatureLineWidth, y); y += 4;
        
        doc.text(socioNome, pageW / 2, y, { align: 'center' });
    
        doc.save(`recibo_prolabore_${socioNome.split(' ')[0]}_${mesReferencia.replace('/', '-')}.pdf`);
    };

    const brutoValue = parseFloat(prolaboreBruto) || 0;
    const totalDescontos = calculatedTaxes.inss.valor + calculatedTaxes.ir.valor;
    const liquidoValue = calculatedTaxes.liquido;

    const percentualDescontos = brutoValue > 0 ? (totalDescontos / brutoValue) * 100 : 0;
    const percentualLiquido = brutoValue > 0 ? (liquidoValue / brutoValue) * 100 : 0;
    
    const suggestions = [
        { label: '1 Salário Mínimo', value: SALARIO_MINIMO_2025.toFixed(2) },
        { label: 'R$ 2.000', value: '2000.00' },
        { label: 'R$ 5.000', value: '5000.00' },
        { label: 'Teto INSS', value: TETO_INSS_2025.toFixed(2) },
    ];

    return (
        <div id="receipt-view" className="fade-in p-4 md:p-6 bg-gray-50 min-h-full">
            <div className="max-w-screen-2xl mx-auto"> {/* Increased max-width for better preview visibility */}
                <header className="mb-8 flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Gerador de Recibo de Pró-Labore</h1>
                        <p className="text-gray-600 mt-1">Preencha os dados para calcular e gerar o recibo.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsEditingEmitter(v => !v)}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${isEditingEmitter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            <Edit size={16} />
                            {isEditingEmitter ? 'Fechar Dados do Emissor' : 'Editar Dados do Emissor'}
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* Main layout: form (2) + preview (1) */}
                    {/* Coluna Principal - Inputs e Resultados */}
                    <main className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Two cards side-by-side on md+ */}
                            {/* Input Card */}
                            <div className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2 mb-4">
                                    <CircleDollarSign size={20} className="text-blue-500"/>
                                    Entrada
                                </h2>

                                <p className="text-sm text-gray-600 mb-3">Informe o valor bruto do pró-labore para calcular os descontos.</p>

                                <div className="mb-3"> {/* Sugestões acima do input */}
                                    <p className="text-sm font-medium text-gray-600 mb-2">Sugestões Rápidas</p>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestions.map(s => (
                                            <button 
                                                key={s.label}
                                                onClick={() => handleSuggestionClick(s.value)}
                                                className="bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 text-xs font-semibold px-3 py-1 rounded-full transition-colors"
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label htmlFor="prolabore-bruto" className="block text-sm font-medium text-gray-600 mb-2">Pró-labore Bruto</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <CircleDollarSign size={20} className="text-gray-400" />
                                            <span className="sr-only">R$</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            id="prolabore-bruto"
                                            className={`form-input block w-full rounded-xl text-3xl p-4 pl-14 border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${inputError ? 'border-red-400' : ''}`}
                                            value={prolaboreBruto}
                                            onChange={handleProlaboreChange}
                                            placeholder="3000.00"
                                        />
                                    </div>
                                    {inputError && <p className="text-red-600 text-sm mt-2">{inputError}</p>}
                                </div>

                                <div className="mt-6">
                                    <button 
                                        id="generate-pdf-btn" 
                                        onClick={handleGeneratePdf}
                                        disabled={!isFormValid}
                                        className="w-full btn-primary font-bold py-3 px-6 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
                                    >
                                        <FileDown size={18}/>
                                        Gerar Recibo em PDF
                                    </button>
                                </div>
                            </div>

                            {/* Results Card */}
                            <div className="bg-slate-50 rounded-xl shadow-md p-6 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2 mb-4">
                                        <Wallet size={18} className="text-gray-600"/> Cálculos
                                    </h3>

                                    <div className="text-center mb-4">
                                        <p className="text-sm font-medium text-gray-600">LÍQUIDO A RECEBER</p>
                                        <p className="text-3xl font-bold text-green-600 tracking-tight my-2">{formatarMoeda(liquidoValue)}</p>
                                    </div>

                                    {brutoValue > 0 && !inputError && (
                                        <>
                                            <div className="w-full mb-4">
                                                <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="absolute left-0 top-0 bottom-0 bg-green-500 transition-all duration-500"
                                                        style={{ width: `${percentualLiquido}%` }}
                                                    />
                                                    <div
                                                        className="absolute right-0 top-0 bottom-0 bg-red-400 transition-all duration-500"
                                                        style={{ width: `${percentualDescontos}%`, left: `${percentualLiquido}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between text-xs mt-2 text-gray-600">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                        <span>Líquido ({percentualLiquido.toFixed(1)}%)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                                        <span>Impostos ({percentualDescontos.toFixed(1)}%)</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <p className="text-gray-600 flex items-center gap-2"><TrendingDown size={14} /> Total de Descontos</p>
                                                    <p className="font-semibold text-red-600">{formatarMoeda(totalDescontos)}</p>
                                                </div>
                                                <div className="flex justify-between items-center pl-4 border-l-2 border-gray-200">
                                                    <p className="text-gray-500">INSS ({!inputError ? calculatedTaxes.inss.aliquotaEfetiva.toFixed(2) : '0.00'}%)</p>
                                                    <p className="font-medium text-gray-700">{!inputError ? formatarMoeda(calculatedTaxes.inss.valor) : '0,00'}</p>
                                                </div>
                                                <div className="flex justify-between items-center pl-4 border-l-2 border-gray-200">
                                                    <p className="text-gray-500">IRRF ({!inputError ? calculatedTaxes.ir.aliquota.toFixed(2) : '0.00'}%)</p>
                                                    <p className="font-medium text-gray-700">{!inputError ? formatarMoeda(calculatedTaxes.ir.valor) : '0,00'}</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Card de Dados Adicionais */}
                        <div className="bg-white rounded-xl shadow-md">
                             <details open={isEditingEmitter} onToggle={(e) => setIsEditingEmitter(e.currentTarget.open)}>
                                <summary className="p-6 text-lg font-semibold text-gray-700 cursor-pointer flex justify-between items-center">
                                    <span className="flex items-center gap-2"><Edit size={20}/> Dados do Emissor e Sócio</span>
                                    <span className="text-sm text-blue-600 font-medium">{isEditingEmitter ? 'Fechar' : 'Editar'}</span>
                                </summary>
                                <div className="px-6 pb-6 border-t border-gray-200">
                                     <div className="mt-6 space-y-4">
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2">
                                                <label htmlFor="empresa-nome" className="block text-sm font-medium text-gray-600">Nome da Empresa</label>
                                                <input type="text" id="empresa-nome" value={empresaNome} onChange={e => setEmpresaNome(e.target.value)} className="form-input mt-1" />
                                            </div>
                                            <div>
                                                <label htmlFor="empresa-cnpj" className="block text-sm font-medium text-gray-600">CNPJ</label>
                                                <div className="flex gap-2 mt-1">
                                                    <input type="text" id="empresa-cnpj" value={empresaCnpj} onChange={e => setEmpresaCnpj(e.target.value)} className="form-input w-full" placeholder="00.000.000/0000-00"/>
                                                    <button onClick={handleCnpjSearch} className="btn-secondary py-2 px-4 rounded-md" disabled={isCnpjLoading}>
                                                        {isCnpjLoading ? '...' : 'Buscar'}
                                                    </button>
                                                </div>
                                            </div>
                                             <div>
                                                <label htmlFor="socio-nome" className="block text-sm font-medium text-gray-600">Nome do Sócio</label>
                                                <input type="text" id="socio-nome" value={socioNome} onChange={e => setSocioNome(e.target.value)} className="form-input mt-1" />
                                            </div>
                                            <div>
                                                <label htmlFor="socio-funcao" className="block text-sm font-medium text-gray-600">Função</label>
                                                <input type="text" id="socio-funcao" value={socioFuncao} onChange={e => setSocioFuncao(e.target.value)} className="form-input mt-1" />
                                            </div>
                                            <div>
                                                <label htmlFor="mes-referencia" className="block text-sm font-medium text-gray-600">Mês de Referência</label>
                                                <input type="text" id="mes-referencia" value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} className="form-input mt-1" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label htmlFor="empresa-endereco" className="block text-sm font-medium text-gray-600">Endereço</label>
                                                <input type="text" id="empresa-endereco" value={empresaEndereco} onChange={e => setEmpresaEndereco(e.target.value)} className="form-input mt-1" />
                                            </div>
                                            <div>
                                                <label htmlFor="empresa-cep" className="block text-sm font-medium text-gray-600">CEP</label>
                                                <input type="text" id="empresa-cep" value={empresaCep} onChange={e => setEmpresaCep(e.target.value)} className="form-input mt-1" />
                                            </div>
                                            <div>
                                                <label htmlFor="empresa-cidade" className="block text-sm font-medium text-gray-600">Cidade/UF</label>
                                                <input type="text" id="empresa-cidade" value={empresaCidade} onChange={e => setEmpresaCidade(e.target.value)} className="form-input mt-1" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </main>

                    {/* Coluna Lateral - Live Preview */}
                    <aside className="lg:col-span-1 flex justify-center"> {/* Centered for better A4 display */}
                        <div className="sticky top-6">
                            <ReceiptPreview
                                empresaNome={empresaNome}
                                empresaCnpj={empresaCnpj}
                                empresaEndereco={empresaEndereco}
                                empresaCidade={empresaCidade}
                                empresaCep={empresaCep}
                                socioNome={socioNome}
                                socioFuncao={socioFuncao}
                                mesReferencia={mesReferencia}
                                calculatedTaxes={calculatedTaxes}
                                prolaboreBruto={prolaboreBruto}
                            />
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default ReceiptGenerator;
