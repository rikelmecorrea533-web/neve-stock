export function formatTimeAgo(isoDate: string): string {
  if (!isoDate) return '';
  const now = Date.now();
  const past = new Date(isoDate).getTime();
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) {
    return 'agora mesmo';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `há ${diffMin} min`;
  }
  const diffHours = Math.floor(diffMin / 60);
  const remainingMin = diffMin % 60;
  if (diffHours < 24) {
    if (remainingMin === 0) return `há ${diffHours} h`;
    return `há ${diffHours} h ${remainingMin} min`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'há 1 dia';
  return `há ${diffDays} dias`;
}

export function formatDateTime(isoDate: string): string {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${min}`;
}
