
# MANUAL DO USUÁRIO - PLAN
## Sistema de Planejamento Estratégico e Financeiro

Este documento serve como guia para a utilização da plataforma PLAN, explicando o fluxo de trabalho sugerido e, principalmente, **como os dados estão interligados**.

**Qual ano?** O PLAN é sempre o planejamento do **ano seguinte ao atual**: em 2026 você planeja 2027, em 2027 planeja 2028, e assim por diante. Neste manual, "ano do plano" é o ano que você está planejando e "ano base" é o ano anterior a ele, cujos números reais você informa. Ao virar o ano, o plano novo é criado sozinho a partir do anterior (perfil, produtos, mercado e regime tributário vêm junto; os números começam em branco), e os planos antigos continuam acessíveis no seletor de ano.

---

## 1. O Fluxo de Trabalho (Workflow)

O sistema foi desenhado para ser preenchido em uma ordem lógica, onde a etapa anterior alimenta a próxima. Recomenda-se seguir a numeração do menu lateral:

1.  **Diagnóstico (Abas 1 a 3):** Olhar para o retrovisor (o ano base) e para o mercado.
2.  **Definição (Abas 4 a 8):** Definir onde queremos chegar (Metas) e como (Planos de Ação).
3.  **Projeção (Abas 9 a 10):** Traduzir as metas em números financeiros (Orçamento).
4.  **Controle (Abas 11 a 13):** Acompanhar a execução mês a mês.

---

## 2. Mapa de Conexões de Dados (O "Cérebro" do Sistema)

É fundamental entender que **o sistema é integrado**. Alterar um dado em uma aba pode impactar resultados em várias outras.

### A. Conexões Financeiras Principais

| Dado de Origem | Onde é inserido? | Onde ele impacta/O que ele gera? |
| :--- | :--- | :--- |
| **Dados do ano base** | Aba 1 (Coleta de Dados) | Base para **todas** as projeções do ano do plano. O sistema projeta o crescimento sobre essa base histórica. |
| **Regime Tributário** | Aba 2 (Impostos) | Calcula automaticamente a linha de "Impostos sobre Vendas" e o "Lucro Líquido" na DRE e no Simulador de Preços. |
| **Investimentos (CAPEX)** | Aba 1 (Investimentos) | 1. Reduz o Caixa no **DFC** (Fluxo de Investimento).<br>2. Aumenta o Ativo Não Circulante no **Balanço Patrimonial**.<br>3. Gera Depreciação automática na **DRE**. |
| **Capital de Giro (PMR/PMP)**| Aba 1 (Investimentos) | Calcula a necessidade de caixa. Se você vender mais (Cenários), o sistema calcula automaticamente o impacto no **Caixa (DFC)** baseado nesses prazos. |
| **Financiamentos** | Aba 1 (Investimentos) | 1. Entra como Dinheiro no **DFC**.<br>2. Aumenta o Passivo (Dívida) no **Balanço Patrimonial**. |

### B. Conexões Estratégicas (Growth Drivers)

| Dado de Origem | Onde é inserido? | Onde ele impacta/O que ele gera? |
| :--- | :--- | :--- |
| **Metas de RH** (Turnover/Treinamento) | Aba 4 (Metas) | Gera o **"Fator de Produtividade"**. Se a meta for melhor que o realizado do ano base, o sistema adiciona um bônus de crescimento na receita do Orçamento (Aba 9). |
| **Inflação Prevista** | Aba 4 (Metas) | Reajusta automaticamente todos os **Custos Fixos** (Aluguel, Energia, Administrativo) na projeção do ano do plano (Aba 9). |
| **Pontuação Estratégica** | Aba 3 (Análise) | A soma dos scores (SWOT, Oceano Azul, etc.) cria um **"Fator Estratégico"** que ajusta a projeção de crescimento nos Cenários Otimista/Conservador. |
| **Orçamento de Canais** | Aba 6 (Comercial) | O valor total orçado para Marketing aqui é comparado com a projeção financeira para garantir coerência. |

---

## 3. Guia Passo a Passo por Módulo

### FASE 1: DIAGNÓSTICO

*   **1. Coleta de Dados (ano base):**
    *   *Dica:* Use o botão "Colar Dados do Excel" se tiver uma planilha.
    *   *Atenção:* Não deixe meses em branco. Se não tiver o dado exato, estime uma média. O sistema precisa desses números para calcular a sazonalidade do ano do plano.
    *   *Investimentos:* Preencha o CAPEX e Prazos Médios aqui para que o Balanço Patrimonial funcione.

