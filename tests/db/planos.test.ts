import { describe, expect, it } from 'vitest';
import { anoUtc, criarPessoa, emailUnico } from './ambiente';
import {
  carregarPlano, criarPlanoSeNaoExistir, listarPlanos, salvarPlano, type DadosDoPlano,
} from '../../src/services/planos';

// O mínimo que montarPlanoDoAnoSeguinte lê; o resto do plano não importa aqui.
const iniciais = {
  planData: { companyProfile: { name: '', cnpj: '', industry: '', geminiApiKey: '' }, productPortfolio: [], marketAnalysis: {} },
  goals2026: {},
  scenarios2026: {},
  tracking2026: {},
  taxes: {},
  pricingItems: [],
} as unknown as DadosDoPlano;

const comEmpresa = (nome: string): DadosDoPlano => ({
  ...iniciais,
  planData: { ...iniciais.planData, companyProfile: { ...iniciais.planData.companyProfile, name: nome } },
});

describe('planos no Supabase', () => {
  it('salvarPlano e carregarPlano devolvem os mesmos dados; listarPlanos traz os anos em ordem', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('planos'), status: 'liberado' });
    await salvarPlano(cliente, id, 2027, comEmpresa('B'));
    await salvarPlano(cliente, id, 2026, comEmpresa('A'));
    expect(await carregarPlano(cliente, id, 2026)).toEqual(comEmpresa('A'));
    // Gravar de novo o mesmo ano troca os dados, não duplica.
    await salvarPlano(cliente, id, 2026, comEmpresa('A2'));
    expect((await carregarPlano(cliente, id, 2026))?.planData?.companyProfile.name).toBe('A2');
    expect(await listarPlanos(cliente, id)).toEqual([2026, 2027]);
  });

  it('ano sem plano: carregarPlano devolve null', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('planos'), status: 'liberado' });
    expect(await carregarPlano(cliente, id, 2027)).toBeNull();
    expect(await listarPlanos(cliente, id)).toEqual([]);
  });

  it('criarPlanoSeNaoExistir copia o cadastro da origem', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('planos'), status: 'liberado' });
    await salvarPlano(cliente, id, 2026, comEmpresa('Empresa A'));
    await criarPlanoSeNaoExistir(cliente, id, 2027, 2026, iniciais);
    expect((await carregarPlano(cliente, id, 2027))?.planData?.companyProfile.name).toBe('Empresa A');
  });

  it('chamar de novo depois de editar o ano novo não sobrescreve a edição (duas abas)', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('planos'), status: 'liberado' });
    await salvarPlano(cliente, id, 2026, comEmpresa('Empresa A'));
    await criarPlanoSeNaoExistir(cliente, id, 2027, 2026, iniciais);
    await salvarPlano(cliente, id, 2027, comEmpresa('Editada'));
    await criarPlanoSeNaoExistir(cliente, id, 2027, 2026, iniciais);
    expect((await carregarPlano(cliente, id, 2027))?.planData?.companyProfile.name).toBe('Editada');
  });

  it('criarPlanoSeNaoExistir para o ano UTC atual + 2 rejeita (relógio adiantado)', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('planos'), status: 'liberado' });
    await salvarPlano(cliente, id, 2026, comEmpresa('Empresa A'));
    await expect(criarPlanoSeNaoExistir(cliente, id, anoUtc() + 2, 2026, iniciais)).rejects.toBeTruthy();
    expect(await listarPlanos(cliente, id)).toEqual([2026]);
  });

  it('salvarPlano de um cliente pendente rejeita: gravação recusada não passa calada', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('planos') });
    await expect(salvarPlano(cliente, id, 2027, comEmpresa('X'))).rejects.toBeTruthy();
  });
});
