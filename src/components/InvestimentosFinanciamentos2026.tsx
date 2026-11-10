import React from 'react';
import { usePlan } from '../hooks/usePlanData';
import type { ListaInvestimento2026, Month } from '../types';
import { MONTHS, MONTH_LABELS } from '../types';
import { parcelaPrice } from '../utils/calculos/investimentos';
import { formatCurrency } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';

const CAMPO = 'block w-full min-w-[7rem] rounded-xl border border-gray-300 bg-white p-2 text-sm focus:border-brand-orange focus:ring-1 focus:ring-brand-orange';
const TH = 'p-3 text-left font-semibold whitespace-nowrap';

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
    <section className="rounded-2xl border border-gray-100 bg-white">
        <h3 className="p-4 text-lg font-bold text-brand-blue">{titulo}</h3>
        {children}
    </section>
);

// Tabelas largas rolam na horizontal para caber em 390 px sem quebrar a página.
const Tabela: React.FC<{ cabecalho: string[]; children: React.ReactNode }> = ({ cabecalho, children }) => (
    <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
                <tr>
                    {cabecalho.map(c => <th key={c} className={TH}>{c}</th>)}
                    <th className="p-3"><span className="sr-only">Ações</span></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">{children}</tbody>
        </table>
    </div>
);

const SeletorDeMes: React.FC<{ value: Month | null; onChange: (v: string) => void; rotulo: string }> = ({ value, onChange, rotulo }) => (
    <select aria-label={rotulo} value={value ?? 'jan'} onChange={e => onChange(e.target.value)} className={CAMPO}>
        {MONTHS.map(m => <option key={m} value={m}>{MONTH_LABELS[m].slice(0, 3)}</option>)}
    </select>
);

const BotaoRemover: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <td className="px-2 py-2 text-center">
        <button type="button" aria-label="Remover" onClick={onClick} className="text-red-400 hover:text-red-600 font-bold text-lg">&times;</button>
    </td>
);

const BotaoAdicionar: React.FC<{ rotulo: string; onClick: () => void }> = ({ rotulo, onClick }) => (
    <div className="p-4">
        <button type="button" onClick={onClick} className="text-brand-orange font-semibold hover:text-orange-700">{rotulo}</button>
    </div>
);

