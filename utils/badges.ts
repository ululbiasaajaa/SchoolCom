import { PriorityType, StatusType } from '../types/schoolcom';

export const getStatusBadgeStyle = (status: StatusType) => {
  switch (status) {
    case 'Pending':
      return { bg: '#FEF3C7', text: '#D97706', symbol: '🟡' };
    case 'Follow-up':
      return { bg: '#DBEAFE', text: '#2563EB', symbol: '🔵' };
    case 'Resolved':
      return { bg: '#D1FAE5', text: '#059669', symbol: '🟢' };
    default:
      return { bg: '#E5E7EB', text: '#374151', symbol: '⚪' };
  }
};

export const getPriorityBadgeStyle = (priority: PriorityType) => {
  switch (priority) {
    case 'High':
      return { bg: '#FEE2E2', text: '#DC2626' };
    case 'Medium':
      return { bg: '#FFEDD5', text: '#EA580C' };
    case 'Low':
    default:
      return { bg: '#F3F4F6', text: '#4B5563' };
  }
};