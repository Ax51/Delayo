import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { DelayedTab } from '@types';
import {
  removeTabs,
  updateTabTitle,
  wakeTabs,
} from '@utils/delayedTabsRuntime';
import { useTranslation } from 'react-i18next';

import DelayedTabCard from './DelayedTabCard';

interface SimilarDelayedTabsProps {
  tabs: DelayedTab[];
}

function SimilarDelayedTabs({
  tabs,
}: SimilarDelayedTabsProps): React.ReactElement | null {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className='mt-3 min-w-0'>
      <p className='text-sm font-medium text-base-content/80'>
        {t('popup.existingDelay.similarLinks')}
      </p>
      <p className='mt-1 text-xs text-base-content/60'>
        {t('popup.existingDelay.savedSeparately')}
      </p>
      <ul className='mt-3 max-h-64 space-y-3 overflow-y-auto'>
        {tabs.map((tab) => (
          <li key={tab.id} className='min-w-0'>
            <DelayedTabCard
              tab={tab}
              wrapDetails
              onTitleChange={async (tabId, title) => {
                await updateTabTitle(tabId, title);
              }}
              actions={{
                onEdit: async (tabId) => {
                  await navigate({
                    to: '/custom-delay',
                    search: { tabId, remindOnly: false },
                  });
                },
                onOpen: async (savedTab) => {
                  if (savedTab.url) {
                    await chrome.tabs.create({
                      url: savedTab.url,
                      active: false,
                    });
                  }
                },
                onWake: async (savedTab) => {
                  await wakeTabs([savedTab.id]);
                },
                onRemove: async (savedTab) => {
                  await removeTabs([savedTab.id]);
                },
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SimilarDelayedTabs;
