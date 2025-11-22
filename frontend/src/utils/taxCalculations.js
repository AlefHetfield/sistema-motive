// src/utils/taxCalculations.js

/**
 * Constantes de cálculo para o ano de 2025.
 * O ideal é que estes valores venham de uma configuração ou API no futuro.
 */
export const SALARIO_MINIMO_2025 = 1518.00;
export const TETO_INSS_2025 = 8157.41;
export const ALIQUOTA_INSS_PROLABORE = 0.11;

export const TABELA_IRPF_2025 = [
    { max: 2428.80, rate: 0, deduction: 0 },
    { max: 2826.65, rate: 0.075, deduction: 182.16 },
    { max: 3751.05, rate: 0.15, deduction: 394.16 },
    { max: 4664.68, rate: 0.225, deduction: 675.49 },
    { max: Infinity, rate: 0.275, deduction: 908.73 }
];

/**
 * Formata um número para a representação de moeda brasileira (R$).
 * @param {number} valor O número a ser formatado.
 * @returns {string} O valor formatado como string.
 */
export const formatarMoeda = (valor) => {
    if (typeof valor !== 'number' || isNaN(valor)) return '0,00';
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Calcula o valor da contribuição do INSS para pró-labore.
 * @param {number} baseCalculo O valor bruto do pró-labore.
 * @returns {{valor: number, aliquotaEfetiva: number}} Objeto com o valor do INSS e a alíquota efetiva.
 */
export const calcularINSS = (baseCalculo) => {
    if (baseCalculo <= 0) return { valor: 0, aliquotaEfetiva: 0 };
    
    // Se o pró-labore for menor que o mínimo, o INSS incide sobre o mínimo.
    const baseContribuicaoINSS = Math.max(baseCalculo, SALARIO_MINIMO_2025);
    
    // O valor do INSS é limitado ao teto de contribuição.
    const valorContribuicao = Math.min(baseContribuicaoINSS, TETO_INSS_2025) * ALIQUOTA_INSS_PROLABORE;

    // A alíquota efetiva é sempre em relação ao valor bruto original.
    const aliquotaEfetiva = (valorContribuicao / baseCalculo) * 100;

    return { valor: valorContribuicao, aliquotaEfetiva: aliquotaEfetiva };
};

/**
 * Calcula o valor do Imposto de Renda Retido na Fonte (IRRF).
 * @param {number} baseCalculoIR A base de cálculo (Pró-labore bruto - INSS).
 * @returns {{valor: number, aliquota: number}} Objeto com o valor do IR e a alíquota da faixa.
 */
export const calcularIR = (baseCalculoIR) => {
    if (baseCalculoIR <= 0) return { valor: 0, aliquota: 0 };

    for (const faixa of TABELA_IRPF_2025) {
        if (baseCalculoIR <= faixa.max) {
            const valorIR = (baseCalculoIR * faixa.rate) - faixa.deduction;
            return { valor: Math.max(0, valorIR), aliquota: faixa.rate * 100 };
        }
    }
    return { valor: 0, aliquota: 0 }; // Deveria ser inalcançável
};
