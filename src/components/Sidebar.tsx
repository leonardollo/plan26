
import React, { useState } from 'react';
import type { View } from '../types';
import { User } from '../types';
import { usePlan } from '../hooks/usePlanData';
import clsx from 'clsx';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  user: User | null;
  onLogout: () => void;
}

const NavButton: React.FC<{
  id: View;
  label: string;
  icon: React.ReactNode;
  currentView: View;
  onClick: () => void;
}> = ({ id, label, icon, currentView, onClick }) => {
    const isActive = currentView === id;
    return (
        <button
            onClick={onClick}
            className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left group",
                isActive
                    ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
            )}
        >
            <span className={clsx(
                "flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
            )}>
                {icon}
            </span>
            <span className="text-sm font-medium truncate">{label}</span>
        </button>
    );
};

const SectionTitle: React.FC<{ title: string; icon?: string }> = ({ title, icon }) => (
    <div className="flex items-center gap-2 px-3 mt-6 mb-2">
        {icon && <span className="text-xs">{icon}</span>}
        <h2 className="text-[10px] font-bold text-brand-orange uppercase tracking-widest">{title}</h2>
    </div>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, user, onLogout }) => {
  const { saveStatus, saveDataNow } = usePlan();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const handleLogout = async () => {
      setIsLoggingOut(true);
      if (saveStatus === 'unsaved' || saveStatus === 'saving') {
          await saveDataNow();
      }
      onLogout();
  };

  // Ícones SVG consistentes (h-5 w-5)
  const icons = {
    dashboard: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    settings: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    clipboard: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    scale: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
    search: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    trending: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    target: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9 9 0 100-18 9 9 0 000 18z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15a3 3 0 100-6 3 3 0 000 6z" /></svg>,
    people: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    funnel: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
    checklist: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    grid: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    chart: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    info: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    calendar: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    bars: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    droplet: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21c-4.418 0-8-3.134-8-7 0-3.866 8-14 8-14s8 10.134 8 14c0 3.866-3.582 7-8 7z" /></svg>,
    pie: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
    matrix: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
    printer: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
    calculator: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    image: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    helpGuide: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  };

  return (
    <div className={clsx(
        "bg-gradient-to-b from-brand-dark to-[#111827] text-brand-gray flex flex-col h-full no-print transition-all duration-300",
        isCollapsed ? "w-20" : "w-72"
    )}>
      {/* Header com Logo */}
      <div className="flex flex-col items-center border-b border-white/10 flex-shrink-0 px-4 py-4">
         {!isCollapsed && (
            <div className="flex flex-col items-center gap-1">
                <img src="/logo-gi.png" alt="Gestão de Impacto" className="h-10 w-auto object-contain" />
                <span className="text-[10px] font-semibold text-brand-orange uppercase tracking-[0.2em]">Planejamento Estratégico</span>
            </div>
         )}
         {isCollapsed && (
            <img src="/logo-gi.png" alt="GI" className="h-8 w-auto object-contain" />
         )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5 scrollbar-thin">
        <NavButton id="dashboard" label="Dashboard" icon={icons.dashboard} currentView={currentView} onClick={() => setCurrentView('dashboard')} />
        <NavButton id="settings" label="Configurações" icon={icons.settings} currentView={currentView} onClick={() => setCurrentView('settings')} />

        <SectionTitle title="Diagnóstico" />
        <NavButton id="import-dpe" label="Importar do Diagnóstico" icon={icons.clipboard} currentView={currentView} onClick={() => setCurrentView('import-dpe')} />
        <NavButton id="data-collection" label="Coleta de Dados 2025" icon={icons.clipboard} currentView={currentView} onClick={() => setCurrentView('data-collection')} />
        <NavButton id="taxes" label="Impostos" icon={icons.scale} currentView={currentView} onClick={() => setCurrentView('taxes')} />
        <NavButton id="strategic-analysis" label="Análise Estratégica" icon={icons.search} currentView={currentView} onClick={() => setCurrentView('strategic-analysis')} />
        
        <SectionTitle title="Planejamento 2026" />
        <NavButton id="goal-setting" label="Metas e Objetivos" icon={icons.trending} currentView={currentView} onClick={() => setCurrentView('goal-setting')} />
        <NavButton id="okrs-kpis" label="OKRs e KPIs" icon={icons.target} currentView={currentView} onClick={() => setCurrentView('okrs-kpis')} />
        <NavButton id="commercial-planning" label="Comercial e RH" icon={icons.people} currentView={currentView} onClick={() => setCurrentView('commercial-planning')} />
        <NavButton id="marketing-funnel" label="Funil de Marketing" icon={icons.funnel} currentView={currentView} onClick={() => setCurrentView('marketing-funnel')} />
        <NavButton id="action-plan" label="Plano de Ação" icon={icons.checklist} currentView={currentView} onClick={() => setCurrentView('action-plan')} />
        <NavButton id="scenario-planning" label="Orçamento e Cenários" icon={icons.grid} currentView={currentView} onClick={() => setCurrentView('scenario-planning')} />
        <NavButton id="financial-planning" label="Planejamento Financeiro" icon={icons.chart} currentView={currentView} onClick={() => setCurrentView('financial-planning')} />
        <NavButton id="plan-summary" label="Resumo do Plano" icon={icons.info} currentView={currentView} onClick={() => setCurrentView('plan-summary')} />

        <SectionTitle title="Execução" />
        <NavButton id="monthly-tracking" label="Acompanhamento Mensal" icon={icons.calendar} currentView={currentView} onClick={() => setCurrentView('monthly-tracking')} />
        <NavButton id="dre-comparison" label="Comparativo DRE" icon={icons.bars} currentView={currentView} onClick={() => setCurrentView('dre-comparison')} />

        <SectionTitle title="Gestão Financeira" />
        <NavButton id="liquidity-dashboard" label="Caixa e Liquidez" icon={icons.droplet} currentView={currentView} onClick={() => setCurrentView('liquidity-dashboard')} />
        <NavButton id="financial-ratios" label="KPIs Financeiros" icon={icons.pie} currentView={currentView} onClick={() => setCurrentView('financial-ratios')} />
        <NavButton id="sensitivity-analysis" label="Matriz de Sensibilidade" icon={icons.matrix} currentView={currentView} onClick={() => setCurrentView('sensitivity-analysis')} />

        <SectionTitle title="Ferramentas" />
        <NavButton id="report-generator" label="Relatórios" icon={icons.printer} currentView={currentView} onClick={() => setCurrentView('report-generator')} />
        <NavButton id="pricing-calculator" label="Precificação Estratégica" icon={icons.calculator} currentView={currentView} onClick={() => setCurrentView('pricing-calculator')} />
        <NavButton id="help-guide" label="Guia de Uso" icon={icons.helpGuide} currentView={currentView} onClick={() => setCurrentView('help-guide')} />
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/10 mt-auto flex-shrink-0 space-y-2">
            {/* Save Status */}
            <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                    {saveStatus === 'saving' && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>}
                    {saveStatus === 'saved' && <span className="w-2 h-2 rounded-full bg-green-400"></span>}
                    {saveStatus === 'unsaved' && <span className="w-2 h-2 rounded-full bg-red-400"></span>}
                    {saveStatus === 'error' && <span className="w-2 h-2 rounded-full bg-red-600"></span>}
                    <span className="text-xs text-gray-400">
                        {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : saveStatus === 'unsaved' ? 'Alterado' : saveStatus === 'error' ? 'Erro' : ''}
                    </span>
                </div>
                <button 
                    onClick={() => saveDataNow()}
                    disabled={saveStatus === 'saving'}
                    className={clsx(
                        "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                        saveStatus === 'unsaved' 
                            ? 'bg-brand-orange text-white hover:bg-orange-600' 
                            : 'bg-white/10 text-gray-400 hover:bg-white/15'
                    )}
                >
                    Salvar
                </button>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 p-2">
                <div className="w-9 h-9 rounded-full bg-brand-orange/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-orange font-bold text-sm">
                        {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm truncate">{user?.name || 'Usuario'}</div>
                    <div className="text-[11px] text-gray-500 truncate">{user?.email}</div>
                </div>
                <button 
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                    title="Sair"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
      </div>
    </div>
  );
};

export default Sidebar;
