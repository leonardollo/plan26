
import React from 'react';
import type { InvestmentData2025 } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import CurrencyInput from './CurrencyInput';
import { usePlan } from '../../hooks/usePlanData';

interface InvestmentDataSheetProps {
  data: InvestmentData2025;
  onUpdate: (section: keyof InvestmentData2025, metric: string, value: string) => void;
}

const InvestmentDataSheet: React.FC<InvestmentDataSheetProps> = ({ data, onUpdate }) => {
    const { anoPlano, anoBase } = usePlan();

    const renderInput = <S extends keyof InvestmentData2025>(
        label: string,
        section: S,
        metric: keyof InvestmentData2025[S],
        hint: string,
        unit: 'R$' | 'dias' | 'none' = 'R$',
        disabled: boolean = false
    ) => {
        const value = (data[section][metric] as number | undefined) ?? null;
        const handleChange = (v: string) => {
            onUpdate(section, metric as string, v);
        }

        return (
            <div>
                <label htmlFor={`${section}-${metric as string}`} className="block text-sm font-medium text-gray-700">{label}</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                    {unit === 'R$' && <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10"><span className="text-gray-500 sm:text-sm">R$</span></div>}
                    <CurrencyInput
                        value={value}
                        onChange={handleChange}
                        className={`block w-full rounded-xl border border-gray-300 shadow-sm focus:border-brand-orange focus:ring-1 focus:ring-brand-orange sm:text-sm p-2.5 ${unit === 'R$' ? 'pl-8' : ''} ${unit === 'dias' ? 'pr-12' : ''} ${disabled ? 'bg-gray-100' : 'bg-white'}`}
                        placeholder="0"
                        disabled={disabled}
                    />
                    {unit === 'dias' && <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 z-10"><span className="text-gray-500 sm:text-sm">dias</span></div>}
                </div>
                {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
            </div>
        );
    };

    // FIX: Calculate total CAPEX dynamically from component state
    const totalCapex = (Number(data.capex.maquinasEquipamentos) || 0) + 
                       (Number(data.capex.software) || 0) + 
                       (Number(data.capex.pesquisaDesenvolvimento) || 0);

    // FIX: Calculate total financing dynamically for display
    const totalFinancing = (Number(data.financing.financiamentoCurtoPrazo) || 0) + 
                          (Number(data.financing.financiamentoLongoPrazo) || 0) + 
                          (Number(data.financing.aporteCapital) || 0);

    // FIX: Calculate Financial Cycle dynamically
    const cicloFinanceiro = (Number(data.workingCapital.prazoMedioRecebimento) || 0) + 
                            (Number(data.workingCapital.prazoMedioEstocagem) || 0) - 
                            (Number(data.workingCapital.prazoMedioPagamento) || 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* CAPEX */}
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-800">CAPEX (Investimentos em Ativos)</h3>
                {renderInput('CAPEX - Maquinas e Equipamentos', 'capex', 'maquinasEquipamentos', 'Compra de novos equipamentos.')}
                {renderInput('CAPEX - Software', 'capex', 'software', 'Licencas, desenvolvimento.')}
                {renderInput('CAPEX - P&D', 'capex', 'pesquisaDesenvolvimento', 'Pesquisa e Desenvolvimento.')}
                <div className="pt-2 border-t mt-4">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total CAPEX {anoBase}</p>
                    <p className="text-2xl font-black text-brand-orange">{formatCurrency(totalCapex)}</p>
                    <p className="text-[10px] text-gray-400 mt-1 italic">*Soma automática dos itens acima</p>
                </div>
            </div>

            {/* Capital de Giro */}
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-800">Capital de Giro</h3>
                {renderInput('Prazo Medio Recebimento (PMR)', 'workingCapital', 'prazoMedioRecebimento', 'Dias para receber de clientes.', 'dias')}
                {renderInput('Prazo Medio Estocagem (PME)', 'workingCapital', 'prazoMedioEstocagem', 'Dias que o produto fica em estoque.', 'dias')}
                {renderInput('Prazo Medio Pagamento (PMP)', 'workingCapital', 'prazoMedioPagamento', 'Dias para pagar fornecedores.', 'dias')}
                <div className="pt-2 border-t mt-4">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Ciclo Financeiro</p>
                    <p className="text-2xl font-black text-brand-blue">{formatNumber(cicloFinanceiro)} dias</p>
                    <p className="text-[10px] text-gray-400 mt-1 italic">Calculo: PMR + PME - PMP</p>
                </div>
            </div>

            {/* Financiamento */}
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-800">Fontes de Financiamento</h3>
                {renderInput('Financiamento Curto Prazo', 'financing', 'financiamentoCurtoPrazo', 'Emprestimos, capital de giro.')}
                {renderInput('Financiamento Longo Prazo', 'financing', 'financiamentoLongoPrazo', 'Para investimentos.')}
                {renderInput('Aporte de Capital', 'financing', 'aporteCapital', 'Investimento dos socios.')}
                
                <div className="pt-4 border-t mt-2">
                    <h4 className="font-bold text-sm text-brand-blue mb-2">Saldo Inicial para {anoPlano}</h4>
                    {renderInput(`Saldo Final de Caixa ${anoBase}`, 'financing', 'saldoCaixaFinal2025', `Dinheiro em conta em 31/12/${anoBase}.`)}
                </div>

                <div className="pt-2 border-t mt-2">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Financiamento</p>
                    <p className="text-2xl font-black text-brand-dark">{formatCurrency(totalFinancing)}</p>
                </div>
            </div>
        </div>
    );
};

export default InvestmentDataSheet;
