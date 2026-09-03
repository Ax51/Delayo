import React, { useEffect, useMemo, useState } from 'react';
import { DelayedTab } from '@types';
import { formatDateTime, formatTimeLeft } from '@utils/dateTime';
import { useTranslation } from 'react-i18next';

const STATUS_REFRESH_INTERVAL_MS = 30_000;

interface ExistingDelayBadgeProps {
  delayedTab: DelayedTab;
  stacked?: boolean;
}

function ExistingDelayBadge({
  delayedTab,
  stacked = false,
}: ExistingDelayBadgeProps): React.ReactElement {
  const { i18n, t } = useTranslation();
  const [statusNow, setStatusNow] = useState(() => Date.now());
  const locale =
    i18n.language ||
    document.documentElement.lang ||
    navigator.language ||
    'en';
  const timeLeftLabels = useMemo(
    () => ({
      day: t('manageTabs.timeUnits.day'),
      hour: t('manageTabs.timeUnits.hour'),
      minute: t('manageTabs.timeUnits.minute'),
      now: t('manageTabs.now'),
    }),
    [t]
  );
  const label = t(
    delayedTab.remindOnly
      ? 'popup.existingDelay.reminderSet'
      : 'popup.existingDelay.alreadyDelayed'
  );
  const detail =
    delayedTab.wakeTime <= statusNow
      ? t(
          delayedTab.remindOnly
            ? 'popup.existingDelay.reminderDueNow'
            : 'popup.existingDelay.reopeningNow'
        )
      : t(
          delayedTab.remindOnly
            ? 'popup.existingDelay.reminderIn'
            : 'popup.existingDelay.reopensIn',
          {
            time: formatTimeLeft(
              delayedTab.wakeTime,
              timeLeftLabels,
              statusNow
            ),
          }
        );
  const scheduledFor = t('popup.existingDelay.scheduledFor', {
    date: formatDateTime(delayedTab.wakeTime, locale),
  });

  useEffect(() => {
    setStatusNow(Date.now());
    const intervalId = window.setInterval(
      () => setStatusNow(Date.now()),
      STATUS_REFRESH_INTERVAL_MS
    );

    return () => window.clearInterval(intervalId);
  }, [delayedTab.id, delayedTab.wakeTime]);

  if (stacked) {
    return (
      <div
        className='mt-2 inline-flex max-w-full flex-col items-start rounded-lg bg-success/10 px-2 py-1.5 text-xs font-medium text-base-content/80'
        title={scheduledFor}
      >
        <span className='flex items-center gap-1.5'>
          <span
            className='h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success'
            aria-hidden='true'
          />
          {label}
        </span>
        <span className='mt-0.5 pl-3 text-base-content/70'>{detail}</span>
        <span className='sr-only'>. {scheduledFor}</span>
      </div>
    );
  }

  return (
    <div
      className='mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-base-content/80'
      title={scheduledFor}
    >
      <span
        className='h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success'
        aria-hidden='true'
      />
      <span className='truncate'>
        {label} <span aria-hidden='true'>·</span> {detail}
      </span>
      <span className='sr-only'>. {scheduledFor}</span>
    </div>
  );
}

export default ExistingDelayBadge;
