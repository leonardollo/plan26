/**
 * Importação do Diagnóstico (DPE-GI) para o PLAN 2026
 *
 * O DPE-GI (gestaoimpacto.com/planejamento) é o formulário de diagnóstico que
 * o cliente preenche antes da consultoria. Ele coleta 24 meses de série
 * financeira, portfólio, concorrentes, SWOT, problemas-raiz, drivers e o plano
 * 5W2H. Boa parte disso é exatamente o que o PLAN 2026 pede na Coleta de Dados.
 *
 * Este arquivo é o tradutor entre os dois. É de propósito uma função pura:
 * recebe a foto do diagnóstico, devolve os pedaços de PlanData e Goals2026 mais
 * um relatório do que veio, do que foi estimado e do que continua faltando.
 * Nada de rede, nada de estado — assim dá para testar e para mostrar a prévia
 * antes de qualquer coisa ser gravada.
 *
 * Duas honestidades embutidas no desenho:
 *
 * 1. O que é ESTIMADO aparece marcado como estimado. O DPE coleta o custo fixo
 *    total mês a mês, mas o detalhamento (folha, aluguel, administrativo) só de
 *    um mês. Distribuir esse detalhe pelos 12 meses é uma conta, não um dado, e
 *    o usuário precisa saber disso antes de projetar em cima.
 *
 * 2. O que NÃO veio aparece na lista de faltantes, em vez de virar zero. Zero é
 *    informação; ausência é outra coisa. Confundir os dois destrói a projeção.
 */

import {
  MONTHS,
  Month,
  MonthlyData,
  PlanData,
  Goals2026,
  ProductPortfolioItem,
  ActionPlanItem,
  ActionPlanCategory,
  ActionPlanPriority,
  ActionPlanStatus,
  KPI,
  CompanyProfile,
  FinancialSheetData,
  CommercialData2025,
  PeopleData2025,
  MarketingData2025,
  InvestmentData2025,
  MarketCompetitionData,
  SWOTData,
  OkrsAndKpis,
} from '../types';

/* ------------------------------------------------------------------ */
/* A forma do que vem do DPE                                           */
/* ------------------------------------------------------------------ */

/** Uma linha da série mensal do Bloco 2 do diagnóstico. */
interface LinhaSerie {
  comp?: string; // 'AAAA-MM'
  rb?: string;   // receita bruta
  ded?: string;  // deduções (impostos, devoluções)
  cv?: string;   // custo variável total
  cf?: string;   // custo fixo total
  ped?: string;  // pedidos/contratos fechados
  cli?: string;  // clientes ativos
  leads?: string;
  mkt?: string;  // investimento em marketing
}

export interface FotoDpe {
  /** respostas de campo solto, por chave */
  f?: Record<string, string | string[]>;
  /** fonte declarada de cada dado */
  src?: Record<string, string>;
  /** campos marcados como "não medido" */
  nm?: Record<string, boolean>;
  /** tabelas */
  g?: Record<string, Array<Record<string, string>>>;
  /** quem preencheu */
  id?: { empresa?: string; nome?: string; email?: string; papel?: string };
}

export type Confianca = 'dado' | 'estimado' | 'faltando';

export interface ItemRelatorio {
  destino: string;
  origem: string;
  confianca: Confianca;
  observacao?: string;
}

/**
 * O que a importação devolve para ser aplicado.
 *
 * De propósito NÃO é um `Partial<PlanData>`: espalhar um Partial com `...`
 * substituiria blocos inteiros e apagaria coisa que o usuário já preencheu —
 * o Blue Ocean e o Bowman sumiriam junto com `marketAnalysis`, por exemplo.
 * Aqui cada pedaço é nomeado, e quem aplica junta um por um.
 */
export interface PatchPlano {
  companyProfile?: Partial<CompanyProfile>;
  financialSheet?: Partial<FinancialSheetData>;
  commercial?: CommercialData2025;
  people?: Partial<PeopleData2025>;
  marketing?: Partial<MarketingData2025>;
  investment?: Partial<InvestmentData2025>;
  productPortfolio?: ProductPortfolioItem[];
  actionPlan?: ActionPlanItem[];
  marketCompetition?: MarketCompetitionData;
  swot?: Pick<SWOTData, 'strengths' | 'weaknesses' | 'opportunities' | 'threats'>;
  kpis?: OkrsAndKpis['kpis'];
}

