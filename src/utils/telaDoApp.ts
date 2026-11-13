import type { EstadoDaCarga, SubscriptionStatus } from '../types';
import type { StatusAcesso } from '../services/acesso';

export type TelaDoApp = 'conferindo' | 'aguardando' | 'expirado' | 'verificar_email' | 'abrindo_plano' | 'erro_ao_abrir' | 'app';

/**
 * Qual tela o MainLayout mostra. O acesso decide primeiro; com acesso ativo,
 * o app só abre depois que o plano foi lido — editar antes disso seria editar
 * um plano vazio que depois sobrescreveria o real.
 */
export function telaDoApp(status: SubscriptionStatus, carga: EstadoDaCarga): TelaDoApp {
    switch (status) {
        case 'loading': return 'conferindo';
        case 'not_found':
        case 'inactive': return 'aguardando';
        case 'expired': return 'expirado';
        case 'verificar_email': return 'verificar_email';
        case 'active':
            if (carga === 'carregado') return 'app';
            return carga === 'falhou' ? 'erro_ao_abrir' : 'abrindo_plano';
    }
}

/**
 * O que o status de acesso de quem não é admin dá ao app. Removido é tratado como bloqueado: não entra.
 * Liberado com prazo vencido (prazo <= agora, como no banco) expira; sem prazo, não vence nunca.
 */
export function situacaoDoAcesso(status: StatusAcesso, acessoAte?: string | null, agora: Date = new Date()): SubscriptionStatus {
    switch (status) {
        case 'liberado':
            return acessoAte && new Date(acessoAte).getTime() <= agora.getTime() ? 'expired' : 'active';
        case 'bloqueado':
        case 'removido': return 'inactive';
        case 'pendente': return 'not_found';
    }
}
