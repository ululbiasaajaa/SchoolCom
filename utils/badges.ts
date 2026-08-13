import { StatusType } from '../types/schoolcom';

export interface BadgeStyle {
  bg: string;
  text: string;
  symbol: string;
}

export function getStatusBadgeStyle(status: string | StatusType): BadgeStyle {
  const normalizedStatus = (status || '').toString().toLowerCase();

  if (normalizedStatus.includes('pending')) {
    return {
      bg: '#FEF3C7',
      text: '#D97706',
      symbol: '🟡',
    };
  }

  if (normalizedStatus.includes('follow')) {
    return {
      bg: '#DBEAFE',
      text: '#2563EB',
      symbol: '🔵',
    };
  }

  if (normalizedStatus.includes('resolve')) {
    return {
      bg: '#D1FAE5',
      text: '#059669',
      symbol: '🟢',
    };
  }

  // Graceful Fallback jika status tidak dikenal atau berupa ID
  return {
    bg: '#F3F4F6',
    text: '#4B5563',
    symbol: '⚪',
  };
}