export interface ResultadoImportacao {
  empresa: string;
  anoBase: number | null;
  mesesEncontrados: number;
  patch: PatchPlano;
  goals2026: Partial<Goals2026>;
  relatorio: ItemRelatorio[];
  /** quantos itens de lista serão substituídos, para avisar antes */
  substituira: { portfolio: number; acoes: number; kpis: number };
}

/* ------------------------------------------------------------------ */
/* Ajudantes                                                           */
/* ------------------------------------------------------------------ */

/**
 * O DPE guarda número como texto em português: "1.234.567,89".
 * Devolve null quando não há valor — nunca 0, que significaria outra coisa.
 */
export function numeroBr(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t) return null;
  const limpo = t.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!limpo || limpo === '-') return null;
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

const texto = (v: unknown): string =>
  Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '' : String(v).trim();

const mesVazio = (): MonthlyData => {
  const m: MonthlyData = {};
  MONTHS.forEach((k) => (m[k] = null));
  return m;
};

const soma = (m: MonthlyData): number =>
  Object.values(m).reduce<number>((a, v) => a + (v || 0), 0);

const temAlgum = (m: MonthlyData): boolean => Object.values(m).some((v) => v !== null);

const uid = (prefixo: string, i: number) => `dpe-${prefixo}-${i}-${Math.floor(Math.random() * 1e6)}`;

/**
 * Escolhe os 12 meses que viram "2025" no PLAN.
 *
 * O DPE guarda até 24 meses corridos, que raramente batem com um ano civil.
 * A regra: pega o ano civil mais completo entre os que têm receita. Empate
 * resolve pelo mais recente, que é o que melhor representa a empresa hoje.
 */
export function escolherAnoBase(serie: LinhaSerie[]): number | null {
  const porAno = new Map<number, number>();
  serie.forEach((l) => {
    const ano = parseInt(String(l.comp || '').slice(0, 4), 10);
    if (!Number.isFinite(ano)) return;
    if (numeroBr(l.rb) === null) return;
    porAno.set(ano, (porAno.get(ano) || 0) + 1);
  });
  if (!porAno.size) return null;
  let melhor: number | null = null;
  let melhorQtd = -1;
  [...porAno.entries()]
    .sort((a, b) => a[0] - b[0]) // do mais antigo para o mais novo
    .forEach(([ano, qtd]) => {
      if (qtd >= melhorQtd) {
        melhorQtd = qtd;
        melhor = ano;
      }
    });
  return melhor;
}

/** Distribui as linhas do ano escolhido nos 12 meses do PLAN. */
function serieDoAno(serie: LinhaSerie[], ano: number, campo: keyof LinhaSerie): MonthlyData {
  const saida = mesVazio();
  serie.forEach((l) => {
    const comp = String(l.comp || '');
    if (parseInt(comp.slice(0, 4), 10) !== ano) return;
    const mes = parseInt(comp.slice(5, 7), 10);
    if (!(mes >= 1 && mes <= 12)) return;
    const v = numeroBr(l[campo]);
    if (v !== null) saida[MONTHS[mes - 1]] = v;
  });
  return saida;
}

/**
 * Espalha um valor anual pelos 12 meses seguindo o peso de outra série.
 * Serve para transformar a foto de um mês de custo fixo em doze, respeitando
 * a sazonalidade real da empresa em vez de dividir por 12 às cegas.
 */
function distribuirComoPeso(total: number, pesos: MonthlyData): MonthlyData {
  const somaPesos = soma(pesos);
  const saida = mesVazio();
  if (somaPesos <= 0) {
    MONTHS.forEach((m) => (saida[m] = Math.round((total / 12) * 100) / 100));
    return saida;
  }
  MONTHS.forEach((m) => {
    const p = pesos[m];
    saida[m] = p === null ? null : Math.round(((p / somaPesos) * total) * 100) / 100;
  });
  return saida;
}

/* ------------------------------------------------------------------ */
/* O tradutor                                                          */
/* ------------------------------------------------------------------ */

