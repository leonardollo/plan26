
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import DefinirSenha from './components/DefinirSenha';
import OnboardingWizard from './components/OnboardingWizard';
import AguardandoLiberacao from './components/AguardandoLiberacao';
import AreaDoPlano from './components/AreaDoPlano';
import FaixaDoPlanoDoCliente from './components/admin/FaixaDoPlanoDoCliente';
import { PlanoDeCliente, User, View } from './types';
import { PlanProvider, authService, usePlan } from './hooks/usePlanData';
import SubscriptionExpiredPage from './components/SubscriptionExpiredPage';
import ErroAoAbrirPlano from './components/ErroAoAbrirPlano';
import VerificarEmailAdmin from './components/VerificarEmailAdmin';
import { telaDoApp } from './utils/telaDoApp';
import { telaDeEntrada } from './services/supabase';

const LoadingScreen: React.FC<{ message?: string; altura?: string }> = ({ message = 'Carregando...', altura = 'h-screen' }) => (
    <div className={`flex ${altura} w-full items-center justify-center bg-brand-dark`}>
        <div className="text-center animate-fadeIn">
            <img src="/logo-gi.png" alt="Gestão de Impacto" className="h-12 w-auto object-contain mx-auto mb-4 animate-pulse" />
            <div className="w-48 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-orange to-orange-400 rounded-full" style={{ animation: 'shimmer 1.5s ease-in-out infinite', width: '60%' }}></div>
            </div>
            <p className="text-gray-500 font-medium text-xs mt-3 uppercase tracking-wider">{message}</p>
        </div>
    </div>
);

/**
 * Plano de um cliente aberto pelo admin: outro PlanProvider (modo cliente), com a faixa no topo.
 * Sem OnboardingWizard: o assistente é do dono do plano, não do admin.
 */
const PlanoDoClienteAberto: React.FC<{ user: User; onLogout: () => void; onVoltar: () => void }> = ({ user, onLogout, onVoltar }) => {
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const { subscriptionStatus, estadoDaCarga, tentarCarregarDeNovo, saveStatus, saveDataNow } = usePlan();

    // Sair no meio de uma edição grava antes: o autosave espera 3 s e a sessão acaba no logout.
    const sairGravando = async () => {
        if (saveStatus === 'unsaved' || saveStatus === 'saving' || saveStatus === 'error') {
            try { await saveDataNow(); } catch { /* sai mesmo assim, como no plano próprio */ }
        }
        onLogout();
    };

    const tela = telaDoApp(subscriptionStatus, estadoDaCarga);
    return (
        <div className="flex flex-col h-screen">
            <FaixaDoPlanoDoCliente onVoltar={onVoltar} />
            {tela === 'erro_ao_abrir' ? (
                <ErroAoAbrirPlano onTentarDeNovo={tentarCarregarDeNovo} onLogout={sairGravando} />
            ) : tela === 'app' ? (
                <AreaDoPlano user={user} onLogout={sairGravando} currentView={currentView} setCurrentView={setCurrentView} />
            ) : (
                <div className="flex-1 min-h-0"><LoadingScreen altura="h-full" message="Abrindo o plano do cliente..." /></div>
            )}
        </div>
    );
};

const MainLayout: React.FC<{ user: User, onLogout: () => void }> = ({ user, onLogout }) => {
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [planoAberto, setPlanoAberto] = useState<PlanoDeCliente | null>(null);
    const { subscriptionStatus, statusAcesso, estadoDaCarga, tentarCarregarDeNovo } = usePlan();

    switch (telaDoApp(subscriptionStatus, estadoDaCarga)) {
    case 'conferindo':
        return <LoadingScreen message="Conferindo seu acesso..." />;

    // Quem ainda não foi liberado não passa daqui. A tela é só o aviso — quem
    // realmente barra é o RLS do Supabase, que recusa ler e gravar na tabela
    // `planos` enquanto o acesso não estiver liberado.
    case 'aguardando':
        return <AguardandoLiberacao onLogout={onLogout} bloqueado={statusAcesso === 'bloqueado'} removido={statusAcesso === 'removido'} />;

    case 'expirado':
        return <SubscriptionExpiredPage status="expired" onLogout={onLogout} />;

    case 'verificar_email':
        return <VerificarEmailAdmin onLogout={onLogout} />;

    case 'abrindo_plano':
        return <LoadingScreen message="Abrindo seu plano..." />;

    case 'erro_ao_abrir':
        return <ErroAoAbrirPlano onTentarDeNovo={tentarCarregarDeNovo} onLogout={onLogout} />;

    case 'app':
        if (planoAberto) {
            // key: trocar de cliente monta um provider novo, sem herdar estado do anterior.
            return (
                <PlanProvider key={planoAberto.uid} user={user} planoDeCliente={planoAberto}>
                    <PlanoDoClienteAberto
                        user={user}
                        onLogout={onLogout}
                        onVoltar={() => { setPlanoAberto(null); setCurrentView('administracao'); }}
                    />
                </PlanProvider>
            );
        }
        return (
            <div className="flex flex-col h-screen">
                <AreaDoPlano user={user} onLogout={onLogout} currentView={currentView} setCurrentView={setCurrentView} onAbrirPlano={setPlanoAberto}>
                    <OnboardingWizard />
                </AreaDoPlano>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-brand-dark">
            <div className="text-center p-8 bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md animate-fadeIn">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Ocorreu um erro</h2>
                <p className="mt-2 text-sm text-gray-500">Nao foi possivel verificar o estado da sua conta. Por favor, tente sair e entrar novamente.</p>
                <button 
                    onClick={onLogout}
                    className="mt-6 px-6 py-2.5 bg-brand-orange text-white font-semibold rounded-xl hover:bg-orange-700 transition-colors text-sm btn-glow"
                >
                    Sair
                </button>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.subscribe((usuario, evento) => {
      if (usuario) {
        setUser({
          uid: usuario.uid,
          email: usuario.email,
          name: usuario.displayName,
          emailVerified: !!usuario.emailVerified,
        });
      } else {
        setUser(null);
        setRecuperandoSenha(false);
      }
      // Os eventos seguintes (renovar o token, salvar a senha) não desligam a tela: só gravar a senha desliga.
      if (evento?.recuperandoSenha) setRecuperandoSenha(true);
      setIsLoading(false);
    });

    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
        await authService.logout();
    } catch (error) {
        console.error("Error signing out: ", error);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  const tela = telaDeEntrada({ recuperandoSenha, temUsuario: !!user });

  if (tela === 'login' || !user) {
    return <Login />;
  }

  if (tela === 'definir_senha') {
    return <DefinirSenha email={user.email} onConcluido={() => setRecuperandoSenha(false)} />;
  }

  return (
    <PlanProvider user={user}>
      <MainLayout user={user} onLogout={handleLogout} />
    </PlanProvider>
  );
};

export default App;
