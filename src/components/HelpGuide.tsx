import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
import type { AnosDoPlano } from '../services/planos';

type PhaseKey = 'diagnóstico' | 'direcao' | 'plano' | 'orçamento' | 'execução' | 'cfo' | 'ferramentas';

interface GuideSection {
  id: string;
  number: number;
  title: string;
  phase: PhaseKey;
  icon: string;
  whatIs: string;
  howTo: string[];
  connection: string;
  tips: string[];
}

// Os textos do guia citam os anos do plano aberto, por isso são montados a cada render.
const fasesDoGuia = ({ anoPlano, anoBase }: AnosDoPlano): { key: PhaseKey; label: string; color: string; bgColor: string; borderColor: string; description: string }[] => [
  { key: 'diagnóstico', label: 'Fase 1: Diagnóstico', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', description: `Onde estamos? Colete e análise os dados de ${anoBase}.` },
  { key: 'direcao', label: 'Fase 2: Direção', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', description: `Para onde vamos? Defina metas e objetivos para ${anoPlano}.` },
  { key: 'plano', label: 'Fase 3: Plano de Ação', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', description: 'Como chegaremos lá? Planeje as ações comerciais, de marketing e operacionais.' },
  { key: 'orçamento', label: 'Fase 4: Orçamento', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', description: 'Quanto custará? Projete cenários e monte o planejamento financeiro.' },
  { key: 'execução', label: 'Fase 5: Execução e Controle', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', description: 'Acompanhe o realizado vs. planejado mês a mês.' },
  { key: 'cfo', label: 'Análise CFO', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', description: 'Visão financeira avançada: liquidez, KPIs e simulações.' },
  { key: 'ferramentas', label: 'Ferramentas de Apoio', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', description: 'Calculadoras, relatórios e configurações.' },
];

const secoesDoGuia = ({ anoPlano, anoBase }: AnosDoPlano): GuideSection[] => [
  {
    id: 'coleta', number: 1, title: `Coleta de Dados ${anoBase}`, phase: 'diagnóstico',
    icon: '📊',
    whatIs: `O ponto de partida de todo o planejamento. Aqui você insere todos os dados financeiros e operacionais reais da sua empresa em ${anoBase}. É a base que alimenta TODAS as outras ferramentas do sistema.`,
    howTo: [
      `Acesse a aba "Coleta de Dados ${anoBase}" no menu lateral.`,
      'Você verá 5 planilhas: Financeiro, Comercial, Pessoas, Marketing e Investimentos.',
      `Em cada planilha, preencha os valores mensais de janeiro a dezembro de ${anoBase}.`,
      'Na planilha FINANCEIRO: insira Receita Bruta, Custos Fixos, Custos Variáveis, Despesas Operacionais, etc.',
      'Na planilha COMERCIAL: insira Número de Clientes, Ticket Médio, Taxa de Conversão, etc.',
      'Na planilha PESSOAS: insira Headcount, Turnover, Investimento em Treinamento, Absenteísmo, etc.',
      'Na planilha MARKETING: insira Investimento em Marketing, Leads, CAC, LTV, etc.',
      'Na planilha INVESTIMENTOS: insira Capex, Investimentos em Tecnologia, etc.',
      'O sistema consolida automaticamente os totais anuais e calcula indicadores como Margem EBITDA, LTV/CAC, Ponto de Equilíbrio, etc.',
    ],
    connection: `Os dados inseridos aqui alimentam TODAS as outras abas: o Dashboard mostra os KPIs, os Impostos calculam sobre a receita, a Análise Estratégica usa os dados para posicionamento, as Metas comparam ${anoBase} vs. ${anoPlano}, e os Cenários projetam a partir desses números.`,
    tips: [
      'Preencha com dados reais, não estimativas. Quanto mais preciso, melhor o planejamento.',
      'Se não tiver o dado mensal, divida o valor anual por 12.',
      'Comece pelo Financeiro, pois é o mais importante.',
    ],
  },
  {
    id: 'impostos', number: 2, title: 'Impostos', phase: 'diagnóstico',
    icon: '🏛️',
    whatIs: `Ferramenta para calcular a carga tributária da sua empresa em ${anoBase}. O imposto é fundamental para calcular a Receita Líquida, que é a base de todo o planejamento financeiro.`,
    howTo: [
      'Acesse a aba "Impostos" no menu lateral.',
      'Selecione seu regime tributário: Simples Nacional, Lucro Presumido ou Lucro Real.',
      'Preencha as alíquotas de cada imposto (ISS, PIS, COFINS, IRPJ, CSLL, etc.).',
      'O sistema calcula automaticamente o imposto total com base na Receita Bruta informada na Coleta de Dados.',
      'Veja o resumo com: Receita Bruta, Total de Impostos, Alíquota Efetiva e Receita Líquida.',
      `Clique em "Aplicar aos Dados de ${anoBase}" para que o imposto seja usado em todos os cálculos do sistema.`,
    ],
    connection: 'O valor do imposto calculado aqui é subtraído da Receita Bruta para gerar a Receita Líquida. Essa Receita Líquida é usada no Dashboard, nos Cenários, no Planejamento Financeiro e em todas as análises de margem.',
    tips: [
      'Se você está no Simples Nacional, a alíquota varia conforme a faixa de faturamento. Consulte seu contador.',
      `Sempre clique em "Aplicar aos Dados de ${anoBase}" após preencher.`,
    ],
  },
  {
    id: 'estratégica', number: 3, title: 'Análise Estratégica', phase: 'diagnóstico',
    icon: '🎯',
    whatIs: 'Um conjunto de 3 ferramentas clássicas de estratégia para analisar o posicionamento da sua empresa no mercado: Análise SWOT, Estratégia do Oceano Azul e Relógio Estratégico de Bowman.',
    howTo: [
      'Acesse a aba "Análise Estratégica" no menu lateral.',
      'SWOT: Preencha pelo menos 3 itens em cada quadrante (Forças, Fraquezas, Oportunidades, Ameaças). A IA pode gerar sugestões.',
      'OCEANO AZUL: Avalie de 1 a 10 os atributos de valor da sua empresa e dos concorrentes. Identifique onde você pode criar um "oceano azul" (mercado sem concorrência).',
      'BOWMAN: Posicione sua empresa no gráfico de Preço vs. Valor Percebido. O sistema identifica automaticamente sua posição estratégica (Diferenciação, Liderança em Custo, etc.).',
      'Após preencher as 3 ferramentas, o sistema gera um Score Estratégico de 0 a 100.',
    ],
    connection: 'O Score Estratégico gerado aqui é usado na aba Orçamento e Cenários como "Fator Estratégico". Quanto maior o score, maior o potencial de crescimento projetado nos cenários. Também alimenta as sugestões de metas da IA.',
    tips: [
      'Seja honesto na SWOT. Não esconda fraquezas.',
      'No Oceano Azul, foque nos atributos que o cliente mais valoriza.',
      'No Bowman, pense no que o cliente percebe, não no que você acha.',
    ],
  },
  {
    id: 'metas', number: 4, title: 'Metas e Objetivos', phase: 'direcao',
    icon: '🎯',
    whatIs: `O coração do planejamento. Aqui você define ONDE quer chegar em ${anoPlano}. As metas definidas aqui alimentam praticamente todas as outras abas do sistema. É a decisão mais importante do CEO.`,
    howTo: [
      'Acesse a aba "Metas e Objetivos" no menu lateral.',
      `Defina a INFLAÇÃO PREVISTA para ${anoPlano} (usada para ajustar custos).`,
      `METAS FINANCEIRAS: Defina a Meta de Receita mensal para ${anoPlano}, Meta de Margem Líquida e Meta de EBITDA.`,
      'METAS COMERCIAIS: Defina o Ticket Médio desejado e a Meta de Novos Clientes por mês.',
      'METAS DE PESSOAS: Defina a Meta de Turnover (quanto quer reduzir), Meta de ROI de Treinamento e Headcount projetado.',
      `OBJETIVOS ESTRATÉGICOS: Escreva de 3 a 5 objetivos estratégicos para ${anoPlano} (ex: "Aumentar a participação de mercado em 15%").`,
      `Use o botão "Gerar Sugestões com IA" para que o sistema sugira metas com base nos seus dados de ${anoBase}.`,
    ],
    connection: 'As metas definidas aqui alimentam: OKRs e KPIs (desdobramento dos objetivos), Comercial e RH (metas de contratação e vendas), Orçamento e Cenários (projeção de receita), Bônus de Produtividade (metas de RH), Resumo do Plano (consolidação) e Relatórios (análise completa).',
    tips: [
      'Defina metas desafiadoras mas realistas. A IA ajuda a calibrar.',
      'A meta de Turnover deve ser MENOR que o atual (você quer reduzir).',
      'Os Objetivos Estratégicos devem ser específicos e mensuráveis.',
    ],
  },
  {
    id: 'okrs', number: 5, title: 'OKRs e KPIs', phase: 'direcao',
    icon: '📈',
    whatIs: 'Ferramenta para desdobrar os objetivos estratégicos em Objetivos e Resultados-Chave (OKRs) e Indicadores de Performance (KPIs). Traduz a estratégia em ações mensuráveis.',
    howTo: [
      'Acesse a aba "OKRs e KPIs" no menu lateral.',
      'Clique em "Gerar Sugestões com IA" para que o sistema crie OKRs baseados nos seus objetivos estratégicos.',
      'Para cada OKR, você verá: um Objetivo e 2-4 Resultados-Chave com metas numéricas.',
      'Edite os valores das metas conforme necessário.',
      'Na seção de KPIs, defina os indicadores que você vai acompanhar mensalmente.',
    ],
    connection: 'Os OKRs são gerados a partir dos Objetivos Estratégicos definidos na aba Metas. Os KPIs são usados no Acompanhamento Mensal para medir o progresso.',
    tips: [
      'Cada OKR deve ter no máximo 4 Resultados-Chave.',
      'Os Resultados-Chave devem ser numéricos (ex: "Aumentar NPS de 7 para 9").',
      'Revise os OKRs trimestralmente.',
    ],
  },
  {
    id: 'comercial', number: 6, title: 'Comercial e RH', phase: 'plano',
    icon: '👥',
    whatIs: 'Planejamento integrado de vendas e pessoas. Define os canais de demanda, projeta contratações e simula o impacto de diferentes estratégias comerciais na receita.',
    howTo: [
      'Acesse a aba "Comercial e RH" no menu lateral.',
      'Na seção CANAIS DE DEMANDA: Adicione seus canais de venda (Google Ads, Indicação, Redes Sociais, etc.) com o investimento e retorno esperado.',
      `Na seção PROJEÇÃO DE CONTRATAÇÕES: Defina as contratações previstas para ${anoPlano}, com cargo, salário e mês de entrada.`,
      'Na seção DRIVER-BASED PLANNING: Simule cenários alterando variáveis como "Se aumentar o ticket médio em 10%, qual o impacto na receita?".',
      'O sistema mostra automaticamente as metas de RH vindas da aba Metas (Turnover, ROI Treinamento, Headcount).',
    ],
    connection: 'Recebe as metas de RH e comerciais da aba Metas. O planejamento de canais alimenta o Funil de Marketing. As contratações impactam os custos no Planejamento Financeiro.',
    tips: [
      'Não esqueça de incluir o custo de contratação (recrutamento, treinamento).',
      'Use o Driver-Based Planning para testar hipóteses antes de decidir.',
    ],
  },
  {
    id: 'funil', number: 7, title: 'Funil de Marketing', phase: 'plano',
    icon: '📣',
    whatIs: `Projeção completa do funil de marketing e vendas para ${anoPlano}. Mostra quantos visitantes, leads, oportunidades e clientes você precisa gerar para atingir as metas.`,
    howTo: [
      'Acesse a aba "Funil de Marketing" no menu lateral.',
      'Visualize o funil projetado com base nos dados do Comercial e RH.',
      'Ajuste as taxas de conversão entre cada etapa do funil se necessário.',
      'O sistema calcula automaticamente quantos leads você precisa gerar por mês.',
    ],
    connection: 'Recebe dados dos Canais de Demanda (Comercial e RH) e das Metas Comerciais. Valida se o plano comercial é realista.',
    tips: [
      'Se o funil mostrar que você precisa de 10.000 leads/mês mas só gera 1.000, revise as metas ou aumente o investimento em marketing.',
    ],
  },
  {
    id: 'ação', number: 8, title: 'Plano de Ação (5W2H)', phase: 'plano',
    icon: '✅',
    whatIs: 'Ferramenta para criar um plano de ação detalhado usando a metodologia 5W2H: O Quê, Por Quê, Onde, Quando, Quem, Como e Quanto Custa.',
    howTo: [
      'Acesse a aba "Plano de Ação" no menu lateral.',
      'Clique em "Adicionar Ação" para criar uma nova tarefa.',
      'Preencha: O que será feito, Por que, Quem é o responsável, Quando (prazo), Onde, Como e Quanto custa.',
      'Atualize o status de cada ação: Não Iniciado, Em Andamento ou Concluído.',
      'Use o botão "Gerar com IA" para que o sistema sugira ações baseadas em todo o planejamento.',
    ],
    connection: 'A IA gera ações baseadas nas Metas, Análise Estratégica e Cenários. O custo das ações pode ser considerado no Planejamento Financeiro.',
    tips: [
      'Cada ação deve ter UM responsável (não "a equipe").',
      'Defina prazos realistas e específicos (não "em breve").',
      'Revise o plano de ação semanalmente.',
    ],
  },
  {
    id: 'cenários', number: 9, title: 'Orçamento e Cenários', phase: 'orçamento',
    icon: '💰',
    whatIs: `A ferramenta mais poderosa do sistema. Projeta a receita para ${anoPlano} em 3 cenários diferentes (Otimista, Conservador e Disruptivo), usando a fórmula: Crescimento Base + Fator Estratégico + Bônus de Produtividade.`,
    howTo: [
      'Acesse a aba "Orçamento e Cenários" no menu lateral.',
      'Veja o COMPARATIVO DOS 3 CENÁRIOS no topo da página.',
      'CENÁRIO OTIMISTA: Calculado automaticamente com base nas suas metas. É o cenário ideal.',
      'CENÁRIO CONSERVADOR: Ajuste o percentual de crescimento para um cenário mais cauteloso (ex: 50% do otimista).',
      'CENÁRIO DISRUPTIVO: Simule um cenário de ruptura (ex: novo produto, novo mercado).',
      'Para cada cenário, veja a projeção mensal de Receita Bruta, Impostos, Receita Líquida e Custos.',
      'Use o botão "Recalcular Todos os Cenários" se os dados base mudaram.',
      'A FÓRMULA DE CRESCIMENTO é: Crescimento Base (%) + Fator Estratégico (baseado no Score da Análise Estratégica) + Bônus de Produtividade (baseado nas metas de RH).',
    ],
    connection: `Recebe: Receita ${anoBase} (Coleta de Dados), Score Estratégico (Análise Estratégica), Metas de RH (Metas e Objetivos). Alimenta: Planejamento Financeiro ${anoPlano} (DRE/DFC/BP projetados).`,
    tips: [
      'O cenário Conservador deve ser o que você usa para tomar decisões de caixa.',
      'O cenário Otimista é a meta. O Disruptivo é para sonhar grande.',
      'Sempre recalcule após alterar dados na Coleta de Dados ou Metas.',
    ],
  },
  {
    id: 'financeiro', number: 10, title: `Planejamento Financeiro ${anoPlano}`, phase: 'orçamento',
    icon: '📋',
    whatIs: `Projeção financeira completa para ${anoPlano}, incluindo DRE (Demonstração do Resultado do Exercício), DFC (Demonstrativo de Fluxo de Caixa) e BP (Balanço Patrimonial). É o resultado final do planejamento orçamentário.`,
    howTo: [
      'Acesse a aba "Planejamento Financeiro" no menu lateral.',
      'Selecione o cenário que deseja visualizar (Otimista, Conservador ou Disruptivo).',
      'Na aba DRE: Veja a projeção de Receita, Custos, Despesas e Lucro mês a mês.',
      'Na aba DFC: Veja a projeção de entradas e saídas de caixa.',
      'Na aba BP: Veja a projeção do Balanço Patrimonial.',
      'Ajuste manualmente qualquer linha se necessário.',
    ],
    connection: `Recebe a projeção de receita dos Cenários e os custos/despesas de ${anoBase} (Coleta de Dados). Alimenta: Resumo do Plano, Caixa e Liquidez, KPIs Financeiros e Matriz de Sensibilidade.`,
    tips: [
      'Compare os 3 cenários para entender o range de possibilidades.',
      'Foque no DFC para garantir que o caixa não fica negativo em nenhum mês.',
    ],
  },
  {
    id: 'resumo', number: 11, title: 'Resumo do Plano', phase: 'execução',
    icon: '📑',
    whatIs: `Dashboard executivo que consolida todos os números do plano ${anoPlano} em uma única tela. Ideal para apresentar ao conselho ou sócios.`,
    howTo: [
      'Acesse a aba "Resumo do Plano" no menu lateral.',
      'Visualize os principais números: Receita Projetada, Margem, EBITDA, Novos Clientes, Ticket Médio, Headcount.',
      'Clique em "Gerar Análise Estratégica com IA" para um texto completo de análise.',
    ],
    connection: 'Consolida dados de: Metas, Cenários, Planejamento Financeiro e Comercial/RH.',
    tips: ['Use esta tela para apresentações ao conselho ou investidores.'],
  },
  {
    id: 'acompanhamento', number: 12, title: 'Acompanhamento Mensal', phase: 'execução',
    icon: '📅',
    whatIs: `Ferramenta de controle para comparar o que foi PLANEJADO vs. o que foi REALIZADO mês a mês durante ${anoPlano}. Mostra desvios e tendências.`,
    howTo: [
      'Acesse a aba "Acompanhamento Mensal" no menu lateral.',
      'A cada mês, preencha a coluna "Realizado" com os valores reais.',
      'O sistema calcula automaticamente: Desvio (R$), Desvio (%) e Tendência.',
      'Veja o gráfico de barras comparando Planejado vs. Realizado.',
      'Use os filtros para ver por trimestre ou semestre.',
    ],
    connection: 'Compara os valores projetados nos Cenários com os valores reais que você insere mensalmente.',
    tips: [
      'Preencha até o dia 5 de cada mês.',
      'Se o desvio for maior que 10%, revise o planejamento.',
    ],
  },
  {
    id: 'dre', number: 13, title: 'Comparativo DRE', phase: 'execução',
    icon: '📊',
    whatIs: `Comparativo detalhado do DRE (Demonstração do Resultado do Exercício) entre ${anoBase} (real) e ${anoPlano} (projetado). Permite entender as variações linha a linha.`,
    howTo: [
      'Acesse a aba "Comparativo DRE" no menu lateral.',
      `Visualize a tabela com: Conta, Valor ${anoBase}, Valor ${anoPlano} Projetado, Variação (R$) e Variação (%).`,
      'Use o filtro de trimestre para focar em períodos específicos.',
      'As linhas são organizadas: primeiro os sub-itens, depois os totais.',
    ],
    connection: `Compara os dados reais de ${anoBase} (Coleta de Dados) com a projeção de ${anoPlano} (Planejamento Financeiro).`,
    tips: ['Foque nas linhas com variação acima de 20% - são as que precisam de mais atenção.'],
  },
  {
    id: 'liquidez', number: 14, title: 'Caixa e Liquidez', phase: 'cfo',
    icon: '💧',
    whatIs: 'Análise da saúde financeira do caixa da empresa. Mostra indicadores como Ponto de Equilíbrio, Ciclo Financeiro, Necessidade de Capital de Giro e Índices de Liquidez.',
    howTo: [
      'Acesse a aba "Caixa e Liquidez" no menu lateral.',
      'Visualize os gauges circulares com os indicadores de liquidez.',
      'PONTO DE EQUILÍBRIO: Quanto você precisa faturar por mês para cobrir todos os custos.',
      'LIQUIDEZ CORRENTE: Se > 1, a empresa consegue pagar suas dívidas de curto prazo.',
      'CAPITAL DE GIRO: Quanto de dinheiro a empresa precisa para operar no dia a dia.',
      `Veja o gráfico de evolução do caixa ao longo de ${anoPlano}.`,
    ],
    connection: `Usa dados do Planejamento Financeiro ${anoPlano} (DFC e BP) para calcular os indicadores.`,
    tips: [
      'Liquidez Corrente abaixo de 1,0 é sinal de alerta.',
      'O Ponto de Equilíbrio deve ser menor que a receita projetada em todos os meses.',
    ],
  },
  {
    id: 'kpis', number: 15, title: 'KPIs Financeiros', phase: 'cfo',
    icon: '📊',
    whatIs: 'Dashboard com os principais indicadores financeiros da empresa, comparados com benchmarks de mercado. Inclui Margem Bruta, Margem EBITDA, ROI, LTV/CAC, entre outros.',
    howTo: [
      'Acesse a aba "KPIs Financeiros" no menu lateral.',
      'Visualize os cards com cada KPI, seu valor atual e o benchmark de mercado.',
      'As barras de progresso mostram se você está acima ou abaixo do benchmark.',
      'Indicadores verdes = saudável. Amarelos = atenção. Vermelhos = crítico.',
    ],
    connection: `Calcula os KPIs a partir dos dados de ${anoBase} (Coleta de Dados) e das projeções de ${anoPlano} (Planejamento Financeiro).`,
    tips: ['Compare seus KPIs com empresas do mesmo setor e porte.'],
  },
  {
    id: 'sensibilidade', number: 16, title: 'Matriz de Sensibilidade', phase: 'cfo',
    icon: '🔬',
    whatIs: 'Ferramenta de simulação que mostra o impacto no lucro ao variar simultaneamente a receita e os custos. Responde perguntas como: "Se a receita cair 10% e os custos subirem 5%, qual será o lucro?".',
    howTo: [
      'Acesse a aba "Matriz de Sensibilidade" no menu lateral.',
      'Veja o RESUMO EXECUTIVO com 4 cards: Melhor Cenário, Pior Cenário, Cenário Base e Margem de Segurança.',
      'Na MATRIZ: As linhas representam variações na receita (-20% a +20%) e as colunas representam variações nos custos (-20% a +20%).',
      'Células verdes = lucro. Células vermelhas = prejuízo.',
      'A célula central (0%, 0%) é o cenário base.',
      'Leia a seção "Como Ler a Matriz" para entender a interpretação.',
    ],
    connection: 'Usa a receita e custos do cenário base (Orçamento e Cenários) para calcular as variações.',
    tips: [
      'Foque na diagonal: se a receita cair E os custos subirem ao mesmo tempo, qual é o impacto?',
      'A Margem de Segurança mostra quanto a receita pode cair antes de dar prejuízo.',
    ],
  },
  {
    id: 'pricing', number: 17, title: 'Precificação Estratégica', phase: 'ferramentas',
    icon: '🧮',
    whatIs: 'Ferramenta profissional de formação de preço usando Markup Divisor, com simulador de descontos, análise de mix (Curva ABC), comparativo com mercado e funil de comportamento comercial.',
    howTo: [
      'CALCULADORA: Defina o item (produto/serviço), preencha custos diretos detalhados, configure impostos, comissões, rateio fixo e margem desejada.',
      'O sistema calcula o preço pelo método do Divisor (Markup por Dentro), garantindo que todas as taxas sejam cobertas.',
      'Use o Fator Comportamental para ajustar o preço conforme diferenciação (commodity vs exclusivo).',
      'Compare com o preço de mercado na seção Referência de Mercado.',
      'SIMULADOR: Teste descontos e veja o impacto no lucro. Descubra quanto precisa vender a mais para compensar.',
      'ITENS SALVOS: Tabela completa com todos os itens precificados, margens e volumes.',
      'MIX & ABC: Curva ABC de margem, ponto de equilíbrio global, jornada do lucro mensal e composição de receita.',
    ],
    connection: 'Puxa automaticamente a alíquota efetiva de impostos e o rateio de custos fixos do Planejamento Financeiro.',
    tips: [
      'Nunca dê desconto sem pedir algo em troca (volume, prazo, indicação).',
      'Use o simulador antes de qualquer negociação para saber seu limite.',
      'Itens classe A na Curva ABC são os que mais contribuem para pagar suas contas.',
      'O ponto de equilíbrio mostra em que dia do mês você começa a lucrar.',
    ],
  },

  {
    id: 'relatórios', number: 19, title: 'Relatórios', phase: 'ferramentas',
    icon: '📄',
    whatIs: `Gera um relatório completo em texto com a análise estratégica e financeira do seu plano ${anoPlano}, usando Inteligência Artificial.`,
    howTo: [
      'Acesse a aba "Relatórios" no menu lateral.',
      'Clique em "Gerar Relatório".',
      'A IA analisa todos os dados do sistema e gera um relatório completo.',
      'O relatório inclui: Análise do cenário atual, Projeções, Riscos, Oportunidades e Recomendações.',
    ],
    connection: 'Usa dados de TODAS as abas para gerar a análise.',
    tips: ['Gere o relatório apenas quando todas as abas estiverem preenchidas.'],
  },
  {
    id: 'config', number: 20, title: 'Configurações', phase: 'ferramentas',
    icon: '⚙️',
    whatIs: 'Configurações gerais da empresa: nome, CNPJ, setor de atuação e dados do perfil.',
    howTo: [
      'Acesse a aba "Configurações" no menu lateral.',
      'Preencha ou atualize: Nome da Empresa, CNPJ, Setor de Atuação.',
      'O CNPJ é usado pela IA para identificar automaticamente o setor da empresa.',
    ],
    connection: 'O nome da empresa aparece nos relatórios. O setor é usado pela IA para contextualizar as análises.',
    tips: ['Preencha o CNPJ para que a IA identifique automaticamente o setor.'],
  },
];

const HelpGuide: React.FC = () => {
  const { anoPlano, anoBase } = usePlan();
  const PHASES = fasesDoGuia({ anoPlano, anoBase });
  const GUIDE_SECTIONS = secoesDoGuia({ anoPlano, anoBase });
  const [activePhase, setActivePhase] = useState<PhaseKey | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);

  const filteredSections = activePhase
    ? GUIDE_SECTIONS.filter(s => s.phase === activePhase)
    : GUIDE_SECTIONS;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="gradient-border bg-white p-8 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Guia Completo de Uso</h1>
            <p className="text-gray-500 mt-1">Entenda cada ferramenta e como elas se conectam para criar seu planejamento estratégico.</p>
          </div>
        </div>
      </div>

      {/* Toggle Map/Guide */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowMap(true)}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${showMap ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
        >
          Mapa de Conexões
        </button>
        <button
          onClick={() => setShowMap(false)}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${!showMap ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
        >
          Passo a Passo Detalhado
        </button>
      </div>

      {/* === MAPA VISUAL === */}
      {showMap && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Como as ferramentas se conectam</h2>
          <p className="text-gray-600 mb-8">O planejamento segue um fluxo lógico de 5 fases. Cada fase alimenta a próxima. Clique em uma fase para ver os detalhes.</p>

          {/* Flow Map */}
          <div className="space-y-6">
            {PHASES.filter(p => p.key !== 'ferramentas').map((phase, idx) => {
              const sections = GUIDE_SECTIONS.filter(s => s.phase === phase.key);
              return (
                <div key={phase.key}>
                  {/* Phase Header */}
                  <div className={`${phase.bgColor} ${phase.borderColor} border rounded-2xl p-6`}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`text-lg font-bold ${phase.color}`}>{phase.label}</span>
                      <span className="text-sm text-gray-500">— {phase.description}</span>
                    </div>
                    {/* Tools in this phase */}
                    <div className="flex flex-wrap gap-3">
                      {sections.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setShowMap(false); setActivePhase(phase.key); setExpandedSection(s.id); }}
                          className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-orange-600"
                        >
                          <span>{s.icon}</span>
                          <span>{s.number}. {s.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Arrow */}
                  {idx < PHASES.filter(p => p.key !== 'ferramentas').length - 1 && (
                    <div className="flex justify-center py-2">
                      <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ferramentas de Apoio */}
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-lg font-bold text-gray-700">Ferramentas de Apoio</span>
                <span className="text-sm text-gray-500">— Disponíveis a qualquer momento, independentes do fluxo.</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {GUIDE_SECTIONS.filter(s => s.phase === 'ferramentas').map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setShowMap(false); setActivePhase('ferramentas'); setExpandedSection(s.id); }}
                    className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-orange-600"
                  >
                    <span>{s.icon}</span>
                    <span>{s.number}. {s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Connection Legend */}
          <div className="mt-8 bg-orange-50 border border-orange-200 rounded-2xl p-6">
            <h3 className="font-bold text-orange-800 mb-3">Resumo das Conexões Principais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <span className="text-orange-500 font-bold mt-0.5">→</span>
                <span><strong>Coleta de Dados</strong> alimenta: Dashboard, Impostos, Análise Estratégica, Metas, Cenários e todas as análises financeiras.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500 font-bold mt-0.5">→</span>
                <span><strong>Impostos</strong> alimenta: Receita Líquida em todo o sistema.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500 font-bold mt-0.5">→</span>
                <span><strong>Análise Estratégica</strong> gera o Score Estratégico que impacta os Cenários.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500 font-bold mt-0.5">→</span>
                <span><strong>Metas</strong> alimenta: OKRs, Comercial/RH, Cenários, Bônus de Produtividade e Resumo.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500 font-bold mt-0.5">→</span>
                <span><strong>Cenários</strong> geram a projeção de receita que alimenta todo o Planejamento Financeiro.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500 font-bold mt-0.5">→</span>
                <span><strong>Planejamento Financeiro</strong> alimenta: Liquidez, KPIs Financeiros e Matriz de Sensibilidade.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === PASSO A PASSO === */}
      {!showMap && (
        <>
          {/* Phase Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setActivePhase(null); setExpandedSection(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${!activePhase ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              Todas ({GUIDE_SECTIONS.length})
            </button>
            {PHASES.map(phase => {
              const count = GUIDE_SECTIONS.filter(s => s.phase === phase.key).length;
              return (
                <button
                  key={phase.key}
                  onClick={() => { setActivePhase(phase.key); setExpandedSection(null); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activePhase === phase.key ? 'bg-gray-900 text-white' : `${phase.bgColor} ${phase.color} border ${phase.borderColor} hover:shadow-sm`}`}
                >
                  {phase.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {filteredSections.map(section => {
              const isExpanded = expandedSection === section.id;
              const phase = PHASES.find(p => p.key === section.phase)!;
              return (
                <div key={section.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-orange-200' : 'hover:shadow-md'}`}>
                  {/* Section Header */}
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{section.icon}</span>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-gray-900">{section.number}. {section.title}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${phase.bgColor} ${phase.color} font-medium`}>{phase.label}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{section.whatIs.substring(0, 100)}...</p>
                      </div>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-6 pb-6 space-y-6 border-t border-gray-100 pt-6">
                      {/* O que é */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-xs text-orange-600 font-bold">?</span>
                          O que é?
                        </h4>
                        <p className="text-gray-700 leading-relaxed">{section.whatIs}</p>
                      </div>

                      {/* Como usar */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs text-blue-600 font-bold">▶</span>
                          Passo a Passo
                        </h4>
                        <div className="space-y-2">
                          {section.howTo.map((step, i) => (
                            <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                              <span className="w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                              <p className="text-gray-700 text-sm">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Conexão */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          Como se conecta com o resto
                        </h4>
                        <p className="text-blue-700 text-sm">{section.connection}</p>
                      </div>

                      {/* Dicas */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                          Dicas do Consultor
                        </h4>
                        <ul className="space-y-1">
                          {section.tips.map((tip, i) => (
                            <li key={i} className="text-amber-700 text-sm flex items-start gap-2">
                              <span className="text-amber-500 mt-1">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-white">
        <h2 className="text-2xl font-bold mb-4">Ordem Recomendada para Preencher</h2>
        <p className="text-gray-300 mb-6">Siga esta ordem para garantir que todos os dados estejam conectados corretamente:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { step: 1, label: 'Configurações', desc: 'Dados da empresa' },
            { step: 2, label: 'Coleta de Dados', desc: `Números de ${anoBase}` },
            { step: 3, label: 'Impostos', desc: 'Carga tributária' },
            { step: 4, label: 'Análise Estratégica', desc: 'SWOT + Oceano Azul + Bowman' },
            { step: 5, label: 'Metas e Objetivos', desc: 'Onde quer chegar' },
            { step: 6, label: 'OKRs e KPIs', desc: 'Desdobrar objetivos' },
            { step: 7, label: 'Comercial e RH', desc: 'Canais e contratações' },
            { step: 8, label: 'Orçamento e Cenários', desc: 'Projetar receita' },
            { step: 9, label: 'Planejamento Financeiro', desc: `DRE/DFC/BP ${anoPlano}` },
            { step: 10, label: 'Resumo e Relatório', desc: 'Consolidar tudo' },
          ].map(item => (
            <div key={item.step} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-sm font-bold">{item.step}</span>
                <span className="font-semibold text-sm">{item.label}</span>
              </div>
              <p className="text-gray-400 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpGuide;
