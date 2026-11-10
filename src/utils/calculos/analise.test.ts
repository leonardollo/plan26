import { describe, expect, it } from 'vitest';
import { bonusDeProdutividade, scoreEstrategico } from './analise';

const mercado = (taxaCrescimentoMercado: number) => ({
    marketCompetition: { taxaCrescimentoMercado },
    swot: { strengthsImpact: 1, weaknessesImpact: 1, opportunitiesImpact: 1, threatsImpact: 1 },
    blueOcean: { factors: [{ yourCompanyScore: 3, competitorScore: 3 }] },
    bowmanClockProducts: [],
}) as any;

const metas = { metaHeadcount: 0, metaTurnover: 0, metaRoiTreinamento: 0 } as any;

describe('scoreEstrategico', () => {
    it('mercado crescendo 12% e o resto neutro: +3', () => {
        expect(scoreEstrategico(mercado(12), []).total).toBeCloseTo(3);
    });

    it('mercado não preenchido (0%): −1,5', () => {
        expect(scoreEstrategico(mercado(0), []).total).toBeCloseTo(-1.5);
    });
});

describe('bonusDeProdutividade', () => {
    it('10 pessoas, 2 desligamentos, meta de turnover 0: bônus 3 (teto) e receita projetada 1,236 mi', () => {
        const people = {
            headcount: { totalColaboradores: { jan: 10 }, desligamentosVoluntarios: { jan: 2 }, desligamentosInvoluntarios: {} },
            custos: { folhaTotalAnual: {} },
            treinamento: { investimentoTD: {}, ganhoTreinamento: {} },
        } as any;
        const r = bonusDeProdutividade(people, { jan: 1200000 }, metas);
        expect(r.productivityGainFactor).toBeCloseTo(3);
        expect(r.projectedRevenue).toBeCloseTo(1236000);
    });

    it('plano antigo sem os blocos de pessoas: bônus 0, sem erro (roda dentro da carga)', () => {
        expect(bonusDeProdutividade({} as any, undefined, undefined as any)).toEqual({ productivityGainFactor: 0, projectedRevenue: 0 });
    });
});
