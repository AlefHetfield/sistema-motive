import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import {
    calcularINSS,
    calcularIR,
    formatarMoeda,
    SALARIO_MINIMO_2025,
    TETO_INSS_2025
} from '../utils/taxCalculations';
import { Building, Building2, User, Calendar, Download, CircleDollarSign, Percent, FileDown, TrendingDown, Wallet, Edit, Search, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import ReceiptPreview from '../components/ReceiptPreview';
import { ModernInput } from '../components/ModernInput';
import { useToast } from '../hooks/useToast';


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
    
    const notify = useToast();


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
            notify.warning('CNPJ inválido. Digite 14 números.');
            return;
        }

        setIsCnpjLoading(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'CNPJ não encontrado ou serviço indisponível.');
            }
            
            const data = await response.json();
            
            // Valida se recebeu dados válidos
            if (!data || typeof data !== 'object') {
                throw new Error('Resposta inválida do servidor.');
            }
            
            setEmpresaNome(data.razao_social || data.nome_fantasia || '');
            
            // Monta endereço apenas se tiver dados
            const logradouro = data.logradouro || data.descricao_tipo_de_logradouro || '';
            const numero = data.numero || '';
            const bairro = data.bairro || '';
            
            if (logradouro || numero) {
                const enderecoCompleto = [logradouro, numero].filter(Boolean).join(', ');
                setEmpresaEndereco(bairro ? `${enderecoCompleto} - ${bairro}` : enderecoCompleto);
            } else {
                setEmpresaEndereco('');
            }
            
            const municipio = data.municipio || data.cidade || '';
            const uf = data.uf || data.estado || '';
            if (municipio || uf) {
                setEmpresaCidade([municipio, uf].filter(Boolean).join(' / '));
            } else {
                setEmpresaCidade('');
            }
            
            setEmpresaCep(data.cep ? data.cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : '');
            
            // Bloqueia edição manual dos campos preenchidos automaticamente
            setAddressLocked(true);
        } catch (error) {
            console.error('Erro ao buscar CNPJ:', error);
            notify.error(error.message || 'Erro ao buscar dados do CNPJ. Tente novamente.');
            setAddressLocked(false);
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
        try {
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
        
        // Mostrar toast de sucesso
        notify.success(`Recibo de ${socioNome} gerado com sucesso! 📄`);
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        notify.error(`Erro ao gerar PDF: ${error.message || 'Tente novamente'}`);
    }
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

    // Calcular campos preenchidos
    const filledFields = [
        empresaNome,
        empresaCnpj,
        socioNome,
        prolaboreBruto > 0,
        empresaEndereco,
        empresaCidade,
        empresaCep
    ].filter(Boolean).length;
    const totalFields = 7;
    const progressPercentage = (filledFields / totalFields) * 100;

    return (
        <div id="receipt-view" className="fade-in p-6">
            <div className="max-w-screen-2xl mx-auto">
                <header className="mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800 mb-2">Gerador de Recibo de Pró-Labore</h2>
                        <p className="text-gray-500">Preencha os dados para calcular e gerar o recibo em PDF</p>
                    </div>
                    
                    {/* Indicador de Progresso */}
                    {filledFields < totalFields && (
                        <div className="mt-6 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-fade-in">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-gray-700">Progresso do Formulário</span>
                                <span className="text-sm font-semibold text-primary">{filledFields}/{totalFields} campos</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                    className="bg-primary h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                        </div>
                    )}
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* Main layout: form (2) + preview (1) */}
                    {/* Coluna Principal - Inputs e Resultados */}
                    <main className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Input Card */}
                            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-all duration-300 animate-fade-in">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <CircleDollarSign size={20} className="text-primary"/>
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-800">Entrada</h2>
                                            <p className="text-xs text-gray-500">Valor bruto do pró-labore</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-600 mb-2 font-medium">Sugestões Rápidas</p>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestions.map(s => (
                                                <button 
                                                    key={s.label}
                                                    onClick={() => handleSuggestionClick(s.value)}
                                                    className="bg-gray-50 text-gray-700 hover:bg-primary/10 hover:text-primary text-xs font-medium px-4 py-2 rounded-full transition-all duration-300 border border-gray-200 hover:border-primary/30"
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="prolabore-bruto" className="block text-xs text-gray-600 mb-2 font-medium">Pró-labore Bruto</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="text-2xl text-gray-400 font-semibold">R$</span>
                                            </div>
                                            <input
                                                type="number"
                                                step="0.01"
                                                id="prolabore-bruto"
                                                ref={prolaboreInputRef}
                                                className={`block w-full rounded-2xl text-3xl font-bold p-4 pl-16 border-2 bg-gray-50 focus:bg-white transition-all duration-300 ${inputError ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20'} outline-none`}
                                                value={prolaboreBruto}
                                                onChange={handleProlaboreChange}
                                                placeholder="3000.00"
                                            />
                                        </div>
                                        {inputError && (
                                            <div className="flex items-center gap-2 mt-2 text-red-600 text-sm animate-fade-in">
                                                <AlertCircle size={14} />
                                                <p>{inputError}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-2">
                                        <button 
                                            id="generate-pdf-btn" 
                                            onClick={handleGeneratePdf}
                                            disabled={!isFormValid}
                                            className="group w-full font-semibold py-3.5 px-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-primary hover:bg-primary/90 text-white"
                                        >
                                            <FileDown size={18} className="group-hover:animate-bounce" />
                                            Gerar Recibo em PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Results Card */}
                            <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col justify-between border border-gray-100 hover:shadow-md transition-all duration-300 animate-fade-in" style={{ animationDelay: '100ms' }}>
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-50 rounded-lg">
                                            <Wallet size={18} className="text-green-600"/>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-800">Cálculos</h3>
                                            <p className="text-xs text-gray-500">Resultado líquido</p>
                                        </div>
                                    </div>

                                    <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">Líquido a Receber</p>
                                        <p className="text-4xl font-bold text-green-600 tracking-tight">R$ {formatarMoeda(liquidoValue)}</p>

                                        {/* Barra de Progresso: Impostos vs Líquido */}
                                        <div className="mx-auto w-full max-w-md mt-4">
                                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${percentualLiquido}%` }} />
                                                <div className="h-full bg-red-400 transition-all duration-300" style={{ width: `${percentualDescontos}%` }} />
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-2">
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> Líquido {percentualLiquido.toFixed(1)}%</span>
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full" /> Impostos {percentualDescontos.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {brutoValue > 0 && !inputError && (
                                        <div className="space-y-3 text-sm border-t border-gray-200 pt-4">
                                            <div className="flex justify-between items-center">
                                                <p className="text-gray-600 flex items-center gap-2"><TrendingDown size={14} /> Total de Descontos</p>
                                                <p className="font-semibold text-red-600">{formatarMoeda(totalDescontos)}</p>
                                            </div>
                                            <div className="flex justify-between items-center pl-4 border-l-2 border-gray-200">
                                                <p className="text-gray-500">INSS ({calculatedTaxes.inss.aliquotaEfetiva.toFixed(2)}%)</p>
                                                <p className="font-medium text-gray-700">{formatarMoeda(calculatedTaxes.inss.valor)}</p>
                                            </div>
                                            <div className="flex justify-between items-center pl-4 border-l-2 border-gray-200">
                                                <p className="text-gray-500">IRRF ({calculatedTaxes.ir.aliquota.toFixed(2)}%)</p>
                                                <p className="font-medium text-gray-700">{formatarMoeda(calculatedTaxes.ir.valor)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Card de Dados Adicionais */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 animate-fade-in" style={{ animationDelay: '200ms' }}>
                             <details open={isEditingEmitter} onToggle={(e) => setIsEditingEmitter(e.currentTarget.open)}>
                                <summary className="p-6 text-lg font-semibold text-gray-800 cursor-pointer flex justify-between items-center hover:text-primary transition-colors">
                                    <span className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Edit size={18} className="text-primary"/>
                                        </div>
                                        Dados do Emissor e Sócio
                                    </span>
                                    <span className="text-sm text-primary font-medium">{isEditingEmitter ? 'Fechar' : 'Editar'}</span>
                                </summary>
                                <div className="px-6 pb-6 border-t border-gray-100">
                                        <div className="mt-6 space-y-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="md:col-span-2">
                                                <ModernInput id="empresa-nome" label="Nome da Empresa" Icon={Building} value={empresaNome} onChange={handleEmpresaNomeChange} placeholder="Razão Social" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1 font-medium">CNPJ</label>
                                                <div className="flex gap-2">
                                                    <ModernInput id="empresa-cnpj" Icon={Building} value={empresaCnpj} onChange={handleEmpresaCnpjChange} placeholder="00.000.000/0000-00" disabled={isCnpjLoading} />
                                                    <button
                                                        onClick={handleCnpjSearch}
                                                        className="py-2 px-5 rounded-2xl flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed font-medium border border-primary/20 hover:border-primary"
                                                        disabled={isCnpjLoading}
                                                    >
                                                        {isCnpjLoading ? <Loader2 size={16} className="animate-spin" /> : <><Search size={16} /> Buscar</>}
                                                    </button>
                                                </div>
                                            </div>
                                             <div>
                                                <ModernInput id="socio-nome" label="Nome do Sócio" Icon={User} value={socioNome} onChange={handleSocioNomeChange} placeholder="Nome completo" />
                                            </div>
                                            <div>
                                                <ModernInput id="socio-funcao" label="Função" Icon={User} value={socioFuncao} onChange={handleSocioFuncaoChange} placeholder="Sócio Administrador" />
                                            </div>
                                            <div>
                                                <ModernInput id="mes-referencia" label="Mês de Referência" Icon={Calendar} value={mesReferencia} onChange={handleMesReferenciaChange} placeholder="Janeiro/2025" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <ModernInput id="empresa-endereco" label="Endereço" Icon={MapPin} value={empresaEndereco} onChange={handleEmpresaEnderecoChange} disabled={addressLocked} placeholder="Rua, número" />
                                                {addressLocked && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><AlertCircle size={12} /> Preenchido automaticamente</p>}
                                            </div>
                                            <div>
                                                <ModernInput id="empresa-cep" label="CEP" Icon={MapPin} value={empresaCep} onChange={handleEmpresaCepChange} disabled={addressLocked} placeholder="00000-000" />
                                                {addressLocked && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><AlertCircle size={12} /> Preenchido automaticamente</p>}
                                            </div>
                                            <div>
                                                <ModernInput id="empresa-cidade" label="Cidade/UF" Icon={Building2} value={empresaCidade} onChange={handleEmpresaCidadeChange} disabled={addressLocked} placeholder="São Paulo / SP" />
                                                {addressLocked && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><AlertCircle size={12} /> Preenchido automaticamente</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </main>

                    {/* Coluna Lateral - Live Preview (apenas se houver dados) */}
                    {filledFields >= 3 && (
                        <aside className="lg:col-span-1 flex justify-center animate-fade-in" style={{ animationDelay: '300ms' }}>
                            <div className="sticky top-6">
                                <div className="mb-4 text-center">
                                    <p className="text-xs font-medium text-gray-500 bg-white rounded-full px-4 py-2 inline-flex items-center gap-2 shadow-sm border border-gray-100">
                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                        Atualizado em tempo real
                                    </p>
                                </div>
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
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceiptGenerator;
