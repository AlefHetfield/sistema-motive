import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import {
    calcularINSS,
    calcularIR,
    formatarMoeda,
    SALARIO_MINIMO_2025,
    TETO_INSS_2025
} from '../utils/taxCalculations';
import { Building, User, Calendar, Download, CircleDollarSign, Percent, FileDown, TrendingDown, Wallet, Edit, Loader2 } from 'lucide-react';
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

// InputField component (module-level) - memoized + forwardRef to avoid remounts and preserve caret
const InputField = React.memo(React.forwardRef(function InputField({ id, label, Icon, type = 'text', value, onChange, placeholder, className = '', inputClass = '', disabled = false }, ref) {
    return (
        <div className={`w-full ${className}`}>
            {label && <label htmlFor={id} className="block text-sm font-medium text-gray-500 mb-1">{label}</label>}
            <div className="relative">
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Icon size={18} />
                    </div>
                )}
                <input
                    id={id}
                    ref={ref}
                    type={type}
                    value={value ?? ''}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`block w-full rounded-2xl border border-gray-200 bg-white/60 py-2 pr-3 ${Icon ? 'pl-10' : 'pl-4'} text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-shadow ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${inputClass}`}
                />
            </div>
        </div>
    );
}));

const ReceiptGenerator = () => {
    
    // Estados para os dados da empresa e sócio
        const [empresaNome, setEmpresaNome] = useState('');
        const [empresaCnpj, setEmpresaCnpj] = useState('');
        const [empresaEndereco, setEmpresaEndereco] = useState('');
        const [empresaCidade, setEmpresaCidade] = useState('');
        const [empresaCep, setEmpresaCep] = useState('');
        const [socioNome, setSocioNome] = useState('');
    const [socioFuncao, setSocioFuncao] = useState('Sócio Administrador');
    const [mesReferencia, setMesReferencia] = useState(getMesReferenciaAtual());

    // Estados para o cálculo
    const [prolaboreBruto, setProlaboreBruto] = useState(SALARIO_MINIMO_2025.toFixed(2));
    const [calculatedTaxes, setCalculatedTaxes] = useState(initialTaxes);
    const [inputError, setInputError] = useState('');
    const [isEditingEmitter, setIsEditingEmitter] = useState(false);


    const isFormValid = prolaboreBruto > 0 && !inputError && empresaNome && empresaCnpj && socioNome && mesReferencia;

    const [isCnpjLoading, setIsCnpjLoading] = useState(false);
    // Quando a busca via CNPJ preencher o endereço, travamos os campos para evitar edições manuais
    const [addressLocked, setAddressLocked] = useState(false);
    // Ref para o input principal do pró-labore (para focar quando o usuário clicar em editar)
    const prolaboreInputRef = useRef(null);

    // Stable handlers to prevent recreating functions each render (helps preserve caret)
    const handleEmpresaNomeChange = useCallback((e) => setEmpresaNome(e.target.value), []);
    const handleEmpresaCnpjChange = useCallback((e) => { setEmpresaCnpj(e.target.value); setAddressLocked(false); }, []);
    const handleEmpresaEnderecoChange = useCallback((e) => setEmpresaEndereco(e.target.value), []);
    const handleEmpresaCepChange = useCallback((e) => setEmpresaCep(e.target.value), []);
    const handleEmpresaCidadeChange = useCallback((e) => setEmpresaCidade(e.target.value), []);
    const handleSocioNomeChange = useCallback((e) => setSocioNome(e.target.value), []);
    const handleSocioFuncaoChange = useCallback((e) => setSocioFuncao(e.target.value), []);
    const handleMesReferenciaChange = useCallback((e) => setMesReferencia(e.target.value), []);


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
            // Bloqueia edição manual dos campos preenchidos automaticamente
            setAddressLocked(true);
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
        <div id="receipt-view" className="fade-in p-4 md:p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-full">
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
                            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-md p-6 border border-white/30">
                                <div className="space-y-6">
                                    <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2 mb-2">
                                        <CircleDollarSign size={20} className="text-blue-500"/>
                                        Entrada
                                    </h2>

                                    <p className="text-sm text-gray-600">Informe o valor bruto do pró-labore para calcular os descontos.</p>

                                    <div> {/* Sugestões acima do input */}
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

                                    <div>
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
                                                ref={prolaboreInputRef}
                                                className={`form-input block w-full rounded-2xl text-3xl p-4 pl-14 border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${inputError ? 'border-red-400' : ''}`}
                                                value={prolaboreBruto}
                                                onChange={handleProlaboreChange}
                                                placeholder="3000.00"
                                            />
                                        </div>
                                        {inputError && <p className="text-red-600 text-sm mt-2">{inputError}</p>}
                                    </div>

                                    <div className="mt-2">
                                        <button 
                                            id="generate-pdf-btn" 
                                            onClick={handleGeneratePdf}
                                            disabled={!isFormValid}
                                            className="group w-full font-bold py-3 px-6 rounded-2xl shadow transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                                        >
                                            <span className="transition-transform duration-300 group-hover:animate-bounce">
                                                <FileDown size={18} />
                                            </span>
                                            Gerar Recibo em PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Results Card */}
                            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-md p-6 flex flex-col justify-between border border-white/30">
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                                        <Wallet size={18} className="text-gray-600"/> Cálculos
                                    </h3>

                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-600">LÍQUIDO A RECEBER</p>
                                        <p className="text-3xl font-bold text-green-600 tracking-tight my-2">{formatarMoeda(liquidoValue)}</p>

                                        {/* Barra de Progresso: Impostos vs Líquido */}
                                        <div className="mx-auto w-full max-w-md mt-3">
                                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-red-400 transition-all duration-300" style={{ width: `${percentualDescontos}%` }} />
                                                <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${percentualLiquido}%` }} />
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-2">
                                                <span className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full" /> Líquido {percentualLiquido.toFixed(1)}%</span>
                                                <span className="flex items-center gap-2"><span className="w-2 h-2 bg-red-400 rounded-full" /> Impostos {percentualDescontos.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {brutoValue > 0 && !inputError && (
                                        <>
                                            <div className="mb-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm text-gray-600">Pró-labore Bruto</p>
                                                        <p className="text-2xl font-semibold mt-1">{formatarMoeda(parseFloat(prolaboreBruto) || 0)}</p>
                                                    </div>
                                                    <div>
                                                        <button
                                                            type="button"
                                                            onClick={() => prolaboreInputRef.current && prolaboreInputRef.current.focus()}
                                                            className="btn-secondary px-3 py-2 rounded-md"
                                                        >
                                                            Editar
                                                        </button>
                                                    </div>
                                                </div>
                                                {inputError && <p className="text-red-600 text-sm mt-2">{inputError}</p>}
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
                                                <InputField id="empresa-nome" label="Nome da Empresa" Icon={Building} value={empresaNome} onChange={handleEmpresaNomeChange} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-500 mb-1">CNPJ</label>
                                                <div className="flex gap-2">
                                                    <InputField id="empresa-cnpj" label="" Icon={Building} value={empresaCnpj} onChange={handleEmpresaCnpjChange} placeholder="00.000.000/0000-00" disabled={isCnpjLoading} />
                                                    <button onClick={handleCnpjSearch} className="btn-secondary py-2 px-4 rounded-md flex items-center gap-2" disabled={isCnpjLoading}>
                                                        {isCnpjLoading ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
                                                    </button>
                                                </div>
                                            </div>
                                             <div>
                                                <InputField id="socio-nome" label="Nome do Sócio" Icon={User} value={socioNome} onChange={handleSocioNomeChange} />
                                            </div>
                                            <div>
                                                <InputField id="socio-funcao" label="Função" Icon={User} value={socioFuncao} onChange={handleSocioFuncaoChange} />
                                            </div>
                                            <div>
                                                <InputField id="mes-referencia" label="Mês de Referência" Icon={Calendar} value={mesReferencia} onChange={handleMesReferenciaChange} />
                                            </div>
                                            <div className="md:col-span-2">
                                                <InputField id="empresa-endereco" label="Endereço" Icon={Building} value={empresaEndereco} onChange={handleEmpresaEnderecoChange} disabled={addressLocked} />
                                                {addressLocked && <p className="text-xs text-gray-400 mt-1">Preenchido automaticamente — não editável</p>}
                                            </div>
                                            <div>
                                                <InputField id="empresa-cep" label="CEP" Icon={Building} value={empresaCep} onChange={handleEmpresaCepChange} disabled={addressLocked} />
                                                {addressLocked && <p className="text-xs text-gray-400 mt-1">Preenchido automaticamente — não editável</p>}
                                            </div>
                                            <div>
                                                <InputField id="empresa-cidade" label="Cidade/UF" Icon={Building} value={empresaCidade} onChange={handleEmpresaCidadeChange} disabled={addressLocked} />
                                                {addressLocked && <p className="text-xs text-gray-400 mt-1">Preenchido automaticamente — não editável</p>}
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
