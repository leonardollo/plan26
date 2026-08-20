import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
import {
  buscarFotoDpe,
  importarDoDiagnostico,
  lerLink,
  Confianca,
  ResultadoImportacao,
} from '../services/dpeImport';
import { formatCurrency } from '../utils/formatters';

/**
 * Importar do Diagnóstico
 *
 * O cliente preenche o diagnóstico em gestaoimpacto.com/planejamento e recebe
 * um link. Cole o link aqui e o PLAN 2026 se preenche sozinho.
 *
 * Nada é gravado antes da prévia. A prévia mostra três coisas separadas, e a
 * separação é o ponto: o que é dado do cliente, o que foi calculado a partir
 * dele, e o que continua faltando. Projetar em cima de estimativa achando que
 * é dado é o jeito mais rápido de entregar um plano errado com cara de certo.
 */

const CORES: Record<Confianca, { chip: string; borda: string; titulo: string; texto: string }> = {
  dado: {
    chip: 'bg-green-100 text-green-800',
    borda: 'border-green-200',
    titulo: 'Veio do cliente',
    texto: 'Números que a empresa respondeu. Pode projetar em cima.',
  },
  estimado: {
    chip: 'bg-amber-100 text-amber-800',
    borda: 'border-amber-200',
    titulo: 'Calculado a partir do que veio',
    texto: 'Conta feita por nós, não dado do cliente. Confira antes de usar como meta.',
  },
  faltando: {
    chip: 'bg-red-100 text-red-800',
    borda: 'border-red-200',
    titulo: 'Continua faltando',
    texto: 'Ficou vazio de propósito — zero seria mentira. Precisa ser preenchido à mão.',
  },
};

