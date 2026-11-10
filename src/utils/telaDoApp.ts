import type { EstadoDaCarga, SubscriptionStatus } from '../types';

export type TelaDoApp = 'conferindo' | 'aguardando' | 'expirado' | 'abrindo_plano' | 'erro_ao_abrir' | 'app';

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
        case 'active':
            if (carga === 'carregado') return 'app';
            return carga === 'falhou' ? 'erro_ao_abrir' : 'abrindo_plano';
    }
}
