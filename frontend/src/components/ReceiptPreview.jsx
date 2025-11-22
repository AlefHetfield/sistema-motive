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
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="bg-white font-sans text-[#1f2937] rounded-xl shadow-md p-6 md:p-8 max-w-full mx-auto border border-gray-100 overflow-y-auto"
        >
            {/* Header: Empresa, Mês de Referência, Sócio */}
            <header className="mb-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{empresaNome}</h3>
                    <p className="text-sm text-gray-500">{mesReferencia}</p>
                </div>
                <p className="mt-2 text-sm text-gray-600">{socioNome}</p>
            </header>

            {/* Valor Líquido em destaque */}
            <div className="flex flex-col items-center justify-center py-6">
                <p className="text-sm text-gray-500 mb-2">LÍQUIDO A RECEBER</p>
                <div className="text-4xl font-extrabold text-green-600 mb-3">
                    <AnimatedNumber value={liquido} prefix="R$ " />
                </div>

                <div className="w-full max-w-xs grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-4 py-2">
                        <span className="text-sm text-gray-700">Pró-Labore Bruto</span>
                        <span className="text-sm font-medium"> <AnimatedNumber value={brutoProlaboreNum} prefix="R$ " /> </span>
                    </div>
                    <div className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2">
                        <span className="text-sm text-gray-700">Total de Descontos</span>
                        <span className="text-sm font-medium text-red-600"> <AnimatedNumber value={totalDescontos} prefix="R$ " /> </span>
                    </div>
                </div>
            </div>

            {/* Minimal footer with small metadata */}
            <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
                <div>{empresaNome}</div>
                <div>Atualizado em tempo real</div>
            </div>
        </motion.div>
    );
};

export default ReceiptPreview;
