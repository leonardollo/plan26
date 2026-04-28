
import React, { useState, useMemo } from 'react';
import FinancialDataRow from './shared/FinancialDataRow';
import { usePlan } from '../hooks/usePlanData';
import { MONTHS, MONTH_LABELS, Month, MonthlyData } from '../types';
import CommercialDataSheet from './shared/CommercialDataSheet';
import PeopleDataSheet from './shared/PeopleDataSheet';
import MarketingDataSheet from './shared/MarketingDataSheet';
import InvestmentDataSheet from './shared/InvestmentDataSheet';
import PasteDataModal from './shared/PasteDataModal';

type DataCategory = 'financialSheet' | 'commercial' | 'people' | 'marketing' | 'investment';
const sumMonthlyData = (data: MonthlyData): number => data ? Object.values(data).reduce((sum, val) => sum + (val || 0), 0) : 0;

const DataCollection: React.FC = () => {
    const [activeTab, setActiveTab] = useState<DataCategory>('financialSheet');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { 
        planData, 
        updateSheetValue, 
        updateSheetAllValues, 
        updateCustomItem, 
        updateCustomItemAllValues,
        addCustomItem, 
        removeCustomItem, 
        updateCommercialData, 
        updatePeopleData, 
        updateMarketingData, 
        updateInvestmentData, 
        summary2025, 
        importFinancialDataFromTsv, 
        taxes,
        applyTaxesTo2025
    } = usePlan();

    const { financialSheet } = planData;

    const TABS: { id: DataCategory; label: string; }[] = [
        { id: 'financialSheet', label: 'Dados Financeiros' },
        { id: 'commercial', label: 'Comercial & Drivers' },
        { id: 'people', label: 'Pessoas' },
        { id: 'marketing', label: 'Marketing' },
        { id: 'investment', label: 'Investimentos'},
    ];
    
    // --- CALCULATIONS for display ---
    const receitaLiquida2025 = summary2025.receitaTotal;
    const totalCustosVariaveis2025 = summary2025.custosVariaveisTotal;
    const lucroBruto2025 = summary2025.margemBruta;
    const totalCustosFixos2025 = summary2025.despesasTotal;
    const ebitda2025 = summary2025.ebitda;
    const margemEbitda2025 = summary2025.margemEbitda;

    const receitaLiquidaRow = useMemo(() => {
        const values: MonthlyData = {};
        summary2025.monthlySummary.forEach(m => {
            values[m.month as Month] = m.receita;
        });
        return { values2025: values };
    }, [summary2025.monthlySummary]);

    const custosVariaveisRow = useMemo(() => {
        const values: MonthlyData = {};
        summary2025.monthlySummary.forEach(m => { values[m.month as Month] = m.custosVariaveis; });
        return { values2025: values };
    }, [summary2025.monthlySummary]);

    const lucroBrutoRow = useMemo(() => {
        const values: MonthlyData = {};
        summary2025.monthlySummary.forEach(m => {
            values[m.month as Month] = m.receita - m.custosVariaveis; // Corrected: Net Revenue - Variable Costs
        });
        return { values2025: values };
    }, [summary2025.monthlySummary]);

    const custosFixosRow = useMemo(() => {
        const values: MonthlyData = {};
        summary2025.monthlySummary.forEach(m => { values[m.month as Month] = m.custosFixos; });
        return { values2025: values };
    }, [summary2025.monthlySummary]);

    const ebitdaRow = useMemo(() => {
        const values: MonthlyData = {};
        summary2025.monthlySummary.forEach(m => {
            values[m.month as Month] = m.ebitda;
        });
        return { values2025: values };
    }, [summary2025.monthlySummary]);

    const margemEbitdaRow = useMemo(() => {
        const values: MonthlyData = {};
        summary2025.monthlySummary.forEach(m => {
            const margem = m.receita > 0 ? (m.ebitda / m.receita) * 100 : 0;
            values[m.month as Month] = margem;
        });
        return { values2025: values };
    }, [summary2025.monthlySummary]);

    const lucroLiquidoRow = useMemo(() => {
        const irpj = taxes?.irpj == null ? 15 : taxes.irpj;
        const csll = taxes?.csll == null ? 9 : taxes.csll;
        const taxRate = (irpj + csll) / 100;
        const values: MonthlyData = {};
        summary2025.monthlySummary.forEach(m => {
            const ebitda = m.ebitda;
            // Approximation as Depreciation and Financial Expenses for 2025 are not available
            const lucroAntesImpostos = ebitda;
            const impostoRenda = lucroAntesImpostos > 0 ? lucroAntesImpostos * taxRate : 0;
            values[m.month as Month] = lucroAntesImpostos - impostoRenda;
        });
        return { values2025: values };
    }, [summary2025.monthlySummary, taxes]);

    const ticketMedioRow = useMemo(() => {
        const values: MonthlyData = {};
        MONTHS.forEach(m => {
            const rev = financialSheet.receitaBruta.values2025?.[m] || 0;
            const clients = planData.commercial.clientes.totalClientesAtivos?.[m] || 0;
            values[m] = clients > 0 ? rev / clients : 0;
        });
        return { values2025: values };
    }, [financialSheet.receitaBruta, planData.commercial.clientes.totalClientesAtivos]);


    const renderFinancialSheet = () => (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="min-w-full text-sm">
                 <thead className="bg-gray-50 text-gray-500">
                    <tr>
                        <th className="sticky left-0 bg-gray-50 z-10 p-3 text-left font-semibold" style={{width: '250px'}}>Indicador</th>
                        <th className="p-3 text-left font-semibold">Instruções</th>
                        <th className="p-3 text-right font-semibold">Total 2025</th>
                        {MONTHS.map(m => <th key={`25-${m}`} className="p-2 text-center font-medium">{MONTH_LABELS[m]}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {/* RECEITA */}
                    <tr className="bg-orange-50/50"><td colSpan={15} className="p-2.5 font-bold text-orange-700 text-sm">RECEITA</td></tr>
                    <FinancialDataRow label="Receita Bruta Total (R$)" rowData={{ values: financialSheet.receitaBruta.values2025 }} onUpdate={(m, v) => updateSheetValue('receitaBruta', m, v)} onUpdateAll={(v) => updateSheetAllValues('receitaBruta', v)} hint="Faturamento total"/>
                    <FinancialDataRow 
                        label="(-) Impostos (R$)" 
                        rowData={{ values: financialSheet.impostosSobreFaturamento.values2025 }} 
                        onUpdate={(m, v) => updateSheetValue('impostosSobreFaturamento', m, v)} 
                        onUpdateAll={(v) => updateSheetAllValues('impostosSobreFaturamento', v)} 
                        hint="Da aba Impostos" 
                        actionButton={
                            <button 
                                onClick={taxes ? () => { if(window.confirm('Deseja recalcular os impostos com base na configuração da Aba 2? Isso sobrescreverá os valores atuais.')) applyTaxesTo2025() } : undefined}
                                className="ml-2 text-xs bg-brand-orange text-white px-2 py-1 rounded hover:bg-orange-600"
                                title="Recalcular com base na Aba 2"
                            >
                                Calcular
                            </button>
                        }
                    />
                    <FinancialDataRow label="Receita Líquida (R$)" rowData={{ values: receitaLiquidaRow.values2025 }} calculatedValue={receitaLiquida2025} isTotal={true} />
                    <FinancialDataRow label="Ticket Médio (R$)" rowData={{ values: ticketMedioRow.values2025 }} calculatedValue={summary2025.ticketMedio} isTotal={true} hint="Receita / Nº Clientes"/>

                    {/* CUSTOS FIXOS */}
                    <tr className="bg-blue-50/50"><td colSpan={15} className="p-2.5 font-bold text-blue-700 text-sm">CUSTOS FIXOS</td></tr>
                    <FinancialDataRow label="Folha de Pagamento (R$)" rowData={{ values: financialSheet.folhaPagamento.values2025 }} onUpdate={(m, v) => updateSheetValue('folhaPagamento', m, v)} onUpdateAll={(v) => updateSheetAllValues('folhaPagamento', v)} hint="Salários + Encargos"/>
                    <FinancialDataRow label="Aluguel (R$)" rowData={{ values: financialSheet.aluguel.values2025 }} onUpdate={(m, v) => updateSheetValue('aluguel', m, v)} onUpdateAll={(v) => updateSheetAllValues('aluguel', v)} hint="Infraestrutura"/>
                    <FinancialDataRow label="Despesas Operacionais (R$)" rowData={{ values: financialSheet.despesasOperacionais.values2025 }} onUpdate={(m, v) => updateSheetValue('despesasOperacionais', m, v)} onUpdateAll={(v) => updateSheetAllValues('despesasOperacionais', v)} hint="Água, luz, internet"/>
                    <FinancialDataRow label="Marketing (R$)" rowData={{ values: financialSheet.marketingFixo.values2025 }} onUpdate={(m, v) => updateSheetValue('marketingFixo', m, v)} onUpdateAll={(v) => updateSheetAllValues('marketingFixo', v)} hint="Marketing fixo"/>
                    <FinancialDataRow label="Administrativo (R$)" rowData={{ values: financialSheet.administrativo.values2025 }} onUpdate={(m, v) => updateSheetValue('administrativo', m, v)} onUpdateAll={(v) => updateSheetAllValues('administrativo', v)} hint="Contabilidade, juri"/>
                    {(financialSheet.customCustosFixos || []).map(item => (
                         <FinancialDataRow key={item.id} label={item.name} hint={item.hint} rowData={{ values: item.values2025 }} onUpdateName={(name) => updateCustomItem('customCustosFixos', item.id, 'name', name)} onUpdateHint={(hint) => updateCustomItem('customCustosFixos', item.id, 'hint', hint)} onUpdate={(m, v) => updateCustomItem('customCustosFixos', item.id, m, v)} onUpdateAll={(v) => updateCustomItemAllValues('customCustosFixos', item.id, v)} onRemove={() => removeCustomItem('customCustosFixos', item.id)} isCustom={true} />
                    ))}
                     <tr><td className="sticky left-0 bg-white z-10 p-3"><button onClick={() => addCustomItem('customCustosFixos')} className="text-brand-orange font-semibold hover:text-orange-700">+ Adicionar Custo Fixo</button></td><td colSpan={14}></td></tr>
                    <FinancialDataRow label="Total Custos Fixos (R$)" rowData={{ values: custosFixosRow.values2025 }} calculatedValue={totalCustosFixos2025} isTotal={true}/>

                    {/* CUSTOS VARIÁVEIS */}
                    <tr className="bg-amber-50/50"><td colSpan={15} className="p-2.5 font-bold text-amber-700 text-sm">CUSTOS VARIÁVEIS</td></tr>
                    <FinancialDataRow label="CMV (R$)" rowData={{ values: financialSheet.cmv.values2025 }} onUpdate={(m, v) => updateSheetValue('cmv', m, v)} onUpdateAll={(v) => updateSheetAllValues('cmv', v)} hint="Custo direto prod."/>
                    <FinancialDataRow label="Comissões (R$)" rowData={{ values: financialSheet.comissoes.values2025 }} onUpdate={(m, v) => updateSheetValue('comissoes', m, v)} onUpdateAll={(v) => updateSheetAllValues('comissoes', v)} hint="Comissão de vendas"/>
                    <FinancialDataRow label="Fretes (R$)" rowData={{ values: financialSheet.fretes.values2025 }} onUpdate={(m, v) => updateSheetValue('fretes', m, v)} onUpdateAll={(v) => updateSheetAllValues('fretes', v)} hint="Logística"/>
                    {(financialSheet.customCustosVariaveis || []).map(item => (
                         <FinancialDataRow key={item.id} label={item.name} hint={item.hint} rowData={{ values: item.values2025 }} onUpdateName={(name) => updateCustomItem('customCustosVariaveis', item.id, 'name', name)} onUpdateHint={(hint) => updateCustomItem('customCustosVariaveis', item.id, 'hint', hint)} onUpdate={(m, v) => updateCustomItem('customCustosVariaveis', item.id, m, v)} onUpdateAll={(v) => updateCustomItemAllValues('customCustosVariaveis', item.id, v)} onRemove={() => removeCustomItem('customCustosVariaveis', item.id)} isCustom={true} />
                    ))}
                    <tr><td className="sticky left-0 bg-white z-10 p-3"><button onClick={() => addCustomItem('customCustosVariaveis')} className="text-brand-orange font-semibold hover:text-orange-700">+ Adicionar Custo Variável</button></td><td colSpan={14}></td></tr>
                    <FinancialDataRow label="Total Custos Variáveis (R$)" rowData={{ values: custosVariaveisRow.values2025 }} calculatedValue={totalCustosVariaveis2025} isTotal={true}/>
                    
                    {/* RESULTADOS */}
                    <tr className="bg-emerald-50/50"><td colSpan={15} className="p-2.5 font-bold text-emerald-700 text-sm">RESULTADOS</td></tr>
                    <FinancialDataRow label="Lucro Bruto (R$)" rowData={{ values: lucroBrutoRow.values2025 }} calculatedValue={lucroBruto2025} isTotal={true} hint="Receita Líquida - Custos Variáveis"/>
                    <FinancialDataRow label="EBITDA (R$)" rowData={{ values: ebitdaRow.values2025 }} calculatedValue={ebitda2025} isTotal={true} hint="Lucro Bruto - Custos Fixos"/>
                    <FinancialDataRow label="Margem EBITDA (%)" rowData={{ values: margemEbitdaRow.values2025 }} calculatedValue={margemEbitda2025} isPercentage={true} isTotal={true} hint="(EBITDA / Receita Líquida)"/>
                    <FinancialDataRow label="Lucro Líquido (R$)" rowData={{ values: lucroLiquidoRow.values2025 }} calculatedValue={sumMonthlyData(lucroLiquidoRow.values2025)} isTotal={true} hint="EBITDA - Depreciação - Juros - Impostos"/>
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-8">
             <PasteDataModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onImport={importFinancialDataFromTsv}
                title="Colar Dados Financeiros do Excel"
            />
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                 <div className="flex flex-wrap gap-4 justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Coleta de Dados 2025</h1>
                        <p className="text-gray-500 mt-1">
                            Insira os dados historicos de 2025. Esta e a base para a analise estrategica e todo o planejamento de 2026.
                        </p>
                    </div>
                    {activeTab === 'financialSheet' && <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 shadow-md shadow-orange-200 btn-glow shadow-sm text-sm transition-colors"><svg className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' /></svg>Colar Dados do Excel</button>}
                </div>
            </header>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`${
                                    activeTab === tab.id
                                    ? 'border-brand-orange text-brand-orange'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm sm:text-base`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="mt-6">
                    {activeTab === 'financialSheet' && renderFinancialSheet()}
                    {activeTab === 'commercial' && (
                        <CommercialDataSheet 
                            data={planData.commercial}
                            onUpdate={updateCommercialData}
                        />
                    )}
                    {activeTab === 'people' && (
                         <PeopleDataSheet
                            data={planData.people}
                            onUpdate={updatePeopleData}
                        />
                    )}
                    {activeTab === 'marketing' && (
                         <MarketingDataSheet
                            data={planData.marketing}
                            onUpdate={updateMarketingData}
                            summary={summary2025}
                            financialSheet={planData.financialSheet}
                            commercial={planData.commercial} // Commercial data passed here
                        />
                    )}
                    {activeTab === 'investment' && (
                         <InvestmentDataSheet
                            data={planData.investment}
                            onUpdate={updateInvestmentData}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataCollection;