*   **2. Impostos:**
    *   Configure seu regime (Simples, Presumido, Real). O sistema usará a "Alíquota Efetiva" para projetar os impostos futuros.

*   **3. Análise Estratégica:**
    *   Preencha a SWOT e a Curva de Valor.
    *   *Importante:* Utilize as barras deslizantes de "Impacto" na SWOT. Elas alimentam o algoritmo que define se sua estratégia está impulsionando ou freando o orçamento.

### FASE 2: PLANEJAMENTO

*   **4. Metas & Objetivos:**
    *   Defina a "Inflação Prevista" (ex: 4.5%). Isso corrigirá seus custos automaticamente.
    *   As metas financeiras aqui servem de "Farol". O sistema irá comparar sua Projeção (Aba 9) com essas Metas para mostrar se você está longe ou perto.

*   **6. Plan. Comercial & RH:**
    *   *Funil:* Simule quantos leads precisa para bater a meta. O sistema calcula o número de vendedores necessários ("Headcount").
    *   *RH:* Use a tabela de contratações para orçar o aumento de folha. Verifique se esse valor cabe no orçamento financeiro da Aba 9.

*   **9. Orçamento & Cenários (O Coração do Sistema):**
    *   Escolha o modo **"% Crescimento"** para uma projeção rápida baseada no histórico + inflação + estratégia.
    *   Escolha o modo **"Manual"** para ajustar linha a linha (ex: sabe que o aluguel vai subir em Março? Ajuste manualmente).
    *   *Botão Gatilhos IA:* Gera sugestões de quando você deve mudar de estratégia (ex: "Se a receita cair 10% por 2 meses, corte custos").

*   **10. Planejamento Financeiro:**
    *   Clique em "Gerar Planejamento".
    *   O sistema processará DRE, Fluxo de Caixa e Balanço Patrimonial integrando todas as abas anteriores.

### FASE 3: EXECUÇÃO

*   **12. Acompanhamento (Mensal):**
    *   Todo mês, preencha a coluna "Realizado".
    *   O sistema comparará com o seu "Cenário Base" (definido na Aba 10).
    *   *Forecast:* O sistema recalcula o final do ano combinando o que já aconteceu (Realizado) com o que está previsto (Projeção), dando uma visão realista do fechamento do ano.

---

## 4. Utilizando a Inteligência Artificial (Gemini)

O sistema possui botões de IA espalhados pelas telas. Eles não são apenas geradores de texto aleatório; eles leem os dados que você inseriu.

*   **Diagnóstico (Dashboard):** Lê seus dados do ano base e compara com benchmarks de mercado.
*   **Análise de Cenários (Aba 9):** Lê seus números projetados e aponta riscos de coerência (ex: "Você quer crescer 50% mas reduziu o budget de marketing?").
*   **Plano de Ação (Aba 8/11):** Gera tarefas 5W2H baseadas nas suas fraquezas da SWOT e nos gaps financeiros.
*   **Editor de Imagem:** Ferramenta auxiliar para criar criativos rápidos para testes de marketing.

---

## 5. Dúvidas Frequentes

**P: Alterei o investimento em Marketing na aba 6, ele muda automático na DRE (Aba 9)?**
R: Não automaticamente. A aba 6 serve para você planejar a *demanda* e o *mix de canais*. Após definir o valor total lá, você deve ir na Aba 9 (modo Manual) e ajustar a linha de Marketing para refletir esse novo orçamento, ou ajustar a porcentagem de crescimento para comportar esse investimento. Isso é feito para garantir que o gestor tenha o controle final do orçamento.

**P: Meu Balanço Patrimonial não fecha.**
R: O sistema usa um modelo simplificado de partidas dobradas. Verifique se você preencheu o "Saldo Inicial de Caixa" (implícito no DFC) e se os prazos médios (PMR, PMP) na aba 1 estão coerentes com a realidade.

**P: Como imprimo um relatório para a diretoria/sócios?**
R: Vá na aba "Relatórios & Impressão" ou clique no botão "Imprimir" no topo das abas de Cenários e Acompanhamento. O sistema gera uma versão limpa, focada em dados, pronta para PDF.
