import React from 'react';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import DataCollection from './DataCollection';
import GoalSetting from './GoalSetting';
import ScenarioPlanning from './ScenarioPlanning';
import MonthlyTracking from './MonthlyTracking';
import Taxes from './Taxes';
import { StrategicAnalysis } from './StrategicAnalysis';
import ActionPlan from './ActionPlan';
import Settings from './Settings';
import FinancialPlanning2026 from './FinancialPlanning2026';
import CommercialPlanning from './CommercialPlanning';
import OkrsAndKpis from './OkrsAndKpis';
import PlanSummary from './PlanSummary';
import PricingCalculator from './PricingCalculator';
import ReportGenerator from './ReportGenerator';
import MarketingFunnel from './MarketingFunnel';
import DreComparison from './DreComparison';
import LiquidityDashboard from './LiquidityDashboard';
import FinancialRatiosDashboard from './FinancialRatiosDashboard';
import SensitivityAnalysis from './SensitivityAnalysis';
import HelpGuide from './HelpGuide';
import ImportFromDpe from './ImportFromDpe';
import Administracao from './admin/Administracao';
import { PlanoDeCliente, User, View } from '../types';

interface Props {
  user: User;
  onLogout: () => void;
  currentView: View;
  setCurrentView: (v: View) => void;
  /** Só no plano do próprio admin: dentro do plano de um cliente não há Administração. */
  onAbrirPlano?: (c: PlanoDeCliente) => void;
  children?: React.ReactNode;
}

/** Menu + conteúdo do plano, o mesmo para o plano próprio e para o plano de um cliente aberto pelo admin. */
const AreaDoPlano: React.FC<Props> = ({ user, onLogout, currentView, setCurrentView, onAbrirPlano, children }) => {
  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'settings': return <Settings />;
      case 'administracao':
        return onAbrirPlano
          ? <Administracao eu={{ uid: user.uid, email: user.email ?? '' }} onAbrirPlano={onAbrirPlano} />
          : <Dashboard />;
      case 'import-dpe': return <ImportFromDpe />;
      case 'data-collection': return <DataCollection />;
      case 'strategic-analysis': return <StrategicAnalysis />;
      case 'goal-setting': return <GoalSetting />;
      case 'okrs-kpis': return <OkrsAndKpis />;
      case 'commercial-planning': return <CommercialPlanning />;
      case 'marketing-funnel': return <MarketingFunnel />;
      case 'action-plan': return <ActionPlan />;
      case 'scenario-planning': return <ScenarioPlanning />;
      case 'financial-planning': return <FinancialPlanning2026 />;
      case 'plan-summary': return <PlanSummary />;
      case 'monthly-tracking': return <MonthlyTracking />;
      case 'dre-comparison': return <DreComparison />;
      case 'taxes': return <Taxes />;
      case 'pricing-calculator': return <PricingCalculator />;
      case 'report-generator': return <ReportGenerator />;
      case 'liquidity-dashboard': return <LiquidityDashboard />;
      case 'financial-ratios': return <FinancialRatiosDashboard />;
      case 'sensitivity-analysis': return <SensitivityAnalysis />;
      case 'help-guide': return <HelpGuide />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-[#f1f5f9] text-gray-800 relative">
      {children}
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} user={user} onLogout={onLogout} />
      <main className="flex-1 min-h-0 min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10 overflow-y-auto">
        <div className="max-w-7xl mx-auto animate-fadeIn">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default AreaDoPlano;
