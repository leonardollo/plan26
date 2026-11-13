
import React, { useState } from 'react';
import { authService, usePlan } from '../hooks/usePlanData';
import { CHECKOUT, linkDoCheckout } from '../utils/checkout';

const SubscriptionExpiredPage: React.FC<{ 
    status: 'expired' | 'not_found' | 'inactive',
    onLogout: () => void 
}> = ({ status, onLogout }) => {
    const { checkSubscription } = usePlan();
    const [isChecking, setIsChecking] = useState(false);

    const handleCheckAgain = async () => {
        setIsChecking(true);
        await checkSubscription();
        setIsChecking(false);
    };

    const messages = {
        expired: {
            title: "Sua assinatura expirou",
            body: "Para continuar utilizando o PLAN e acessar seu planejamento, por favor, renove sua assinatura anual.",
            button: "Renovar Assinatura"
        },
        not_found: {
            title: "Assinatura não encontrada",
            body: "Não encontramos uma assinatura ativa para sua conta. Se você acabou de comprar, aguarde alguns minutos e tente novamente. Se o problema persistir, entre em contato com o suporte.",
            button: "Comprar Assinatura"
        },
        inactive: {
            title: "Assinatura Cancelada ou Reembolsada",
            body: "Detectamos que sua assinatura foi cancelada, reembolsada ou está em atraso. Por isso, seu acesso foi suspenso. Se isso for um erro, entre em contato com o suporte.",
            button: "Reativar Assinatura"
        }
    };

    const content = messages[status] || messages.expired;

    return (
        <div className="min-h-screen bg-brand-light-gray flex flex-col justify-center items-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-lg text-center">
                 <h1 className="text-4xl font-bold text-gray-900 tracking-wider">GESTÃO DE IMPACTO</h1>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">{content.title}</h2>
                <p className="mt-4 text-gray-600">{content.body}</p>
                
                {status === 'not_found' && (
                     <button
                        onClick={handleCheckAgain}
                        disabled={isChecking}
                        className="mt-6 w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-brand-blue hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:bg-gray-400"
                    >
                        {isChecking ? 'Verificando...' : 'Já realizei o pagamento / Verificar Novamente'}
                    </button>
                )}

                {/* why: sem checkout configurado, nenhum botão de pagar que leve a lugar nenhum. */}
                {CHECKOUT ? (
                    <a
                        href={linkDoCheckout(CHECKOUT, authService.emailAtual())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-brand-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange"
                    >
                        {content.button}
                    </a>
                ) : (
                    <p className="mt-4 text-lg font-medium text-gray-700">Fale com a Gestão de Impacto</p>
                )}
                <button 
                    onClick={onLogout}
                    className="mt-6 text-sm text-gray-500 hover:text-gray-700 hover:underline"
                >
                    Sair da conta
                </button>
            </div>
        </div>
    );
};

export default SubscriptionExpiredPage;
