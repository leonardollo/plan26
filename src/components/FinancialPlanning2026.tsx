
import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
// FIX: Split type and value imports to allow MONTHS and MONTH_LABELS to be used as values. Also import statement-specific types.
import type { FinancialPlan2026, Month, DRE2026, DFC2026, BP2026, FinancialPlanSheetRow, ScenarioName } from '../types';
import { MONTHS, MONTH_LABELS } from '../types';
import { formatCurrency } from '../utils/formatters';
import clsx from 'clsx';
import InvestimentosFinanciamentos2026 from './InvestimentosFinanciamentos2026';

type FinancialStatement = 'dre' | 'dfc' | 'bp' | 'investimentos';

// Helper component to render a financial statement table
// FIX: Converted from React.FC to a generic function component to correctly handle union types for data and rows.
// This resolves the 'never' type error when accessing keys.
// FIX: Changed generic constraint to be on the data object type itself, which resolves the type inference issue.
const FinancialStatementTable = <T extends Record<string, FinancialPlanSheetRow>>({
    title,
    data,
    rows,
    isBalanceSheet = false, // New prop to control total calculation logic
}: {
    title: string;
    data: T;
    rows: { key: keyof T, label: string, isHeader?: boolean, isBold?: boolean }[];
    isBalanceSheet?: boolean;
}) => {
    
    const { anoPlano } = usePlan();
    const calculateTotal = (rowKey: keyof T) => {
        const rowData = data?.[rowKey];
        if (!rowData) return 0;

        // FIX: For Balance Sheet (Stock), the "Total" is the position at the end of the period (December).
        // For DRE/DFC (Flow), the "Total" is the sum of all months.
        if (isBalanceSheet) {
            return Number(rowData?.['dez']) || 0;
        }

        return MONTHS.reduce((sum, month) => sum + (Number(rowData?.[month]) || 0), 0);
    };

    return (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <h3 className="p-4 text-lg font-bold text-brand-blue">{title}</h3>
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                    <tr>
                        <th className="sticky left-0 bg-gray-50 z-10 p-3 text-left font-semibold" style={{ width: '250px' }}>Indicador</th>
                        <th className="p-3 text-right font-semibold bg-gray-200 text-gray-900 border-l border-white">
                            {isBalanceSheet ? `Saldo Dez/${String(anoPlano).slice(-2)}` : `Total ${anoPlano}`}
                        </th>
                        {MONTHS.map(m => <th key={m} className="p-2 text-center font-medium">{MONTH_LABELS[m]}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {rows.map(({ key, label, isHeader, isBold }) => {
                        if (isHeader) {
                            return <tr key={key as string} className="bg-orange-50"><td colSpan={14} className="p-2 font-bold text-orange-800">{label}</td></tr>
                        }
                        const total = calculateTotal(key);
                        const rowData = data?.[key];
                        return (
                             <tr key={key as string} className={clsx(isBold && 'font-bold bg-gray-50')}>
                                <td className="sticky left-0 bg-inherit z-10 p-3 text-gray-800">{label}</td>
                                <td className="p-3 text-right font-semibold text-gray-900 bg-gray-50 border-l border-gray-200">{formatCurrency(total)}</td>
                                {MONTHS.map(month => (
                                    <td key={month} className="p-2 text-right text-gray-700">{formatCurrency(rowData?.[month])}</td>
                                ))}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};

const ExplanationBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-bold text-brand-blue">{title}</h4>
        <div className="text-sm text-gray-700 mt-2 space-y-2">
            {children}
        </div>
    </div>
);


const FinancialPlanning2026: React.FC = () => {
    const { planData, calculateFinancialPlan2026, baseScenario, setBaseScenario, anoPlano } = usePlan();
    const [activeTab, setActiveTab] = useState<FinancialStatement>('dre');
    
    const TABS: { id: FinancialStatement, label: string }[] = [
        { id: 'dre', label: 'DRE (Resultados)' },
        { id: 'dfc', label: 'Fluxo de Caixa (DFC)' },
        { id: 'bp', label: 'Balanço Patrimonial' },
        { id: 'investimentos', label: 'Investimentos e Financiamentos' },
    ];
    
    // FIX: Added explicit types to row definitions for better type safety and to help the generic component.
    const DRE_ROWS: { key: keyof DRE2026, label: string, isHeader?: boolean, isBold?: boolean }[] = [
        { key: 'receitaBruta', label: 'Receita Bruta' },
        { key: 'impostosVendas', label: '(-) Impostos s/ Vendas' },
        { key: 'receitaLiquida', label: '(=) Receita Líquida', isBold: true },
        { key: 'custosVariaveis', label: '(-) Custos Variáveis (Padrão)' },
        { key: 'outrosCustosVariaveis', label: '(-) Outros Custos Variáveis (Personalizados)' },
        { key: 'lucroBruto', label: '(=) Lucro Bruto', isBold: true },
        { key: 'despesasFolha', label: '(-) Despesas com Pessoal' },
        { key: 'despesasMarketing', label: '(-) Despesas de Marketing' },
        { key: 'despesasOperacionais', label: '(-) Despesas Operacionais' },
        { key: 'outrasDespesasFixas', label: '(-) Outras Despesas Fixas (Personalizadas)' },
        { key: 'ebitda', label: '(=) EBITDA', isBold: true },
        { key: 'depreciacao', label: '(-) Depreciação e Amort.' },
        { key: 'ebit', label: '(=) EBIT (Lucro Operacional)', isBold: true },
        { key: 'despesasFinanceiras', label: '(-) Desp./Rec. Financeiras' },
        { key: 'lucroAntesImpostos', label: '(=) Lucro Antes dos Impostos', isBold: true },
        { key: 'irpjCsll', label: '(-) IRPJ e CSLL' },
        { key: 'lucroLiquido', label: '(=) Lucro Líquido', isBold: true },
    ];
    
    const DFC_ROWS: { key: keyof DFC2026, label: string, isHeader?: boolean, isBold?: boolean }[] = [
        { key: 'fco', label: 'Fluxo de Caixa Operacional (FCO)', isBold: true },
        { key: 'fci', label: 'Fluxo de Caixa de Investimentos (FCI)', isBold: true },
        { key: 'fcf', label: 'Fluxo de Caixa de Financiamentos (FCF)', isBold: true },
        { key: 'variacaoCaixa', label: '(=) Variação Líquida de Caixa', isBold: true },
        { key: 'saldoInicialCaixa', label: '(+) Saldo Inicial de Caixa' },
        { key: 'saldoFinalCaixa', label: '(=) Saldo Final de Caixa', isBold: true },
    ];
    
    const BP_ROWS: { key: keyof BP2026, label: string, isHeader?: boolean, isBold?: boolean }[] = [
        { key: 'caixa', label: 'Caixa e Equivalentes' },
        { key: 'contasAReceber', label: 'Contas a Receber' },
        { key: 'estoques', label: 'Estoques' },
        { key: 'ativoCirculante', label: '(=) Ativo Circulante', isBold: true },
        { key: 'ativoNaoCirculante', label: '(+) Ativo Não Circulante' },
        { key: 'totalAtivos', label: '(=) Total de Ativos', isBold: true },
        { key: 'fornecedores', label: 'Fornecedores' },
        { key: 'emprestimosCurtoPrazo', label: 'Empréstimos Curto Prazo' },
        { key: 'passivoCirculante', label: '(=) Passivo Circulante', isBold: true },
        { key: 'emprestimosLongoPrazo', label: '(+) Empréstimos Longo Prazo' },
        { key: 'passivoNaoCirculante', label: '(=) Passivo Não Circulante', isBold: true },
        { key: 'capitalSocial', label: 'Capital Social' },
        { key: 'lucrosAcumulados', label: 'Lucros Acumulados' },
        { key: 'patrimonioLiquido', label: '(=) Patrimônio Líquido', isBold: true },
        { key: 'totalPassivoPL', label: '(=) Total Passivo + PL', isBold: true },
    ];
    
    return (
        <div className="space-y-8">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">10. Planejamento Financeiro {anoPlano}</h1>
                <p className="text-gray-500 mt-2">
                    Gere as projeções financeiras (DRE, DFC, BP) com base no cenário selecionado e nos dados inseridos.
                </p>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 justify-between items-center">
                <div>
                    <label htmlFor="scenario-select" className="block text-sm font-medium text-gray-700">Selecione o Cenário para Geração:</label>
                    <select
                        id="scenario-select"
                        value={baseScenario}
                        onChange={(e) => setBaseScenario(e.target.value as ScenarioName)}
                        className="mt-1 block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-orange focus:border-brand-orange sm:text-sm rounded-md"
                    >
                        <option>Conservador</option>
                        <option>Otimista</option>
                        <option>Disruptivo</option>
                    </select>
                </div>
                <button 
                    onClick={calculateFinancialPlan2026}
                    className="px-6 py-3 text-sm font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 transition-colors shadow-sm"
                >
                    Gerar/Atualizar Planejamento Financeiro
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                {/* Com a 4ª aba, a barra rola na horizontal no celular em vez de alargar a página. */}
                <div className="border-b border-gray-200 overflow-x-auto">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    activeTab === tab.id
                                    ? 'border-brand-orange text-brand-orange'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="mt-6">
                    {activeTab === 'dre' && (
                        <>
                            <FinancialStatementTable title="DRE - Demonstrativo de Resultados" data={planData.financialPlan2026.dre} rows={DRE_ROWS} />
                            <ExplanationBox title="O que é o DRE?">
                                <p>O DRE (Demonstrativo do Resultado do Exercício) é um relatório que evidencia se as operações da empresa estão gerando lucro ou prejuízo, confrontando receitas, custos e despesas.</p>
                                <p><strong>Principais Indicadores:</strong> Lucro Bruto, EBITDA e Lucro Líquido.</p>
                            </ExplanationBox>
                        </>
                    )}
                    {activeTab === 'dfc' && (
                        <>
                            <FinancialStatementTable title="DFC - Demonstrativo de Fluxo de Caixa" data={planData.financialPlan2026.dfc} rows={DFC_ROWS} />
                             <ExplanationBox title="O que é o DFC?">
                                <p>O DFC (Demonstrativo de Fluxo de Caixa) mostra as entradas e saídas de dinheiro do caixa da empresa, classificadas em atividades operacionais, de investimento e de financiamento.</p>
                                <p><strong>Principal Indicador:</strong> Saldo Final de Caixa, que indica a saúde financeira e a liquidez da empresa.</p>
                            </ExplanationBox>
                        </>
                    )}
                    {activeTab === 'bp' && (
                        <>
                             <FinancialStatementTable title="BP - Balanço Patrimonial (Simplificado)" data={planData.financialPlan2026.bp} rows={BP_ROWS} isBalanceSheet={true} />
                             <ExplanationBox title="O que é o BP?">
                                <p>O Balanço Patrimonial é uma "fotografia" da situação patrimonial e financeira da empresa em uma data específica, listando seus Bens e Direitos (Ativos) e suas Obrigações (Passivo + Patrimônio Líquido).</p>
                                <p><strong>Dica de Visualização:</strong> A coluna "Saldo Dez/{String(anoPlano).slice(-2)}" mostra como você terminará o ano. Diferente do DRE, o BP não se soma mês a mês, pois representa o saldo acumulado.</p>
                            </ExplanationBox>
                        </>
                    )}
                    {activeTab === 'investimentos' && <InvestimentosFinanciamentos2026 />}
                </div>
            </div>
        </div>
    );
};

export default FinancialPlanning2026;
