/**
 * After the first screen settles, quietly download the main tabs' code so
 * switching tabs is instant on slow networks. Skipped when the browser asks to
 * save data or the connection is 2G.
 */
type NetworkInfo = { saveData?: boolean; effectiveType?: string };

export function prefetchMainScreens() {
  const conn = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return;
  const load = () => {
    void import('@/features/curriculum/pages/UnitsPage');
    void import('@/features/practice/pages/PracticeSessionPage');
    void import('@/features/lookup/LookupPage');
    void import('@/features/community/pages/CommunityHomePage');
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 5000 });
  else setTimeout(load, 3000);
}