export function importarDoDiagnostico(foto: FotoDpe): ResultadoImportacao {
  const f = foto.f || {};
  const g = foto.g || {};
  const nm = foto.nm || {};
  const src = foto.src || {};
  const rel: ItemRelatorio[] = [];

  const anota = (destino: string, origem: string, confianca: Confianca, observacao?: string) =>
    rel.push({ destino, origem, confianca, observacao });

  const serie: LinhaSerie[] = (g.serie || []) as LinhaSerie[];
  const ano = escolherAnoBase(serie);
  const doAno = (campo: keyof LinhaSerie) => (ano ? serieDoAno(serie, ano, campo) : mesVazio());

  /* ---------- perfil ---------- */
  const nomeEmpresa = texto(f.fantasia) || texto(f.razao) || texto(foto.id?.empresa);
  const companyProfile = {
    name: nomeEmpresa,
    cnpj: texto(f.cnpj),
    industry: texto(f.setor),
  };
  if (nomeEmpresa) anota('Perfil da empresa', 'Bloco 1 — cadastro', 'dado');

  /* ---------- série financeira ---------- */
  const receitaBruta = doAno('rb');
  const impostos = doAno('ded');
  const custoVariavel = doAno('cv');
  const custoFixoTotal = doAno('cf');
  const marketing = doAno('mkt');
  const mesesEncontrados = Object.values(receitaBruta).filter((v) => v !== null).length;

  if (mesesEncontrados) {
    anota(
      `Receita bruta (${mesesEncontrados} meses de ${ano})`,
      'Bloco 2 — série mensal',
      'dado',
      mesesEncontrados < 12 ? `Faltam ${12 - mesesEncontrados} meses para o ano fechar.` : undefined
    );
    anota('Impostos sobre faturamento', 'Bloco 2 — deduções', 'dado');
    anota(
      'CMV',
      'Bloco 2 — custo variável total',
      'estimado',
      'O diagnóstico junta CMV, comissões e fretes num número só. Tudo entrou como CMV — separe se precisar da margem por linha.'
    );
    anota('Investimento em marketing', 'Bloco 2 — série mensal', 'dado', 'Vai para o módulo de Marketing. No DRE, o marketing entra pela estrutura de custo fixo, para não ser contado duas vezes.');
  } else {
    anota('Série financeira de 2025', 'Bloco 2 — série mensal', 'faltando', 'O diagnóstico não tem nenhum mês com receita preenchida.');
  }

  /* ---------- custo fixo: um mês vira doze ---------- */
  const custoFixoAnual = soma(custoFixoTotal);
  const detalhe: Array<[string, string, string]> = [
    ['folhaPagamento', 'cf_folha', 'Folha de pagamento'],
    ['aluguel', 'cf_ocupacao', 'Aluguel e ocupação'],
    ['marketingFixo', 'cf_mkt', 'Marketing fixo'],
    ['administrativo', 'cf_assessorias', 'Administrativo'],
  ];
  const linhasFixas: Record<string, MonthlyData> = {};
  const detalheMensal = detalhe
    .map(([chavePlan, chaveDpe, rotulo]) => ({ chavePlan, rotulo, valor: numeroBr(f[chaveDpe]) }))
    .filter((d) => d.valor !== null);
  const somaDetalhe = detalheMensal.reduce((a, d) => a + (d.valor as number), 0);

  if (custoFixoAnual > 0 && somaDetalhe > 0) {
    // a proporção do mês fotografado, aplicada ao custo fixo de cada mês
    detalheMensal.forEach((d) => {
      const fatia = (d.valor as number) / somaDetalhe;
      linhasFixas[d.chavePlan] = distribuirComoPeso(custoFixoAnual * fatia, custoFixoTotal);
    });
    // o que sobra do custo fixo total vai para despesas operacionais
    const distribuido = Object.values(linhasFixas).reduce((a, m) => a + soma(m), 0);
    const resto = custoFixoAnual - distribuido;
    if (resto > 1) linhasFixas.despesasOperacionais = distribuirComoPeso(resto, custoFixoTotal);
    anota(
      'Custo fixo aberto por linha',
      'Bloco 2 — estrutura de custo fixo',
      'estimado',
      'O diagnóstico detalha o custo fixo de um mês só. A proporção desse mês foi aplicada aos 12, respeitando a sazonalidade. Confira antes de projetar.'
    );
  } else if (custoFixoAnual > 0) {
    linhasFixas.despesasOperacionais = custoFixoTotal;
    anota(
      'Custo fixo (tudo em Despesas Operacionais)',
      'Bloco 2 — custo fixo total',
      'estimado',
      'O diagnóstico não trouxe a abertura por linha; o total entrou inteiro em Despesas Operacionais.'
    );
  }

  const financialSheet: Partial<PlanData['financialSheet']> = {};
  if (temAlgum(receitaBruta)) financialSheet.receitaBruta = { values2025: receitaBruta };
  if (temAlgum(impostos)) financialSheet.impostosSobreFaturamento = { values2025: impostos };
  if (temAlgum(custoVariavel)) financialSheet.cmv = { values2025: custoVariavel };
  // Marketing NÃO entra aqui a partir da série: ele já está dentro do custo
  // fixo total e é distribuído junto com folha e aluguel logo abaixo. Somar as
  // duas fontes contaria a mesma despesa duas vezes e estouraria o DRE.
  // A série de marketing alimenta o módulo de Marketing, não o DRE.
  Object.entries(linhasFixas).forEach(([k, v]) => {
    (financialSheet as Record<string, unknown>)[k] = { values2025: v };
  });

  /* ---------- comercial ---------- */
  const clientes = doAno('cli');
  const leads = doAno('leads');
  const vendas = doAno('ped');
  const cicloVendas = numeroBr(f.ciclo_venda);
  const commercial: PlanData['commercial'] = {
    clientes: {
      totalClientesAtivos: clientes,
      novosClientes: mesVazio(),
      clientesPerdidos: mesVazio(),
    },
    funilComercial: {
      leadsGerados: leads,
      leadsQualificados: mesVazio(),
      propostasEnviadas: mesVazio(),
      vendasFechadas: vendas,
    },
    pipeline: {
      pipelineAtual: mesVazio(),
      ticketMedioPipeline: mesVazio(),
      cicloVendas: cicloVendas === null ? mesVazio() : distribuirComoPeso(cicloVendas * 12, receitaBruta),
    },
  };
  if (temAlgum(clientes)) anota('Clientes ativos', 'Bloco 2 — série mensal', 'dado');
  if (temAlgum(leads)) anota('Leads gerados', 'Bloco 2 — série mensal', 'dado');
  if (temAlgum(vendas)) anota('Vendas fechadas', 'Bloco 2 — pedidos/contratos', 'dado');
  anota(
    'Leads qualificados e propostas enviadas',
    '—',
    'faltando',
    'O diagnóstico só pergunta leads e vendas. O meio do funil precisa ser preenchido à mão.'
  );

  /* ---------- pessoas ---------- */
  const clt = numeroBr(f.clt) || 0;
  const pj = numeroBr(f.pj) || 0;
  const totalPessoas = clt + pj;
  const people: Partial<PlanData['people']> = {};
  if (totalPessoas > 0) {
    const head = mesVazio();
    MONTHS.forEach((m) => (head[m] = totalPessoas));
    people.headcount = {
      totalColaboradores: head,
      contratacoes: mesVazio(),
      desligamentosVoluntarios: mesVazio(),
      desligamentosInvoluntarios: mesVazio(),
    };
    anota(
      'Headcount',
      'Bloco 1 — time (CLT + PJ)',
      'estimado',
      'O diagnóstico pergunta o time de hoje, não mês a mês. O mesmo número foi repetido nos 12 meses.'
    );
  }

  /* ---------- marketing ---------- */
  const marketingData: Partial<PlanData['marketing']> = {};
  if (temAlgum(marketing)) {
    marketingData.investimentos = {
      investimentoTotal: marketing,
      midiaPaga: mesVazio(),
      conteudo: mesVazio(),
    };
  }

  /* ---------- capital de giro e caixa ---------- */
  const pmr = numeroBr(f.pmr);
  const pmp = numeroBr(f.pmp);
  const giro = nm.giro_est ? null : numeroBr(f.giro_est);
  const investment: Partial<PlanData['investment']> = {
    workingCapital: {
      prazoMedioRecebimento: pmr,
      prazoMedioEstocagem: giro,
      prazoMedioPagamento: pmp,
      cicloFinanceiro: pmr !== null && pmp !== null ? pmr + (giro || 0) - pmp : null,
    },
    financing: {
      financiamentoCurtoPrazo: null,
      financiamentoLongoPrazo: null,
      aporteCapital: null,
      saldoCaixaFinal2025: numeroBr(f.caixa),
    },
  };
  if (pmr !== null || pmp !== null) anota('Prazos e ciclo financeiro', 'Bloco 2 — capital de giro', 'dado');
  if (numeroBr(f.caixa) !== null) anota('Saldo de caixa', 'Bloco 2 — caixa e aplicações', 'dado');

  /* ---------- portfólio ---------- */
  const receitaAno = soma(receitaBruta);
  const productPortfolio: ProductPortfolioItem[] = (g.linhas || [])
    .filter((l) => texto(l.nome))
    .map((l, i) => {
      const pctReceita = numeroBr(l.pct);
      const ticket = numeroBr(l.ticket);
      const mc = numeroBr(l.mc);
      const receita = pctReceita !== null && receitaAno > 0 ? (pctReceita / 100) * receitaAno : null;
      return {
        id: uid('linha', i),
        name: texto(l.nome),
        revenue2025: receita === null ? null : Math.round(receita),
        cost2025: receita === null || mc === null ? null : Math.round(receita * (1 - mc / 100)),
        quantitySold2025: receita === null || !ticket ? null : Math.round(receita / ticket),
      };
    });
  if (productPortfolio.length) {
    anota(
      'Portfólio de produtos',
      'Bloco 1 — linhas de produto',
      'estimado',
      'O diagnóstico pede o % da receita e o ticket de cada linha. Receita, custo e quantidade foram calculados a partir daí.'
    );
  }

  /* ---------- mercado e concorrência ---------- */
  const conc = (g.conc || []).filter((c) => texto(c.nome));
  const maisAmeacador = conc
    .slice()
    .sort((a, b) => (numeroBr(b.ameaca) || 0) - (numeroBr(a.ameaca) || 0))[0];
  const marketCompetition = {
    tamanhoMercado: numeroBr(f.tam),
    taxaCrescimentoMercado: null,
    suaParticipacao: numeroBr(f.share),
    numConcorrentesDiretos: conc.length || null,
    principalConcorrente: maisAmeacador ? texto(maisAmeacador.nome) : '',
    seuDiferencial: texto(f.frase) || texto(f.posicionamento),
  };
  if (conc.length) anota('Concorrentes e mercado', 'Bloco 3 — cenário externo', 'dado');

  /* ---------- SWOT ---------- */
  const porTipo = (tipo: string) =>
    (g.swot || [])
      .filter((s) => texto(s.tipo).toLowerCase().startsWith(tipo))
      .map((s) => '• ' + texto(s.texto) + (texto(s.origem) ? ` (${texto(s.origem)})` : ''))
      .join('\n');
  const swotTexto = {
    strengths: porTipo('for'),
    weaknesses: porTipo('fra'),
    opportunities: porTipo('opo'),
    threats: porTipo('ame'),
  };
  const temSwot = Object.values(swotTexto).some(Boolean);
  if (temSwot) {
    anota(
      'SWOT',
      'Bloco 5 — SWOT rastreável',
      'dado',
      'Cada item veio com a origem entre parênteses: no diagnóstico, item de SWOT sem origem não é aceito.'
    );
  }

  /* ---------- plano de ação 5W2H ---------- */
  const categoriaPor = (frente: string): ActionPlanCategory => {
    const t = frente.toLowerCase();
    if (/venda|comercial|demanda|preç|cliente/.test(t)) return 'Comercial';
    if (/caixa|custo|margem|financ|preço/.test(t)) return 'Financeiro';
    if (/pessoa|time|contrat|soldador|equipe|lider/.test(t)) return 'Pessoas';
    if (/marketing|lead|campanha|tráfego/.test(t)) return 'Marketing';
    if (/process|produç|entrega|projeto|operac|lead time/.test(t)) return 'Operacional';
    return 'Estratégico';
  };
  const statusPor = (s: string): ActionPlanStatus => {
    const t = s.toLowerCase();
    if (t.includes('andamento')) return 'Em Andamento';
    if (t.includes('conclu')) return 'Concluído';
    if (t.includes('atras')) return 'Atrasado';
    return 'Não Iniciado';
  };
  const frentes = g.frentes || [];
  const prioridadePor = (frente: string): ActionPlanPriority => {
    const idx = frentes.findIndex((fr) => texto(fr.nome) === frente);
    if (idx === 0) return 'Alta';
    if (idx === 1) return 'Alta';
    if (idx > 1) return 'Média';
    return 'Média';
  };
  const actionPlan: ActionPlanItem[] = (g.w5h2 || [])
    .filter((a) => texto(a.oque))
    .map((a, i) => {
      const frente = texto(a.frente);
      const impacto = frentes.find((fr) => texto(fr.nome) === frente);
      return {
        id: uid('acao', i),
        what: texto(a.oque),
        why: texto(a.porque),
        who: texto(a.quem),
        when: texto(a.quando),
        where: texto(a.onde),
        how: texto(a.como),
        howMuch: numeroBr(a.quanto),
        status: statusPor(texto(a.status)),
        category: categoriaPor(frente || texto(a.oque)),
        priority: prioridadePor(frente),
        expectedResult: impacto ? texto(impacto.impacto) : '',
      };
    });
  if (actionPlan.length) {
    anota(
      `Plano de ação (${actionPlan.length} ações)`,
      'Bloco 7 — 5W2H',
      'dado',
      'A categoria e a prioridade foram deduzidas da frente a que cada ação pertence — revise.'
    );
  }

  /* ---------- KPIs ---------- */
  const unidadeDe = (v: string): KPI['unit'] => {
    if (/R\$/.test(v)) return 'currency';
    if (/%/.test(v)) return 'percentage';
    return 'number';
  };
  const kpisDpe = (g.kpis || []).filter((k) => texto(k.nome));
  const classificar = (nome: string): keyof OkrsAndKpis['kpis'] => {
    const t = nome.toLowerCase();
    if (/receita|margem|lucro|caixa|receb|custo|ebitda/.test(t)) return 'financeiro';
    if (/convers|venda|client|ticket|lead|propost/.test(t)) return 'comercial';
    if (/turnover|colaborad|treinamento|absente|equipe/.test(t)) return 'pessoas';
    return 'operacoes';
  };
  const kpis: OkrsAndKpis['kpis'] = {
    financeiro: [], comercial: [], pessoas: [], operacoes: [],
  };
  kpisDpe.forEach((k, i) => {
    const item: KPI = {
      id: uid('kpi', i),
      name: texto(k.nome),
      value2025: numeroBr(k.atual),
      target2026: numeroBr(k.meta),
      unit: unidadeDe(texto(k.atual) + texto(k.meta)),
    };
    kpis[classificar(item.name)].push(item);
  });
  if (kpisDpe.length) anota(`Indicadores (${kpisDpe.length})`, 'Bloco 6 — KPIs do ciclo', 'dado');

  /* ---------- metas ---------- */
  const metaReceitaAnual = numeroBr(f.meta_receita);
  const goals2026: Partial<Goals2026> = {};
  if (metaReceitaAnual !== null) {
    goals2026.financeiras = {
      metaReceita: distribuirComoPeso(metaReceitaAnual, receitaBruta),
      metaMargemEbitda: numeroBr(f.meta_mc),
      metaLucroLiquido: numeroBr(f.meta_lucro),
    };
    anota(
      'Meta de receita mensalizada',
      'Bloco 6 — metas do ciclo',
      'estimado',
      'A meta anual foi distribuída pelos 12 meses seguindo a sazonalidade real de ' + (ano ?? 'do ano base') + '.'
    );
  }

  const driver = (nome: RegExp) => (g.drivers || []).find((d) => nome.test(texto(d.nome).toLowerCase()));
  const dTicket = driver(/ticket/);
  const dConv = driver(/convers/);
  if (dTicket || dConv) {
    goals2026.comerciais = {
      metaNumClientes: mesVazio(),
      metaTicketMedio: dTicket ? numeroBr(dTicket.prov) : null,
      metaTaxaConversao: dConv ? numeroBr(dConv.prov) : null,
    };
    anota('Metas comerciais', 'Bloco 6 — árvore de drivers (cenário provável)', 'dado');
  }

  const turnover = numeroBr(f.turnover);
  if (totalPessoas > 0 || turnover !== null) {
    goals2026.pessoas = {
      metaHeadcount: totalPessoas || null,
      metaTurnover: turnover,
      metaInvestimentoTD: null,
      metaRoiTreinamento: null,
      metaAbsenteismo: null,
    };
  }

  const objetivos = frentes.slice(0, 3).map((fr) => texto(fr.nome));
  if (objetivos.length) {
    goals2026.objetivosEstrategicos = {
      objective1: objetivos[0] || '',
      objective2: objetivos[1] || '',
      objective3: objetivos[2] || '',
    };
    anota('Objetivos estratégicos', 'Bloco 7 — as frentes do ciclo', 'dado');
  }

  /* ---------- o que o diagnóstico marcou como não medido ---------- */
  const naoMedidos = Object.keys(nm).filter((k) => nm[k]);
  if (naoMedidos.length) {
    anota(
      'Campos que a empresa não mede',
      'Diagnóstico — marcados como "não medido"',
      'faltando',
      `${naoMedidos.length} campo(s) o cliente declarou não medir. Ficaram vazios de propósito — zero seria mentira.`
    );
  }

  /* ---------- confiabilidade da origem ---------- */
  const comFonte = Object.values(src).filter((v) => ['Sistema', 'Planilha', 'Documento'].includes(v)).length;
  if (comFonte) {
    anota(
      'Rastreabilidade',
      'Diagnóstico — fonte declarada',
      'dado',
      `${comFonte} campo(s) vieram de sistema, planilha ou documento — não de estimativa.`
    );
  }

  const patch: PatchPlano = { companyProfile, commercial };
  if (Object.keys(financialSheet).length) patch.financialSheet = financialSheet;
  if (Object.keys(people).length) patch.people = people;
  if (Object.keys(marketingData).length) patch.marketing = marketingData;
  patch.investment = investment;
  if (productPortfolio.length) patch.productPortfolio = productPortfolio;
  if (actionPlan.length) patch.actionPlan = actionPlan;
  patch.marketCompetition = marketCompetition;
  if (temSwot) patch.swot = swotTexto;
  if (kpisDpe.length) patch.kpis = kpis;

  return {
    empresa: nomeEmpresa,
    anoBase: ano,
    mesesEncontrados,
    patch,
    goals2026,
    relatorio: rel,
    substituira: {
      portfolio: productPortfolio.length,
      acoes: actionPlan.length,
      kpis: kpisDpe.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Buscar a foto no DPE                                                */
/* ------------------------------------------------------------------ */

/** URL e chave pública do Supabase do diagnóstico (a mesma que está na página). */
export const DPE_SUPABASE_URL =
  import.meta.env.VITE_DPE_SUPABASE_URL || 'https://vyacxhqkkekkfytgaklv.supabase.co';
export const DPE_SUPABASE_KEY =
  import.meta.env.VITE_DPE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5YWN4aHFra2Vra2Z5dGdha2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzY3MDUsImV4cCI6MjA4NzExMjcwNX0.vqN-dvjVFn05eLJGhZ_0lf6jCsWVT334bA_XUi6biCs';

export interface LinkDpe {
  plano: string;
  chave: string;
}

/** Aceita o link inteiro do diagnóstico, ou só o par id + chave colado. */
export function lerLink(entrada: string): LinkDpe | null {
  const t = String(entrada || '').trim();
  const p = /[?&]p=([0-9a-fA-F-]{36})/.exec(t) || /\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/.exec(t);
  const c = /[?&]c=([a-z0-9]{8,})/i.exec(t);
  if (!p || !c) return null;
  return { plano: p[1], chave: c[1] };
}

/**
 * Puxa a foto do diagnóstico. A leitura passa por uma função no banco que
 * exige o par id + chave — sem os dois não vem nada, e nunca vem a resposta
 * de outra empresa.
 */
export async function buscarFotoDpe(link: LinkDpe): Promise<FotoDpe> {
  const r = await fetch(`${DPE_SUPABASE_URL}/rest/v1/rpc/dpe_retomar`, {
    method: 'POST',
    headers: {
      apikey: DPE_SUPABASE_KEY,
      Authorization: `Bearer ${DPE_SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_plano: link.plano, p_chave: link.chave }),
  });
  if (!r.ok) throw new Error(`O diagnóstico respondeu ${r.status}. Confira o link.`);
  const dados = await r.json();
  if (!dados || typeof dados !== 'object') {
    throw new Error('Não encontrei nenhum diagnóstico com esse link.');
  }
  return dados as FotoDpe;
}
