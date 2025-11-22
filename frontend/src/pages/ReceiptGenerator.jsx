import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import {
    calcularINSS,
    calcularIR,
    formatarMoeda,
    SALARIO_MINIMO_2025
} from '../utils/taxCalculations';
import { Building, User, Calendar, Download } from 'lucide-react';


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
    const [empresaCnpj, setEmpresaCnpj] = useState('53.834.731/0001-2 Motive');
    const [empresaEndereco, setEmpresaEndereco] = useState('SCIA QUADRA 14 CONJUNTO 2, LOTE 12');
    const [empresaCidade, setEmpresaCidade] = useState('Brasília/DF');
    const [empresaCep, setEmpresaCep] = useState('71250-110');
    const [socioNome, setSocioNome] = useState('ALEF ADREAN SARAIVA DE SOUSA');
    const [socioFuncao, setSocioFuncao] = useState('Sócio Administrador');
    const [mesReferencia, setMesReferencia] = useState(getMesReferenciaAtual());

    // Estados para o cálculo
    const [prolaboreBruto, setProlaboreBruto] = useState('1518.00');
    const [calculatedTaxes, setCalculatedTaxes] = useState(initialTaxes);

    const isFormValid = prolaboreBruto > 0 && empresaNome && empresaCnpj && socioNome && mesReferencia;

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

    return (
        <div id="receipt-view" className="fade-in p-6">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Gerador de Recibo de Pró-Labore</h1>
                <p className="text-gray-600 mb-8">Preencha os campos para gerar o recibo de pagamento.</p>
                
                {/* Seção Dados da Empresa */}
                <div className="form-section p-6 rounded-lg mb-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4 flex items-center gap-2"><Building size={20}/> Dados da Empresa</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label htmlFor="empresa-nome" className="block text-sm font-medium text-gray-600">Nome da Empresa</label>
                            <input type="text" id="empresa-nome" value={empresaNome} onChange={e => setEmpresaNome(e.target.value)} className="form-input mt-1" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="empresa-cnpj" className="block text-sm font-medium text-gray-600">CNPJ</label>
                            <div className="flex gap-2 mt-1">
                                <input 
                                    type="text" 
                                    id="empresa-cnpj" 
                                    value={empresaCnpj} 
                                    onChange={e => {
                                        const formatted = e.target.value.replace(/\D/g, '')
                                            .replace(/^(\d{2})(\d)/, '$1.$2')
                                            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                                            .replace(/\.(\d{3})(\d)/, '.$1/$2')
                                            .replace(/(\d{4})(\d)/, '$1-$2');
                                        setEmpresaCnpj(formatted.slice(0, 18));
                                    }} 
                                    className="form-input w-full" 
                                    placeholder="00.000.000/0000-00"
                                />
                                <button onClick={handleCnpjSearch} className="btn-secondary py-2 px-4 rounded-md" disabled={isCnpjLoading}>
                                    {isCnpjLoading ? 'Buscando...' : 'Buscar'}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="empresa-cep" className="block text-sm font-medium text-gray-600">CEP</label>
                            <input type="text" id="empresa-cep" value={empresaCep} onChange={e => setEmpresaCep(e.target.value)} className="form-input mt-1" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="empresa-endereco" className="block text-sm font-medium text-gray-600">Endereço</label>
                            <input type="text" id="empresa-endereco" value={empresaEndereco} onChange={e => setEmpresaEndereco(e.target.value)} className="form-input mt-1" />
                        </div>
                         <div>
                            <label htmlFor="empresa-cidade" className="block text-sm font-medium text-gray-600">Cidade/UF</label>
                            <input type="text" id="empresa-cidade" value={empresaCidade} onChange={e => setEmpresaCidade(e.target.value)} className="form-input mt-1" />
                        </div>
                    </div>
                </div>

                 {/* Seção Dados do Sócio */}
                 <div className="form-section p-6 rounded-lg mb-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4 flex items-center gap-2"><User size={20}/> Dados do Sócio</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
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
                    </div>
                </div>

                {/* Seção de Valores */}
                <div className="form-section p-6 rounded-lg mb-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4 flex items-center gap-2"><Calendar size={20}/> Cálculo do Pró-Labore</h2>
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
                                <input type="text" id="valor-inss" value={formatarMoeda(calculatedTaxes.inss.valor)} className="form-input display-field mt-1" readOnly />
                            </div>
                            <div>
                               <label htmlFor="perc-inss" className="block text-sm font-medium text-gray-600">Alíquota INSS (%)</label>
                                <input type="text" id="perc-inss" value={`${formatarMoeda(calculatedTaxes.inss.aliquotaEfetiva)}%`} className="form-input display-field mt-1" readOnly />
                            </div>
                            <div>
                                <label htmlFor="valor-ir" className="block text-sm font-medium text-gray-600">Valor IR (R$)</label>
                                <input type="text" id="valor-ir" value={formatarMoeda(calculatedTaxes.ir.valor)} className="form-input display-field mt-1" readOnly />
                            </div>
                            <div>
                                 <label htmlFor="perc-ir" className="block text-sm font-medium text-gray-600">Alíquota IR (%)</label>
                                <input type="text" id="perc-ir" value={`${formatarMoeda(calculatedTaxes.ir.aliquota)}%`} className="form-input display-field mt-1" readOnly />
                            </div>
                            <div>
                                <label htmlFor="valor-liquido" className="block text-sm font-medium text-gray-600">Valor Líquido (R$)</label>
                                <input type="text" id="valor-liquido" value={formatarMoeda(calculatedTaxes.liquido)} className="form-input display-field mt-1" readOnly />
                            </div>
                        </div>
                    </div>
                </div>
    
                <div className="mt-8 text-center">
                    <button 
                        id="generate-pdf-btn" 
                        onClick={handleGeneratePdf}
                        disabled={!isFormValid}
                        className="btn-primary font-bold py-3 px-8 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
                    >
                        <Download size={20}/>
                        Gerar e Baixar PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptGenerator;
