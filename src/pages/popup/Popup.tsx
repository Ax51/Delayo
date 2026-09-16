import React, { useEffect, useState } from 'react';

import '../../i18n';

import { isManageTabsPage } from '@utils/manageTabsPage';

import Onboarding from '../../components/Onboarding';
import { getOnboardingCompleted } from '../../utils/extensionStorage';
import useTheme from '../../utils/useTheme';
import Router from './router';

function Popup(): React.ReactElement {
  useTheme();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const loadOnboardingState = async (): Promise<void> => {
      const onboardingCompleted = await getOnboardingCompleted();
      setShowOnboarding(!onboardingCompleted);
    };

    void loadOnboardingState();
  }, []);

  const handleOnboardingComplete = (): void => {
    setShowOnboarding(false);
  };

  return (
    <>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <div
        className={
          isManageTabsPage
            ? 'flex min-h-screen justify-center bg-base-200 px-4 py-6'
            : undefined
        }
      >
        <Router />
      </div>
    </>
  );
}

export default Popup;
