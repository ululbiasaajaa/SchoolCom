export type DateFilterType = 'All' | 'Today' | 'Last7Days' | 'Last30Days';

export const parseIncidentDate = (createdAtStr: string): Date | null => {
  if (!createdAtStr) return null;
  try {
    // Format standar: "YYYY-MM-DD HH:mm" atau ISO string
    const cleaned = createdAtStr.trim();
    // Coba parsing manual jika format YYYY-MM-DD HH:mm
    const regex = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/;
    const match = cleaned.match(regex);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      return new Date(year, month, day, hour, minute);
    }
    // Fallback ke native Date parse
    const fallbackDate = new Date(cleaned);
    return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  } catch (e) {
    return null;
  }
};

export const matchesDateFilter = (createdAtStr: string, filterType: DateFilterType): boolean => {
  if (filterType === 'All') return true;
  
  const incidentDate = parseIncidentDate(createdAtStr);
  if (!incidentDate) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filterType === 'Today') {
    return incidentDate >= todayStart;
  }

  if (filterType === 'Last7Days') {
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(todayStart.getDate() - 7);
    return incidentDate >= sevenDaysAgo;
  }

  if (filterType === 'Last30Days') {
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(todayStart.getDate() - 30);
    return incidentDate >= thirtyDaysAgo;
  }

  return true;
};