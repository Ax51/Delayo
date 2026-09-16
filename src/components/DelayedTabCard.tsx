import React, { useMemo } from 'react';
import {
  faEye,
  faPenToSquare,
  faPlay,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { DelayedTab } from '@types';
import { formatDateTime, formatTimeLeft } from '@utils/dateTime';
import { getTabGroupBadgeStyle } from '@utils/tabGroupBadge';
import { useTranslation } from 'react-i18next';

export interface DelayedTabCardActions {
  onEdit: (tabId: string) => Promise<void>;
  onOpen: (tab: DelayedTab) => Promise<void>;
  onWake: (tab: DelayedTab) => Promise<void>;
  onRemove: (tab: DelayedTab) => Promise<void>;
}

interface DelayedTabCardProps {
  tab: DelayedTab;
  actions?: DelayedTabCardActions;
  onTitleChange?: (tabId: string, title: string) => Promise<void>;
  selection?: React.ReactNode;
  wrapDetails?: boolean;
}

function DelayedTabCard({
  tab,
  actions,
  onTitleChange,
  selection,
  wrapDetails = false,
}: DelayedTabCardProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const timeLeftLabels = useMemo(
    () => ({
      day: t('manageTabs.timeUnits.day'),
      hour: t('manageTabs.timeUnits.hour'),
      minute: t('manageTabs.timeUnits.minute'),
      now: t('manageTabs.now'),
    }),
    [t]
  );

  return (
    <div
      className={`flex items-center justify-between rounded-lg bg-base-100/70 p-4 shadow-sm transition-all duration-200 hover:bg-base-100 ${wrapDetails ? 'flex-wrap gap-3' : ''}`}
    >
      <div
        className={`flex min-w-0 items-center ${wrapDetails ? 'flex-[1_1_16rem]' : 'mr-4 flex-1'}`}
      >
        {selection}
        {tab.favicon && (
          <img
            src={tab.favicon}
            alt={t('common.faviconAlt')}
            className='mr-3 h-5 w-5 flex-shrink-0 rounded-sm'
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className='min-w-0 flex-1'>
          <div
            className='truncate text-sm font-medium text-base-content/80 outline-none'
            contentEditable={Boolean(onTitleChange)}
            suppressContentEditableWarning
            role={onTitleChange ? 'textbox' : undefined}
            aria-label={t('customDelay.tabTitle')}
            onFocus={(event) => {
              if (!tab.title) {
                event.currentTarget.textContent = '';
              }
            }}
            onBlur={(event) => {
              const title = event.currentTarget.textContent?.trim() ?? '';
              if (title !== (tab.title ?? '')) {
                void onTitleChange?.(tab.id, title);
              }
            }}
          >
            {tab.title || t('manageTabs.untitledTab')}
          </div>
          {tab.url && (
            <div
              className={
                wrapDetails
                  ? 'select-text break-all text-xs text-base-content/60'
                  : 'truncate text-xs text-base-content/60'
              }
            >
              {tab.url}
            </div>
          )}
          {tab.remindOnly && (
            <div className='mt-1 text-xs text-base-content/60'>
              {t('popup.existingDelay.reminderSet')}
            </div>
          )}
          {tab.group && (
            <div className='mt-1'>
              <span
                className='badge badge-sm max-w-full truncate border text-[10px] font-medium'
                style={getTabGroupBadgeStyle(tab.group)}
              >
                {t('manageTabs.groupBadge', {
                  name: tab.group.title?.trim() || t('manageTabs.unnamedGroup'),
                })}
              </span>
            </div>
          )}
          <div
            className={
              wrapDetails
                ? 'text-xs text-base-content/60'
                : 'truncate text-xs text-base-content/60'
            }
          >
            {formatDateTime(tab.wakeTime, locale)} (
            {formatTimeLeft(tab.wakeTime, timeLeftLabels)})
          </div>
        </div>
      </div>
      {actions && (
        <div className='ml-auto flex flex-shrink-0 items-center space-x-1.5'>
          <button
            type='button'
            className='btn btn-circle btn-ghost btn-sm'
            onClick={() => void actions.onEdit(tab.id)}
            aria-label={t('common.edit')}
            title={t('common.edit')}
          >
            <FontAwesomeIcon icon={faPenToSquare} />
          </button>
          <button
            type='button'
            className='btn btn-circle btn-ghost btn-sm'
            onClick={() => void actions.onOpen(tab)}
            aria-label={t('manageTabs.openWithoutRemoving')}
            title={t('manageTabs.openWithoutRemoving')}
          >
            <FontAwesomeIcon icon={faEye} />
          </button>
          <button
            type='button'
            className='btn btn-circle btn-sm'
            style={{ backgroundColor: '#ffb26f', color: '#3B1B00' }}
            onClick={() => void actions.onWake(tab)}
            aria-label={t('manageTabs.wakeUp')}
            title={t('manageTabs.wakeUp')}
          >
            <FontAwesomeIcon icon={faPlay} />
          </button>
          <button
            type='button'
            className='btn btn-circle btn-outline btn-error btn-sm'
            onClick={() => void actions.onRemove(tab)}
            aria-label={t('manageTabs.remove')}
            title={t('manageTabs.remove')}
          >
            <FontAwesomeIcon icon={faTrashCan} />
          </button>
        </div>
      )}
    </div>
  );
}

export default DelayedTabCard;