const ImportFromDpe: React.FC = () => {
  const { aplicarImportacaoDpe, planData } = usePlan();
  const [link, setLink] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [previa, setPrevia] = useState<ResultadoImportacao | null>(null);
  const [aplicado, setAplicado] = useState(false);

  const buscar = async () => {
    setErro('');
    setPrevia(null);
    setAplicado(false);
    const alvo = lerLink(link);
    if (!alvo) {
      setErro(
        'Esse link não parece completo. Ele precisa ter as duas partes: o "p=" e o "c=". Peça ao cliente o link inteiro, ou copie do painel do diagnóstico.'
      );
      return;
    }
    setCarregando(true);
    try {
      const foto = await buscarFotoDpe(alvo);
      const r = importarDoDiagnostico(foto);
      if (!r.mesesEncontrados && !r.empresa) {
        setErro('O diagnóstico foi encontrado, mas está praticamente vazio. Peça ao cliente para preencher pelo menos o Bloco 1 e o Bloco 2.');
      } else {
        setPrevia(r);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui buscar o diagnóstico.');
    } finally {
      setCarregando(false);
    }
  };

  const aplicar = () => {
    if (!previa) return;
    aplicarImportacaoDpe(previa.patch, previa.goals2026);
    setAplicado(true);
  };

  const porConfianca = (c: Confianca) => (previa?.relatorio || []).filter((i) => i.confianca === c);

  const jaTemPortfolio = planData.productPortfolio?.length || 0;
  const jaTemAcoes = planData.actionPlan?.length || 0;

  const receitaImportada = previa?.patch.financialSheet?.receitaBruta
    ? Object.values(previa.patch.financialSheet.receitaBruta.values2025).reduce<number>(
        (a, v) => a + (v || 0),
        0
      )
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-dark">Importar do Diagnóstico</h1>
        <p className="text-gray-500 mt-1">
          Traz para cá o que o cliente já respondeu no diagnóstico — 12 meses de números, portfólio,
          concorrentes, SWOT, metas e plano de ação. Sem redigitar nada.
        </p>
      </div>

      {/* ---------- entrada do link ---------- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Link do diagnóstico do cliente
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="https://gestaoimpacto.com/planejamento/?p=...&c=..."
            className="flex-1 p-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
          />
          <button
            onClick={buscar}
            disabled={carregando || !link.trim()}
            className="px-6 py-3 bg-brand-orange text-white rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {carregando ? 'Buscando…' : 'Buscar diagnóstico'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          O link vem do próprio cliente (o botão "Meu link" no formulário) ou do painel em{' '}
          <span className="font-mono">gestaoimpacto.com/planejamento/painel</span>. Sem as duas
          partes do link, o diagnóstico não abre — é assim que a resposta de uma empresa não vaza
          para outra.
        </p>
        {erro && (
          <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-400 text-red-800 text-sm rounded">
            {erro}
          </div>
        )}
      </div>

      {/* ---------- prévia ---------- */}
      {previa && !aplicado && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-brand-dark">{previa.empresa || 'Empresa sem nome'}</h2>
                <p className="text-sm text-gray-500">
                  {previa.mesesEncontrados > 0
                    ? `${previa.mesesEncontrados} meses de ${previa.anoBase} · receita de ${formatCurrency(receitaImportada)}`
                    : 'Sem série financeira preenchida'}
                </p>
              </div>
              {previa.mesesEncontrados > 0 && previa.mesesEncontrados < 12 && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  Ano incompleto — faltam {12 - previa.mesesEncontrados} meses
                </span>
              )}
            </div>

            {(['dado', 'estimado', 'faltando'] as Confianca[]).map((c) => {
              const itens = porConfianca(c);
              if (!itens.length) return null;
              const cor = CORES[c];
              return (
                <div key={c} className={`mb-5 border ${cor.borda} rounded-lg overflow-hidden`}>
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cor.chip}`}>
                      {itens.length}
                    </span>
                    <span className="ml-2 font-semibold text-brand-dark">{cor.titulo}</span>
                    <p className="text-xs text-gray-500 mt-1">{cor.texto}</p>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {itens.map((i, n) => (
                      <li key={n} className="px-4 py-3">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium text-gray-900 text-sm">{i.destino}</span>
                          <span className="text-xs text-gray-400">← {i.origem}</span>
                        </div>
                        {i.observacao && (
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{i.observacao}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* ---------- o que vai ser substituído ---------- */}
          {(jaTemPortfolio > 0 || jaTemAcoes > 0) && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
              <p className="font-semibold text-amber-900 text-sm">Atenção: isto substitui o que já existe</p>
              <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                {jaTemPortfolio > 0 && previa.substituira.portfolio > 0 && (
                  <li>
                    Portfólio: as {jaTemPortfolio} linha(s) atuais dão lugar a{' '}
                    {previa.substituira.portfolio} do diagnóstico.
                  </li>
                )}
                {jaTemAcoes > 0 && previa.substituira.acoes > 0 && (
                  <li>
                    Plano de ação: as {jaTemAcoes} ação(ões) atuais dão lugar a{' '}
                    {previa.substituira.acoes} do diagnóstico.
                  </li>
                )}
              </ul>
              <p className="text-xs text-amber-700 mt-2">
                O resto é preenchido por cima só onde o diagnóstico trouxe valor. Nada mais é apagado.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={aplicar}
              className="px-6 py-3 bg-brand-orange text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Aplicar ao PLAN 2026
            </button>
            <button
              onClick={() => setPrevia(null)}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* ---------- aplicado ---------- */}
      {aplicado && previa && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-green-700 text-xl">✓</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-dark">Importado</h2>
              <p className="text-gray-600 mt-1 text-sm">
                Os dados de <strong>{previa.empresa}</strong> estão no PLAN 2026. Comece pela{' '}
                <strong>Coleta de Dados 2025</strong> para conferir os meses, e depois pelo que
                ficou marcado como calculado — principalmente a abertura do custo fixo.
              </p>
              <p className="text-xs text-gray-500 mt-3">
                Importar de novo com o mesmo link é seguro: o diagnóstico guarda o histórico e
                sempre devolve a versão mais recente do que o cliente respondeu.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------- explicação ---------- */}
      {!previa && !aplicado && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-semibold text-brand-dark mb-3">Como isso funciona</h3>
          <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
            <li>O cliente preenche o diagnóstico em gestaoimpacto.com/planejamento</li>
            <li>Ele recebe um link com as respostas dele — e só dele</li>
            <li>Você cola esse link aqui</li>
            <li>Vê a prévia do que vai entrar, separado entre dado, cálculo e o que falta</li>
            <li>Aplica. Os 12 meses, o portfólio, a SWOT, as metas e o plano de ação entram prontos</li>
          </ol>
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            O diagnóstico e o PLAN 2026 guardam dados em lugares diferentes e continuam
            independentes. Esta tela só lê o diagnóstico — nunca escreve nele. Se o cliente mudar
            uma resposta depois, é só importar de novo.
          </p>
        </div>
      )}
    </div>
  );
};

export default ImportFromDpe;
