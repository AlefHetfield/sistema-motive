import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  FileDown,
  Home,
  Info,
  GitCompareArrows,
  Landmark,
  MapPin,
  Percent,
  RotateCcw,
  Save,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { MUNICIPAL_LIMITS, MUNICIPAL_TABLE_EFFECTIVE_DATE } from '../data/municipalLimits';
import { calculateHousingSimulation } from '../utils/housingSimulator';
import { downloadHousingSimulationPdf } from '../utils/housingSimulationPdf';
import SaveSimulationModal from '../components/SaveSimulationModal';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const INITIAL_FORM = {
  bank: 'CAIXA',
  modality: 'SBPE',
  birthDate: '',
  income: '',
  fgts3y: false,
  previousSubsidy: 'no',
  uf: '',
  municipality: '',
  propertyValue: '',
  downPayment: '',
  propertyCondition: 'Usado',
  system: 'SAC',
  term: '',
  targetInstallment: '',
  relationship: 'b1',
};

function parseCurrency(value) {
  if (typeof value === 'number') return value;
  const clean = String(value || '').replace(/[^\d,.-]/g, '');
  if (!clean) return 0;
  if (clean.includes(',')) return Number(clean.replace(/\./g, '').replace(',', '.')) || 0;
  const dots = clean.match(/\./g)?.length || 0;
  return Number(dots > 1 || /\.\d{3}$/.test(clean) ? clean.replace(/\./g, '') : clean) || 0;
}

function formatCurrencyField(value) {
  const number = parseCurrency(value);
  return number ? number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
}

