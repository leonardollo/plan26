import React, { useState, useEffect, useRef } from 'react';

interface CurrencyInputProps {
    value: number | null | undefined;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    step?: string;
    'aria-label'?: string;
}

/**
 * Input numérico com formatação brasileira automática.
 * Exibe valores formatados com separador de milhar (.) e decimal (,)
 * quando o campo não está em foco. Quando em foco, permite edição livre.
 */
const CurrencyInput: React.FC<CurrencyInputProps> = ({
    value,
    onChange,
    className = '',
    placeholder = '0',
    disabled = false,
    'aria-label': ariaLabel,
}) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Formata número para exibição brasileira
    const formatForDisplay = (num: number | null | undefined): string => {
        if (num === null || num === undefined || isNaN(num)) return '';
        if (num === 0) return '0';
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(num);
    };

    // Converte string brasileira para número
    const parseFromBrazilian = (str: string): string => {
        if (!str || str.trim() === '') return '';
        // Remove pontos de milhar e troca vírgula por ponto
        const cleaned = str.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        if (isNaN(num)) return '';
        return num.toString();
    };

    // Atualiza display quando valor externo muda e campo não está em foco
    useEffect(() => {
        if (!isFocused) {
            setDisplayValue(formatForDisplay(value));
        }
    }, [value, isFocused]);

    const handleFocus = () => {
        setIsFocused(true);
        // Ao focar, mostra o valor numérico limpo para edição
        if (value !== null && value !== undefined && !isNaN(value) && value !== 0) {
            // Mostra no formato brasileiro para edição
            setDisplayValue(formatForDisplay(value));
        } else {
            setDisplayValue('');
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        // Ao sair do foco, converte e envia o valor
        const numericValue = parseFromBrazilian(displayValue);
        onChange(numericValue);
        // Reformata para exibição
        const num = parseFloat(numericValue);
        setDisplayValue(formatForDisplay(isNaN(num) ? null : num));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Permite apenas dígitos, vírgula, ponto e sinal negativo
        const filtered = raw.replace(/[^0-9.,\-]/g, '');
        setDisplayValue(filtered);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={className}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={ariaLabel}
        />
    );
};

export default CurrencyInput;
