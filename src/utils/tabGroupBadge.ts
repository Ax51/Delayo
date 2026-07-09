import { DelayedTabGroup } from '@types';

const TAB_GROUP_BADGE_STYLES: Record<
  chrome.tabGroups.ColorEnum,
  {
    backgroundColor: string;
    color: string;
    borderColor: string;
  }
> = {
  grey: {
    backgroundColor: '#e5e7eb',
    color: '#374151',
    borderColor: '#d1d5db',
  },
  blue: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    borderColor: '#93c5fd',
  },
  red: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    borderColor: '#fca5a5',
  },
  yellow: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
    borderColor: '#fcd34d',
  },
  green: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    borderColor: '#86efac',
  },
  pink: {
    backgroundColor: '#fce7f3',
    color: '#be185d',
    borderColor: '#f9a8d4',
  },
  purple: {
    backgroundColor: '#ede9fe',
    color: '#7c3aed',
    borderColor: '#c4b5fd',
  },
  cyan: {
    backgroundColor: '#cffafe',
    color: '#0f766e',
    borderColor: '#67e8f9',
  },
  orange: {
    backgroundColor: '#ffedd5',
    color: '#c2410c',
    borderColor: '#fdba74',
  },
};

const DEFAULT_BADGE_STYLE = {
  backgroundColor: '#f3f4f6',
  color: '#4b5563',
  borderColor: '#d1d5db',
};

export function getTabGroupBadgeStyle(
  group?: DelayedTabGroup
): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  if (!group?.color) {
    return DEFAULT_BADGE_STYLE;
  }

  return TAB_GROUP_BADGE_STYLES[group.color] ?? DEFAULT_BADGE_STYLE;
}
