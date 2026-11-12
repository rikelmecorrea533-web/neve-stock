/**
 * Formata data e hora no padrão brasileiro: 11/11/2026 00:30
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatDateOnly(isoString?: string | null): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Retorna o tempo decorrido no formato amigável solicitado:
 * "há 5 min", "há 2 h 10 min", "há 3 dias", "agora mesmo"
 */
export function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSeconds < 60) {
    return 'agora mesmo';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `há ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    if (remainingMinutes === 0) {
      return `há ${diffHours} h`;
    }
    return `há ${diffHours} h ${remainingMinutes} min`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return 'há 1 dia';
  }
  return `há ${diffDays} dias`;
}

/**
 * Formata números com 2 casas decimais no padrão brasileiro: 208,34 ou 1.525,20
 */
export function formatKgNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formata números com unidade kg e 2 casas decimais: 208,34 kg; 1.525,20 kg
 */
export function formatKg(num: number | undefined | null): string {
  return `${formatKgNumber(num)} kg`;
}

/**
 * Formata quantidade em kg (padrão 2 casas se houver decimais, sempre consistente)
 */
export function formatQuantity(num: number | undefined | null): string {
  return formatKgNumber(num);
}
