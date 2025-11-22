import React from 'react';
import { motion } from 'framer-motion';
import { formatarMoeda, SALARIO_MINIMO_2025 } from '../utils/taxCalculations';
import AnimatedNumber from './AnimatedNumber';

const ReceiptPreview = ({
    empresaNome,
    empresaCnpj,
    empresaEndereco,
    empresaCidade,
    empresaCep,
    socioNome,
    socioFuncao,
    mesReferencia,
    calculatedTaxes,
    prolaboreBruto,
}) => {
    const brutoProlaboreNum = parseFloat(prolaboreBruto) || 0;
    const inss = calculatedTaxes.inss;
    const ir = calculatedTaxes.ir;
    const totalDescontos = inss.valor + ir.valor;
    const liquido = calculatedTaxes.liquido;

    const salariosMinimos = (brutoProlaboreNum / SALARIO_MINIMO_2025).toFixed(1);

    return (
        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="bg-white rounded-xl shadow-lg p-6 md:p-8 max-w-full mx-auto border border-gray-200 aspect-[1/1.414] overflow-y-auto">
            {/* Título */}
            <h1 className="text-xl font-bold text-center mb-6">Recibo de Pagamento de Pró-Labore</h1>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                {/* Dados da Empresa */}
                <div>
                    <p className="font-bold">{empresaNome}</p>
                    <p>{empresaEndereco}</p>
                    <p>{empresaCep} {empresaCidade}</p>
                    <p>CNPJ: {empresaCnpj}</p>
                </div>
                {/* Mês de Referência */}
                <div className="text-right">
                    <p className="font-bold">Referente ao mês: {mesReferencia}</p>
                </div>
            </div>

            {/* Dados do Sócio */}
            <div className="mb-6 text-sm">
                <p className="font-bold">Nome: {socioNome}</p>
                <p>Função: {socioFuncao}</p>
            </div>

            <hr className="border-gray-300 mb-6" />

            {/* Tabela de Valores */}
            <div className="mb-6">
                <div className="grid grid-cols-5 text-sm font-bold bg-gray-100 p-2 rounded-t-md">
                    <div>CÓDIGO</div>
                    <div className="col-span-2">DESCRIÇÕES</div>
                    <div className="text-right">VENCIMENTOS</div>
                    <div className="text-right">DESCONTOS</div>
                </div>
                <div className="grid grid-cols-5 text-sm p-2 border-b border-gray-200">
                    <div>35</div>
                    <div className="col-span-2">Honorário pro-labore</div>
                    <div className="text-right">
                        <AnimatedNumber value={brutoProlaboreNum} prefix="R$ " />
                    </div>
                    <div className="text-right"></div>
                </div>
                <div className="grid grid-cols-5 text-sm p-2 border-b border-gray-200">
                    <div>91006</div>
                    <div className="col-span-2">INSS pro-labore</div>
                    <div className="text-right">{formatarMoeda(inss.aliquotaEfetiva)}%</div>
                    <div className="text-right text-red-600">
                        <AnimatedNumber value={inss.valor} prefix="R$ " />
                    </div>
                </div>
                <div className="grid grid-cols-5 text-sm p-2 border-b border-gray-200">
                    <div>91506</div>
                    <div className="col-span-2">IR pro-labore</div>
                    <div className="text-right">{formatarMoeda(ir.aliquota)}%</div>
                    <div className="text-right text-red-600">
                        <AnimatedNumber value={ir.valor} prefix="R$ " />
                    </div>
                </div>
            </div>

            {/* Seção de Totais */}
            <div className="grid grid-cols-5 text-sm font-bold p-2 bg-gray-50 rounded-b-md">
                <div></div>
                <div className="col-span-2">Total</div>
                <div className="text-right">
                    <AnimatedNumber value={brutoProlaboreNum} prefix="R$ " />
                </div>
                <div className="text-right text-red-600">
                    <AnimatedNumber value={totalDescontos} prefix="R$ " />
                </div>
            </div>
            
            <div className="grid grid-cols-5 text-lg font-bold p-2 mt-4 bg-blue-50">
                <div></div>
                <div className="col-span-2">VALOR LÍQUIDO</div>
                <div className="text-right col-span-2 text-green-700">
                    <AnimatedNumber value={liquido} prefix="R$ " />
                </div>
            </div>

            <hr className="border-gray-300 my-6" />

            {/* Texto do Recibo */}
            <div className="mb-12 text-sm leading-relaxed">
                <p>Recebi de <span className="font-semibold">{empresaNome}</span> a importância de <span className="font-semibold">R$ <AnimatedNumber value={liquido} /></span>, referente ao meu PRO LABORE de <span className="font-semibold">{mesReferencia}</span>, com os descontos exigidos em Lei. Declaro, outrossim, que meu salário base para fins de desconto das contribuições ao INSS é equivalente a <span className="font-semibold">{salariosMinimos} salário(s) mínimo(s)</span>.</p>
                <p className="mt-2">Salário mínimo vigente: R$ {formatarMoeda(SALARIO_MINIMO_2025)}</p>
            </div>

            {/* Assinatura */}
            <div className="text-center mt-auto pt-12">
                <div className="border-t border-gray-400 w-2/3 mx-auto mb-2"></div>
                <p className="font-semibold">{socioNome}</p>
            </div>
        </motion.div>
    );
};

export default ReceiptPreview;