export default function InvestimentosFinanciamentos2026(): React.JSX.Element {
    const {
        planData, updateJurosDividaAtual, addItemInvestimento2026, updateItemInvestimento2026, removeItemInvestimento2026,
    } = usePlan();
    const bloco = planData.investment2026;
    const financing = planData.investment?.financing;
    const editar = (lista: ListaInvestimento2026, id: string) => (campo: string) => (value: string) =>
        updateItemInvestimento2026(lista, id, campo, value);

    return (
        <div className="space-y-6">
            <Secao titulo="Investimentos 2026">
                <Tabela cabecalho={['Descrição', 'Valor (R$)', 'Mês', 'Vida útil (anos)']}>
                    {bloco.investimentos.map(item => {
                        const campo = editar('investimentos', item.id);
                        return (
                            <tr key={item.id}>
                                <td className="px-2 py-2"><input aria-label="Descrição do investimento" value={item.descricao ?? ''} onChange={e => campo('descricao')(e.target.value)} className={CAMPO} /></td>
                                <td className="px-2 py-2"><CurrencyInput aria-label="Valor do investimento" value={item.valor} onChange={campo('valor')} className={CAMPO} /></td>
                                <td className="px-2 py-2"><SeletorDeMes rotulo="Mês do investimento" value={item.mes} onChange={campo('mes')} /></td>
                                <td className="px-2 py-2"><input type="number" aria-label="Vida útil (anos)" placeholder="5" value={item.vidaUtilAnos ?? ''} onChange={e => campo('vidaUtilAnos')(e.target.value)} className={CAMPO} /></td>
                                <BotaoRemover onClick={() => removeItemInvestimento2026('investimentos', item.id)} />
                            </tr>
                        );
                    })}
                </Tabela>
                <BotaoAdicionar rotulo="Adicionar investimento" onClick={() => addItemInvestimento2026('investimentos')} />
            </Secao>

            <Secao titulo="Empréstimos novos">
                <Tabela cabecalho={['Descrição', 'Valor (R$)', 'Mês de entrada', 'Juros a.m. (%)', 'Nº de parcelas', 'Parcela (R$)']}>
                    {bloco.emprestimos.map(item => {
                        const campo = editar('emprestimos', item.id);
                        // Menos de 1 parcela invalida a linha no cálculo; o aviso explica por que ela não aparece.
                        const semParcelas = !(Math.floor(Number(item.parcelas) || 0) >= 1);
                        return (
                            <tr key={item.id}>
                                <td className="px-2 py-2"><input aria-label="Descrição do empréstimo" value={item.descricao ?? ''} onChange={e => campo('descricao')(e.target.value)} className={CAMPO} /></td>
                                <td className="px-2 py-2"><CurrencyInput aria-label="Valor do empréstimo" value={item.valor} onChange={campo('valor')} className={CAMPO} /></td>
                                <td className="px-2 py-2"><SeletorDeMes rotulo="Mês do empréstimo" value={item.mes} onChange={campo('mes')} /></td>
                                <td className="px-2 py-2"><input type="number" aria-label="Juros a.m. do empréstimo (%)" value={item.jurosMensalPct ?? ''} onChange={e => campo('jurosMensalPct')(e.target.value)} className={CAMPO} /></td>
                                <td className="px-2 py-2"><input type="number" aria-label="Nº de parcelas" value={item.parcelas ?? ''} onChange={e => campo('parcelas')(e.target.value)} className={CAMPO} /></td>
                                <td className="px-3 py-2 text-right whitespace-nowrap text-gray-700">
                                    {semParcelas
                                        ? <span className="text-xs text-amber-700">Informe o nº de parcelas</span>
                                        : formatCurrency(parcelaPrice(item.valor, item.jurosMensalPct, item.parcelas))}
                                </td>
                                <BotaoRemover onClick={() => removeItemInvestimento2026('emprestimos', item.id)} />
                            </tr>
                        );
                    })}
                </Tabela>
                <BotaoAdicionar rotulo="Adicionar empréstimo" onClick={() => addItemInvestimento2026('emprestimos')} />
            </Secao>

            <Secao titulo="Aportes de sócios">
                <Tabela cabecalho={['Descrição', 'Valor (R$)', 'Mês']}>
                    {bloco.aportes.map(item => {
                        const campo = editar('aportes', item.id);
                        return (
                            <tr key={item.id}>
                                <td className="px-2 py-2"><input aria-label="Descrição do aporte" value={item.descricao ?? ''} onChange={e => campo('descricao')(e.target.value)} className={CAMPO} /></td>
                                <td className="px-2 py-2"><CurrencyInput aria-label="Valor do aporte" value={item.valor} onChange={campo('valor')} className={CAMPO} /></td>
                                <td className="px-2 py-2"><SeletorDeMes rotulo="Mês do aporte" value={item.mes} onChange={campo('mes')} /></td>
                                <BotaoRemover onClick={() => removeItemInvestimento2026('aportes', item.id)} />
                            </tr>
                        );
                    })}
                </Tabela>
                <BotaoAdicionar rotulo="Adicionar aporte" onClick={() => addItemInvestimento2026('aportes')} />
            </Secao>

            <Secao titulo="Dívida atual (31/12/25)">
                <div className="grid gap-4 p-4 pt-0 sm:grid-cols-3">
                    {/* Só leitura: a dívida de 31/12/25 vem da Coleta de Dados (digitada ou importada do DPE). */}
                    <div>
                        <p className="text-sm font-medium text-gray-700">Curto prazo</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(financing?.financiamentoCurtoPrazo)}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-700">Longo prazo</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(financing?.financiamentoLongoPrazo)}</p>
                    </div>
                    <div>
                        <label htmlFor="juros-divida-atual" className="block text-sm font-medium text-gray-700">Juros médios a.m. da dívida atual (%)</label>
                        <input
                            id="juros-divida-atual"
                            type="number"
                            value={bloco.jurosDividaAtualPct ?? ''}
                            onChange={e => updateJurosDividaAtual(e.target.value)}
                            className={`mt-1 ${CAMPO}`}
                        />
                    </div>
                </div>
            </Secao>
        </div>
    );
}
