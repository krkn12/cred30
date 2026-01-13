/**
 * Utilitários de formatação para valores monetários, datas e números.
 */

/**
 * Utilitários de formatação para garantir consistência em toda a aplicação.
 */

/**
 * Converte uma string ou número para Number de forma segura.
 * Lida com vírgulas como separadores decimais e limpa caracteres não numéricos.
 */
export const parseToNumber = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  try {
    // Limpar a string: remover R$, espaços e pontos de milhar
    let clean = val.replace(/R\$\s?/, '').replace(/\s/g, '');

    // Se houver pontos e vírgulas, assumimos formato BR (milhar.decimal,centavos)
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  } catch (e) {
    return 0;
  }
};

/**
 * Formata um valor para Real Brasileiro (R$ 0,00)
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
  const num = parseToNumber(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(num);
};

export const formatBRL = formatCurrency;

/**
 * Formata um valor numérico com 2 casas decimais no padrão brasileiro
 */
export const formatNumberBR = (val: number | string | null | undefined): string => {
  const num = parseToNumber(val);
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const formatDateTime = (timestamp: number | string | Date): string => {
  try {
    const date = typeof timestamp === 'number' || typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo'
    }).format(date);
  } catch (e) {
    return 'Data inválida';
  }
};

export const formatDate = (timestamp: number | string | Date): string => {
  try {
    const date = typeof timestamp === 'number' || typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeZone: 'America/Sao_Paulo'
    }).format(date);
  } catch (e) {
    return 'Data inválida';
  }
};

export const formatPercent = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Retorna uma string pronta para ser usada em inputs (substitui ponto por vírgula se necessário)
 */
export const toInputString = (val: number | string | null | undefined): string => {
  const num = parseToNumber(val);
  if (num === 0) return '';
  return num.toString().replace('.', ',');
};