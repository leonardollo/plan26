
import React, { useState, useEffect } from 'react';
import { MONTHS, Month, MonthlyData } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import CurrencyInput from './CurrencyInput';

const DistributeButton: React.FC<{
    total: number;
    onDistribute: (newValues: MonthlyData) => void;
    referenceData?: MonthlyData;
}> = ({ total, onDistribute, referenceData }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleDistribute = (method: 'linear' | 'seasonal' | 'progressive') => {
        const newValues: MonthlyData = {};
        if (method === 'linear') {
            const monthlyValue = total / 12;
            MONTHS.forEach(m => { newValues[m] = monthlyValue; });
        } else if (method === 'progressive') {
            const base = total * 2 / (12 * (12 + 1));
            MONTHS.forEach((m, i) => { newValues[m] = base * (i + 1); });
        } else if (method === 'seasonal' && referenceData) {
            const refTotal = Object.values(referenceData).reduce<number>((s, v) => s + (Number(v) || 0), 0);
            if (refTotal > 0) {
                MONTHS.forEach(m => {
                    const seasonality = (Number(referenceData[m]) || 0) / refTotal;
                    newValues[m] = total * seasonality;
                });
            } else {
                 const monthlyValue = total / 12;
                 MONTHS.forEach(m => { newValues[m] = monthlyValue; });
            }
        }
        onDistribute(newValues);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block text-left">
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="text-xs text-brand-orange hover:underline">
                Distribuir
            </button>
            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        <a href="#" onClick={(e) => { e.preventDefault(); handleDistribute('linear'); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Linear (Igualmente)</a>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleDistribute('progressive'); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Crescente</a>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleDistribute('seasonal'); }} className={`block px-4 py-2 text-sm ${!referenceData ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`} title={!referenceData ? 'Dados de referência não disponíveis' : ''}>Baseado em 2025</a>
                    </div>
                </div>
            )}
        </div>
    );
};

export type FinancialDataRowProps = {
    label: string;
    hint?: string;
    rowData?: { values: MonthlyData }; 
    onUpdate?: (month: Month, value: string) => void;
    onUpdateAll?: (newValues: MonthlyData) => void;
    onUpdateName?: (newName: string) => void;
    onUpdateHint?: (newHint: string) => void;
    onRemove?: () => void;
    isCustom?: boolean;
    isTotal?: boolean;
    isPercentage?: boolean;
    calculatedValue?: number;
    seasonalReference?: MonthlyData;
    actionButton?: React.ReactNode;
};

const FinancialDataRow: React.FC<FinancialDataRowProps> = ({
    label, hint, rowData, onUpdate, onUpdateAll, onUpdateName, onUpdateHint, onRemove, isCustom = false,
    isTotal = false, isPercentage = false, calculatedValue, seasonalReference, actionButton
}) => {
    const [showZeroAlert, setShowZeroAlert] = useState(false);

    const values = rowData?.values || {};
    const total = calculatedValue !== undefined ? calculatedValue : (rowData ? Object.values(values).reduce((sum: number, m) => sum + (Number(m) || 0), 0) : 0);

    useEffect(() => {
        if (!isTotal && rowData && total > 0 && label.toLowerCase().includes('receita')) {
            const vals = Object.values(values);
            const hasNonZeros = vals.some(v => Number(v) > 0);
            const hasZeros = vals.some(v => v === 0 || v === null);
            setShowZeroAlert(hasZeros && hasNonZeros);
        } else {
            setShowZeroAlert(false);
        }
    }, [rowData, isTotal, total, label, values]);


    const formatValue = (value: number) => isPercentage ? formatPercentage(value) : formatCurrency(value);

    return (
        <>
        <tr className={isTotal ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'}>
            {/* Label Cell */}
            <td className="sticky left-0 bg-inherit z-10 p-3 text-gray-800" style={{width: '250px'}}>
                {isCustom && onUpdateName && onRemove ? (
                     <div className="flex items-center">
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => onUpdateName(e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-brand-orange focus:outline-none"
                        />
                        <button onClick={onRemove} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
                     </div>
                ) : (
                    label
                )}
            </td>

            {/* Hint Cell */}
            <td className="p-3 text-gray-500 text-xs italic">
                {isCustom && onUpdateHint ? (
                    <input
                        type="text"
                        value={hint || ''}
                        onChange={(e) => onUpdateHint(e.target.value)}
                        placeholder="Descreva este item..."
                        className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-brand-orange focus:outline-none text-xs italic text-gray-500 placeholder-gray-300"
                    />
                ) : (
                    hint
                )}
                {actionButton}
            </td>
            
             {/* Total */}
            <td className={`p-3 text-right ${isTotal ? 'text-brand-dark font-bold' : 'text-gray-600'}`}>
                <div className="flex flex-col items-end">
                    <span>{formatValue(total)}</span>
                    {!isTotal && onUpdateAll && (
                        <DistributeButton 
                            total={total}
                            onDistribute={onUpdateAll}
                            referenceData={seasonalReference}
                        />
                    )}
                </div>
            </td>
            
            {/* Monthly Inputs/Values */}
            {MONTHS.map(month => (
                <td key={month} className="p-0">
                    {onUpdate && !isTotal && rowData ? (
                        <CurrencyInput
                            value={values?.[month] ?? null}
                            onChange={(v) => onUpdate(month, v)}
                            className="w-32 p-2 text-right border-none bg-transparent focus:ring-2 focus:ring-brand-orange focus:ring-inset"
                            placeholder="0"
                        />
                    ) : (
                         <span className="block w-32 p-2 text-right text-sm text-gray-700">
                            {values?.[month] !== undefined && values?.[month] !== null ? formatValue(values[month]!) : '-'}
                        </span>
                    ) }
                </td>
            ))}
        </tr>
         {showZeroAlert && (
                <tr className="bg-yellow-50 text-yellow-800 text-xs text-center">
                    <td colSpan={15} className="py-1 px-3">
                        Atenção: Você tem meses sem receita. Isso está correto?
                        <button onClick={() => setShowZeroAlert(false)} className="ml-4 font-bold hover:underline">Sim</button>
                        <span className="mx-2">|</span>
                        {onUpdateAll && <DistributeButton total={total} onDistribute={onUpdateAll} referenceData={seasonalReference} />}
                    </td>
                </tr>
            )}
        </>
    );
};

export default FinancialDataRow;
