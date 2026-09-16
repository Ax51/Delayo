export const isManageTabsPage =
  new URLSearchParams(window.location.search).get('view') === 'manage';

export function getManageTabsPageUrl(): string {
  const url = new URL(window.location.href);
  url.search = '?view=manage';
  url.hash = '';
  return url.href;
}