function formatCurrencyTyping(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return (Number(digits) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateBRToISO(value) {
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getDate() !== Number(day) || date.getMonth() !== Number(month) - 1 || date.getFullYear() !== Number(year)) return '';
  return `${year}-${month}-${day}`;
}

function formatDateTyping(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function buildShareSummary(result) {
  const product = result.bank === 'CAIXA' && result.program !== 'SBPE'
    ? `MCMV — ${result.program}`
    : result.program;
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  return [
    '🏠 *SIMULAÇÃO HABITACIONAL*',
    '_Motive Consultoria Imobiliária_',
    '',
    `🏦 *Instituição:* ${result.bank === 'CAIXA' ? 'CAIXA' : 'Bradesco'}`,
    `📋 *Produto:* ${product}`,
    `📊 *Sistema:* ${result.system}`,
    '',
    '💰 *RESUMO FINANCEIRO*',
    `• Valor do imóvel: *${currency.format(result.propertyValue)}*`,
    `• Valor financiado: *${currency.format(result.financed)}*`,
    `• Entrada necessária: *${currency.format(result.requiredEntry)}*`,
    `• Primeira parcela: *${currency.format(result.installment.total)}*`,
    '',
    '📌 *CONDIÇÕES DA SIMULAÇÃO*',
    `• Prazo: *${result.term} meses*`,
    `• Taxa efetiva: *${percent.format(result.rate.effective)}% a.a.*`,
    `• Cota utilizada: *${percent.format(result.quota)}%*`,
    '',
    '⚠️ _Valores estimados, sujeitos à análise de crédito, avaliação do imóvel e regras vigentes da instituição financeira._',
    `_Simulação gerada em ${generatedAt}._`,
  ].join('\n');
}

const fieldClass = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-100';

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function CurrencyField({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-3.5 flex items-center text-sm font-medium text-gray-400">R$</span>
      <input
        className={`${fieldClass} pl-10`}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(formatCurrencyTyping(event.target.value))}
        onBlur={() => onChange(formatCurrencyField(value))}
      />
    </div>
  );
}

function Choice({ selected, onClick, children, tone = 'blue' }) {
  const active = tone === 'red'
    ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-100'
    : 'border-primary bg-primary/5 text-primary ring-2 ring-primary/10';
  return (
    <button type="button" onClick={onClick} className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${selected ? active : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
      {children}
    </button>
  );
}

function Metric({ icon, label, value, strong = false }) {
  const Icon = icon;
  return (
    <div className={`rounded-xl border p-4 ${strong ? 'border-primary/20 bg-primary/5' : 'border-gray-100 bg-gray-50/80'}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className={`font-bold ${strong ? 'text-xl text-primary' : 'text-base text-gray-800'}`}>{value}</p>
    </div>
  );
}

function Alert({ type, message }) {
  const style = {
    success: ['border-emerald-200 bg-emerald-50 text-emerald-800', CheckCircle2],
    warning: ['border-amber-200 bg-amber-50 text-amber-800', TriangleAlert],
    error: ['border-red-200 bg-red-50 text-red-800', AlertCircle],
    info: ['border-blue-200 bg-blue-50 text-blue-800', Info],
  }[type] || ['border-gray-200 bg-gray-50 text-gray-700', Info];
  const Icon = style[1];
  return <div className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${style[0]}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><span>{message}</span></div>;
}

function SimulationPreview({ propertyValue, downPayment, income, targetInstallment }) {
  if (!propertyValue) return null;

  const validEntry = Math.min(Math.max(downPayment, 0), propertyValue);
  const requestedFinancing = Math.max(0, propertyValue - downPayment);
  const entryPercentage = propertyValue > 0 ? validEntry / propertyValue * 100 : 0;
  const incomeCommitment = income > 0 && targetInstallment > 0 ? targetInstallment / income * 100 : 0;
  const entryAboveProperty = downPayment > propertyValue;

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] to-white">
      <div className="flex items-center justify-between gap-3 border-b border-primary/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-800"><Calculator className="h-4 w-4 text-primary" /> Resumo em tempo real</div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Atualizado automaticamente</span>
      </div>
      <div className="grid gap-px bg-primary/10 sm:grid-cols-3">
        <div className="bg-white/90 px-4 py-3.5"><p className="text-xs text-gray-500">Entrada</p><p className="mt-1 font-bold text-gray-800">{currency.format(downPayment)}</p><p className="mt-0.5 text-xs font-medium text-primary">{percent.format(entryPercentage)}% do imóvel</p></div>
        <div className="bg-white/90 px-4 py-3.5"><p className="text-xs text-gray-500">Financiamento solicitado</p><p className="mt-1 font-bold text-gray-800">{currency.format(requestedFinancing)}</p><p className="mt-0.5 text-xs text-gray-400">Antes da análise das regras</p></div>
        <div className="bg-white/90 px-4 py-3.5"><p className="text-xs text-gray-500">Comprometimento desejado</p><p className="mt-1 font-bold text-gray-800">{targetInstallment > 0 && income > 0 ? `${percent.format(incomeCommitment)}% da renda` : 'Não informado'}</p><p className="mt-0.5 text-xs text-gray-400">Com base na parcela desejada</p></div>
      </div>
      <div className="bg-white/80 px-4 py-3">
        <div className="mb-1.5 flex justify-between text-xs text-gray-500"><span>Entrada</span><span>Valor solicitado</span></div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-200">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${entryPercentage}%` }} />
          <div className="bg-primary transition-all duration-500" style={{ width: `${100 - entryPercentage}%` }} />
        </div>
        {entryAboveProperty && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" /> A entrada não pode ser maior que o valor do imóvel.</p>}
      </div>
    </div>
  );
}

function ResultDiagnosis({ result }) {
  const hasError = result.fatal || result.alerts.some((alert) => alert.type === 'error');
  const hasWarning = result.alerts.some((alert) => alert.type === 'warning');
  const diagnosis = hasError
    ? { icon: AlertCircle, title: 'Fora dos parâmetros', text: 'Revise os impedimentos indicados abaixo.', className: 'border-red-200 bg-red-50 text-red-800' }
    : hasWarning
      ? { icon: TriangleAlert, title: 'Simulação com ajustes', text: 'A operação foi recalculada conforme os limites encontrados.', className: 'border-amber-200 bg-amber-50 text-amber-800' }
      : { icon: CheckCircle2, title: 'Dentro dos parâmetros', text: 'Os dados informados são compatíveis com esta simulação.', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  const Icon = diagnosis.icon;

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${diagnosis.className}`}>
      <div className="rounded-full bg-white/70 p-2"><Icon className="h-5 w-5" /></div>
      <div><p className="font-bold">{diagnosis.title}</p><p className="mt-0.5 text-sm opacity-80">{diagnosis.text}</p></div>
    </div>
  );
}

function ComparisonPanel({ current, alternative, onClose }) {
  const results = current.bank === 'CAIXA' ? [current, alternative] : [alternative, current];
  const [caixa, bradesco] = results;
  const rows = [
    { label: 'Financiamento', caixa: caixa.financed, bradesco: bradesco.financed, format: (value) => currency.format(value), better: 'higher' },
    { label: 'Entrada necessária', caixa: caixa.requiredEntry, bradesco: bradesco.requiredEntry, format: (value) => currency.format(value), better: 'lower' },
    { label: 'Primeira parcela', caixa: caixa.installment.total, bradesco: bradesco.installment.total, format: (value) => currency.format(value), better: 'lower' },
    { label: 'Taxa efetiva', caixa: caixa.rate.effective, bradesco: bradesco.rate.effective, format: (value) => `${percent.format(value)}% a.a.`, better: 'lower' },
    { label: 'Prazo', caixa: caixa.term, bradesco: bradesco.term, format: (value) => `${value} meses`, better: null },
  ];

  const highlight = (row, side) => {
    if (!row.better || row.caixa === row.bradesco) return '';
    const winner = row.better === 'higher'
      ? (row.caixa > row.bradesco ? 'caixa' : 'bradesco')
      : (row.caixa < row.bradesco ? 'caixa' : 'bradesco');
    return winner === side ? 'bg-emerald-50 text-emerald-800' : '';
  };

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div><div className="flex items-center gap-2 font-bold text-gray-900"><GitCompareArrows className="h-5 w-5 text-primary" /> Comparativo de condições</div><p className="mt-1 text-xs text-gray-500">Mesmos dados aplicados às regras de cada instituição.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Fechar comparação"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-[minmax(100px,1fr)_minmax(105px,1fr)_minmax(105px,1fr)] border-b border-gray-100 bg-gray-50 text-center text-xs font-bold uppercase tracking-wide text-gray-500">
        <div className="px-2 py-3 text-left">Condição</div>
        <div className="border-l border-gray-100 px-2 py-3 text-primary">CAIXA</div>
        <div className="border-l border-gray-100 px-2 py-3 text-red-600">Bradesco</div>
      </div>
      <div className="divide-y divide-gray-100 text-sm">
        <div className="grid grid-cols-[minmax(100px,1fr)_minmax(105px,1fr)_minmax(105px,1fr)] bg-white">
          <div className="px-3 py-3 text-xs font-medium text-gray-500">Produto</div>
          <div className="border-l border-gray-100 px-2 py-3 text-center text-xs font-semibold text-gray-700">{caixa.program}</div>
          <div className="border-l border-gray-100 px-2 py-3 text-center text-xs font-semibold text-gray-700">{bradesco.program}</div>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(100px,1fr)_minmax(105px,1fr)_minmax(105px,1fr)]">
            <div className="px-3 py-3 text-xs font-medium text-gray-500">{row.label}</div>
            <div className={`border-l border-gray-100 px-2 py-3 text-center text-xs font-bold text-gray-700 ${highlight(row, 'caixa')}`}>{row.format(row.caixa)}</div>
            <div className={`border-l border-gray-100 px-2 py-3 text-center text-xs font-bold text-gray-700 ${highlight(row, 'bradesco')}`}>{row.format(row.bradesco)}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
        O destaque verde indica somente a condição numericamente mais favorável em cada item. Não representa aprovação de crédito.
      </div>
    </div>
  );
}

function ScenarioAdjustments({ form, result, entryAvailability, onAdjust, onEntryChange, onRestore }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-gray-200 bg-gray-50/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-gray-800 transition hover:bg-gray-100">
        <span className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /> Ajustar cenário</span>
        <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-4 border-t border-gray-200 bg-white p-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-gray-600">Entrada necessária calculada</span><span className="text-xs font-bold text-gray-800">{currency.format(result.requiredEntry)}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!entryAvailability.decrease} onClick={() => onEntryChange(-10000)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300">− R$ 10 mil</button>
            <button type="button" disabled={!entryAvailability.increase} onClick={() => onEntryChange(10000)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300">+ R$ 10 mil</button>
          </div>
        </div>
        <div>
          <span className="mb-2 block text-xs font-semibold text-gray-600">Prazo desejado</span>
          <div className="grid grid-cols-4 gap-2">
            {[240, 300, 360, 420].map((term) => {
              const unavailable = term > result.maxTerm;
              const selected = !unavailable && String(form.term) === String(term);
              return <button key={term} type="button" disabled={unavailable} title={unavailable ? `Prazo máximo disponível: ${result.maxTerm} meses` : ''} onClick={() => onAdjust({ term: String(term) })} className={`rounded-lg border px-2 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300 ${selected ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{term}</button>;
            })}
          </div>
        </div>
        <div>
          <span className="mb-2 block text-xs font-semibold text-gray-600">Sistema de amortização</span>
          <div className="grid grid-cols-2 gap-2">
            {['SAC', 'PRICE'].map((system) => <button key={system} type="button" onClick={() => onAdjust({ system })} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${form.system === system ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{system}</button>)}
          </div>
        </div>
        <Field label="Parcela máxima desejada">
          <CurrencyField value={form.targetInstallment} onChange={(value) => onAdjust({ targetInstallment: value })} placeholder="Sem limite" />
        </Field>
        <button type="button" onClick={onRestore} className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50"><RotateCcw className="h-3.5 w-3.5" /> Restaurar simulação original</button>
      </div>
    </details>
  );
}

function HousingSimulator() {
  const location = useLocation();
  const restoredSimulation = location.state?.housingSimulation;
  const restoredForm = restoredSimulation?.inputSnapshot
    ? { ...INITIAL_FORM, ...restoredSimulation.inputSnapshot }
    : INITIAL_FORM;
  const [form, setForm] = useState(restoredForm);
  const [result, setResult] = useState(restoredSimulation?.resultSnapshot || null);
  const [comparison, setComparison] = useState(null);
  const [originalScenario, setOriginalScenario] = useState(restoredSimulation?.inputSnapshot ? restoredForm : null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [validation, setValidation] = useState('');

  const municipalities = useMemo(() => MUNICIPAL_LIMITS[form.uf] || [], [form.uf]);
  const selectedMunicipality = useMemo(() => {
    const item = municipalities.find(([name]) => name === form.municipality);
    return item ? { uf: form.uf, name: item[0], limit: item[1] } : null;
  }, [form.municipality, form.uf, municipalities]);

  const set = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setResult(null);
    setComparison(null);
    setValidation('');
  };

  const switchBank = (bank) => {
    setForm((current) => ({ ...current, bank }));
    setResult(null);
    setComparison(null);
    setValidation('');
  };

  const municipalityFor = (scenario) => {
    const item = (MUNICIPAL_LIMITS[scenario.uf] || []).find(([name]) => name === scenario.municipality);
    return item ? { uf: scenario.uf, name: item[0], limit: item[1] } : null;
  };

  const simulate = (scenario) => calculateHousingSimulation({
    ...scenario,
    birthDate: dateBRToISO(scenario.birthDate),
    income: parseCurrency(scenario.income),
    propertyValue: parseCurrency(scenario.propertyValue),
    downPayment: parseCurrency(scenario.downPayment),
    targetInstallment: parseCurrency(scenario.targetInstallment),
  }, municipalityFor(scenario));

  const alternativeFor = (scenario, currentResult) => {
    const bank = currentResult.bank === 'CAIXA' ? 'BRADESCO' : 'CAIXA';
    return simulate({ ...scenario, bank, modality: bank === 'CAIXA' ? 'SBPE' : scenario.modality });
  };

  const calculate = (event) => {
    event.preventDefault();
    const birthDate = dateBRToISO(form.birthDate);
    if (!birthDate || !parseCurrency(form.income) || !parseCurrency(form.propertyValue)) {
      setValidation('Preencha uma data de nascimento válida, a renda e o valor do imóvel.');
      return;
    }
    if (parseCurrency(form.downPayment) > parseCurrency(form.propertyValue)) {
      setValidation('O valor da entrada não pode ser maior que o valor do imóvel.');
      return;
    }
    if (form.bank === 'CAIXA' && form.modality === 'MCMV' && !selectedMunicipality) {
      setValidation('Selecione o estado e o município para calcular o enquadramento no MCMV.');
      return;
    }
    setResult(simulate(form));
    setComparison(null);
    setOriginalScenario({ ...form });
  };

  const compareBanks = () => {
    if (!result) return;
    setComparison(alternativeFor(form, result));
  };

  const adjustScenario = (updates) => {
    const nextForm = { ...form, ...updates };
    const nextResult = simulate(nextForm);
    setForm(nextForm);
    setResult(nextResult);
    if (comparison) setComparison(alternativeFor(nextForm, nextResult));
  };

  const changeEntry = (difference) => {
    const propertyValue = parseCurrency(form.propertyValue);
    const nextEntry = Math.min(propertyValue, Math.max(0, (result?.requiredEntry || 0) + difference));
    adjustScenario({ downPayment: formatCurrencyField(nextEntry) });
  };

  const restoreScenario = () => {
    if (!originalScenario) return;
    const restoredResult = simulate(originalScenario);
    setForm({ ...originalScenario });
    setResult(restoredResult);
    if (comparison) setComparison(alternativeFor(originalScenario, restoredResult));
  };

  const copySummary = async () => {
    if (!result) return;
    const summary = buildShareSummary(result);
    try {
      await navigator.clipboard.writeText(summary);
      toast.success('Resumo copiado para a área de transferência.');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = summary;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
      toast.success('Resumo copiado para a área de transferência.');
    }
  };

  const generatePdf = () => {
    if (!result) return;
    try {
      downloadHousingSimulationPdf(result);
      toast.success('PDF da simulação gerado com sucesso.');
    } catch {
      toast.error('Não foi possível gerar o PDF da simulação.');
    }
  };

  const reset = () => {
    setForm(INITIAL_FORM);
    setResult(null);
    setComparison(null);
    setOriginalScenario(null);
    setValidation('');
  };

  const isCaixa = form.bank === 'CAIXA';
  const isMcmv = isCaixa && form.modality === 'MCMV';
  const preview = {
    propertyValue: parseCurrency(form.propertyValue),
    downPayment: parseCurrency(form.downPayment),
    income: parseCurrency(form.income),
    targetInstallment: parseCurrency(form.targetInstallment),
  };
  const entryAvailability = result ? (() => {
    const propertyValue = parseCurrency(form.propertyValue);
    const lowerEntry = Math.max(0, result.requiredEntry - 10000);
    const lowerResult = lowerEntry < result.requiredEntry
      ? simulate({ ...form, downPayment: formatCurrencyField(lowerEntry) })
      : null;
    return {
      decrease: Boolean(lowerResult && lowerResult.requiredEntry < result.requiredEntry - .01),
      increase: result.requiredEntry < propertyValue,
    };
  })() : { decrease: false, increase: false };

  return (
    <div className="min-h-full bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><Calculator className="h-4 w-4" /> Ferramenta comercial</div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Simulador habitacional</h1>
            <p className="mt-1 text-sm text-gray-500">Compare condições CAIXA e Bradesco com prazo, seguros e capacidade de pagamento.</p>
          </div>
          <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50">
            <RotateCcw className="h-4 w-4" /> Limpar simulação
          </button>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(390px,.8fr)]">
          <form onSubmit={calculate} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5 sm:p-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Instituição financeira</p>
              <div className="flex gap-3">
                <Choice selected={isCaixa} onClick={() => switchBank('CAIXA')}><span className="flex items-center justify-center gap-2"><Landmark className="h-4 w-4" /> CAIXA</span></Choice>
                <Choice tone="red" selected={!isCaixa} onClick={() => switchBank('BRADESCO')}><span className="flex items-center justify-center gap-2"><Building2 className="h-4 w-4" /> Bradesco</span></Choice>
              </div>
            </div>

            <div className="space-y-7 p-5 sm:p-6">
              {isCaixa && (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-800"><ShieldCheck className="h-5 w-5 text-primary" /> Modalidade</h2>
                  <div className="flex gap-3">
                    <Choice selected={form.modality === 'SBPE'} onClick={() => set('modality', 'SBPE')}>SBPE</Choice>
                    <Choice selected={form.modality === 'MCMV'} onClick={() => set('modality', 'MCMV')}>Minha Casa, Minha Vida</Choice>
                  </div>
                </section>
              )}

              <section>
                <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-800"><WalletCards className="h-5 w-5 text-primary" /> Dados do proponente</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Data de nascimento" hint="Use o formato dia/mês/ano.">
                    <div className="relative"><CalendarDays className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" /><input className={`${fieldClass} pl-10`} inputMode="numeric" placeholder="DD/MM/AAAA" value={form.birthDate} onChange={(event) => set('birthDate', formatDateTyping(event.target.value))} /></div>
                  </Field>
                  <Field label="Renda familiar bruta"><CurrencyField value={form.income} onChange={(value) => set('income', value)} placeholder="8.000,00" /></Field>
                </div>
                {isMcmv && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Possui 3 anos de FGTS?">
                      <select className={fieldClass} value={form.fgts3y ? 'yes' : 'no'} onChange={(event) => set('fgts3y', event.target.value === 'yes')}><option value="no">Não</option><option value="yes">Sim</option></select>
                    </Field>
                    <Field label="Já recebeu subsídio habitacional?">
                      <select className={fieldClass} value={form.previousSubsidy} onChange={(event) => set('previousSubsidy', event.target.value)}><option value="no">Não</option><option value="yes">Sim</option></select>
                    </Field>
                  </div>
                )}
              </section>

              {isMcmv && (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-800"><MapPin className="h-5 w-5 text-primary" /> Localização do imóvel</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Estado">
                      <select className={fieldClass} value={form.uf} onChange={(event) => { setForm((current) => ({ ...current, uf: event.target.value, municipality: '' })); setResult(null); setComparison(null); }}><option value="">Selecione</option>{Object.keys(MUNICIPAL_LIMITS).sort().map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select>
                    </Field>
                    <Field label="Município" hint={`Tabela vigente desde ${MUNICIPAL_TABLE_EFFECTIVE_DATE}.`}>
                      <select className={fieldClass} disabled={!form.uf} value={form.municipality} onChange={(event) => set('municipality', event.target.value)}><option value="">Selecione</option>{municipalities.map(([name]) => <option key={name} value={name}>{name}</option>)}</select>
                    </Field>
                  </div>
                </section>
              )}

              <section>
                <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-800"><Home className="h-5 w-5 text-primary" /> Imóvel e financiamento</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Valor do imóvel"><CurrencyField value={form.propertyValue} onChange={(value) => set('propertyValue', value)} placeholder="350.000,00" /></Field>
                  <Field label="Valor da entrada"><CurrencyField value={form.downPayment} onChange={(value) => set('downPayment', value)} placeholder="70.000,00" /></Field>
                  <Field label="Condição do imóvel">
                    <select className={fieldClass} value={form.propertyCondition} onChange={(event) => set('propertyCondition', event.target.value)}><option>Novo</option><option>Usado</option></select>
                  </Field>
                  <Field label="Sistema de amortização">
                    <select className={fieldClass} value={form.system} onChange={(event) => set('system', event.target.value)}><option value="SAC">SAC</option><option value="PRICE">PRICE</option></select>
                  </Field>
                  <Field label="Prazo desejado" hint="Deixe vazio para usar o máximo permitido."><div className="relative"><Clock3 className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" /><input className={`${fieldClass} pl-10`} type="number" min="1" max="420" placeholder="Meses" value={form.term} onChange={(event) => set('term', event.target.value)} /></div></Field>
                  <Field label="Parcela desejada" hint="Opcional: limita o financiamento."><CurrencyField value={form.targetInstallment} onChange={(value) => set('targetInstallment', value)} placeholder="2.500,00" /></Field>
                </div>
                {isCaixa && form.modality === 'SBPE' && (
                  <div className="mt-4"><Field label="Relacionamento CAIXA"><select className={fieldClass} value={form.relationship} onChange={(event) => set('relationship', event.target.value)}><option value="none">Sem relacionamento</option><option value="b1">Bonificação 1</option><option value="b2">Bonificação 2 / Plus</option></select></Field></div>
                )}
                <SimulationPreview {...preview} />
              </section>

              {validation && <Alert type="error" message={validation} />}
              <button type="submit" className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 ${isCaixa ? 'bg-primary shadow-primary/20 hover:bg-[#4a637a]' : 'bg-red-600 shadow-red-600/20 hover:bg-red-700'}`}>
                <Calculator className="h-5 w-5" /> Calcular financiamento <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </form>

          <aside className="xl:sticky xl:top-6">
            {!result ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
                <div className="mb-5 rounded-2xl bg-primary/10 p-4 text-primary"><CircleDollarSign className="h-9 w-9" /></div>
                <h2 className="text-lg font-bold text-gray-800">Resultado da simulação</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">Preencha os dados ao lado para conferir financiamento estimado, entrada necessária, prazo, taxa e composição da primeira parcela.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className={`${result.bank === 'CAIXA' ? 'bg-gradient-to-br from-[#4b6d8b] to-[#344b60]' : 'bg-gradient-to-br from-red-600 to-red-800'} p-6 text-white`}>
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-xs font-semibold uppercase tracking-wider text-white/70">Enquadramento</p><h2 className="mt-1 text-xl font-bold">{result.program}</h2></div>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">{result.system}</span>
                  </div>
                  <div className="mt-6"><p className="text-sm text-white/75">Valor estimado do financiamento</p><p className="mt-1 text-3xl font-bold tracking-tight">{currency.format(result.financed)}</p></div>
                </div>
                <div className="space-y-5 p-5 sm:p-6">
                  <ResultDiagnosis result={result} />
                  <ScenarioAdjustments form={form} result={result} entryAvailability={entryAvailability} onAdjust={adjustScenario} onEntryChange={changeEntry} onRestore={restoreScenario} />
                  <div className="grid grid-cols-2 gap-3">
                    <Metric icon={Banknote} label="Entrada necessária" value={currency.format(result.requiredEntry)} strong />
                    <Metric icon={CircleDollarSign} label="Primeira parcela" value={currency.format(result.installment.total)} strong />
                    <Metric icon={Clock3} label="Prazo" value={`${result.term} meses`} />
                    <Metric icon={Percent} label="Taxa efetiva" value={`${percent.format(result.rate.effective)}% a.a.`} />
                    <Metric icon={BadgeCheck} label="Cota utilizada" value={`${percent.format(result.quota)}%`} />
                    <Metric icon={WalletCards} label="Limite pela renda" value={currency.format(result.maxPayment)} />
                  </div>

                  <div className="rounded-xl border border-gray-100">
                    <div className="border-b border-gray-100 px-4 py-3"><h3 className="text-sm font-bold text-gray-800">Composição da primeira parcela</h3></div>
                    <div className="divide-y divide-gray-100 px-4 text-sm">
                      {[['Amortização + juros', result.installment.base], ['Seguro MIP', result.installment.mip], ['Seguro DFI', result.installment.dfi], ['Tarifa administrativa', result.installment.adminFee]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-2.5"><span className="text-gray-500">{label}</span><strong className="text-gray-700">{currency.format(value)}</strong></div>)}
                    </div>
                  </div>

                  <div className="space-y-2.5">{result.alerts.map((alert, index) => <Alert key={`${alert.type}-${index}`} {...alert} />)}</div>
                  <button type="button" onClick={compareBanks} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition hover:border-primary/30 hover:bg-primary/10">
                    <GitCompareArrows className="h-4 w-4" /> Comparar com {result.bank === 'CAIXA' ? 'Bradesco' : 'CAIXA'}
                  </button>
                  <button type="button" onClick={() => setShowSaveModal(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100">
                    <Save className="h-4 w-4" /> Salvar no cadastro do cliente
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button type="button" onClick={copySummary} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"><Copy className="h-4 w-4" /> Copiar resumo</button>
                    <button type="button" onClick={generatePdf} className="flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-3 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#4a637a]"><FileDown className="h-4 w-4" /> Gerar PDF</button>
                  </div>
                  <p className="text-xs leading-5 text-gray-400">Estimativa comercial sujeita à análise de crédito, avaliação do imóvel e regras vigentes da instituição.</p>
                </div>
              </div>
            )}
            {result && comparison && <ComparisonPanel current={result} alternative={comparison} onClose={() => setComparison(null)} />}
          </aside>
        </div>
      </div>
      {showSaveModal && result && (
        <SaveSimulationModal
          simulationData={{ inputSnapshot: form, resultSnapshot: result }}
          onClose={() => setShowSaveModal(false)}
          onSaved={(_, client) => {
            setShowSaveModal(false);
            toast.success(`Simulação salva no cadastro de ${client.nome || 'cliente'}.`);
          }}
        />
      )}
    </div>
  );
}

export default HousingSimulator;
