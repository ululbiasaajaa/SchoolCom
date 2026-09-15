/**
 * REV-03: Base URL project web "SchoolCom Report" (Vercel, terpisah dari
 * landing page). GANTI nilai ini setelah project di-deploy — cek domain
 * yang di-assign Vercel (biasanya https://nama-project.vercel.app) atau
 * custom domain kalau ada.
 */
export const REPORT_BASE_URL = 'https://schoolcom-report-plum.vercel.app/r/';

export const buildReportUrl = (token: string): string => {
  return `${REPORT_BASE_URL}${token}`;
};