import useDelaySettings from '@hooks/useDelaySettings';
import { PresetButtonId } from '@types';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const getInputClasses = (isPopup: boolean): string =>
  `input input-bordered ${isPopup ? 'h-12 rounded-lg bg-base-100/70 p-4 shadow-sm transition-all duration-200 hover:bg-base-100' : ''}`;

const getRadioClasses = (isPopup: boolean): string =>
  `radio radio-primary ${isPopup ? 'transition-all duration-200' : ''}`;

const getSelectClasses = (isPopup: boolean): string =>
  `select select-bordered ${isPopup ? 'rounded-lg bg-base-100/70 shadow-sm transition-all duration-200 hover:bg-base-100' : ''}`;

const parseNumberInput = (value: string, fallback: number): number => {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isNaN(parsedValue) ? fallback : parsedValue;
};

const customButtonIds: PresetButtonId[] = ['custom_1', 'custom_2', 'custom_3'];

interface DelaySettingsComponentProps {
  isPopup?: boolean;
  topContent?: React.ReactNode;
}

function DelaySettingsComponent({
  isPopup = false,
  topContent,
}: DelaySettingsComponentProps): React.ReactElement {
  const { t } = useTranslation();
  const { loading, resetSettings, saveSettings, settings, updateSetting } =
    useDelaySettings();
  const [saved, setSaved] = useState(false);
  const hasVisibleButtons = settings.visiblePresetButtons.length > 0;

  useEffect(() => {
    if (!saved) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setSaved(false), 2000);

    return () => window.clearTimeout(timeout);
  }, [saved]);

  const handleSave = async (): Promise<void> => {
    if (!hasVisibleButtons) {
      return;
    }

    await saveSettings();
    setSaved(true);
  };

  const isButtonVisible = (buttonId: PresetButtonId): boolean =>
    settings.visiblePresetButtons.includes(buttonId);

  const setButtonVisibility = (
    buttonId: PresetButtonId,
    visible: boolean
  ): void => {
    const nextVisibleButtons = visible
      ? settings.visiblePresetButtons.includes(buttonId)
        ? settings.visiblePresetButtons
        : settings.visiblePresetButtons.concat(buttonId)
      : settings.visiblePresetButtons.filter((id) => id !== buttonId);

    updateSetting('visiblePresetButtons', nextVisibleButtons);

    const customButtonIndex = customButtonIds.indexOf(buttonId);

    if (customButtonIndex >= 0) {
      const nextCustomButtons = settings.customButtons.map((button, index) =>
        index === customButtonIndex
          ? {
              ...button,
              enabled: visible,
            }
          : button
      ) as typeof settings.customButtons;

      updateSetting('customButtons', nextCustomButtons);
    }
  };

  const updateCustomButton = (
    index: number,
    field: 'enabled' | 'label' | 'hours' | 'minutes',
    value: boolean | string | number
  ): void => {
    const nextCustomButtons = settings.customButtons.map((button, buttonIndex) =>
      buttonIndex === index
        ? {
            ...button,
            [field]: value,
          }
        : button
    ) as typeof settings.customButtons;

    updateSetting('customButtons', nextCustomButtons);
  };

  if (loading) {
    return (
      <div className='p-8 text-center'>
        <span className='loading loading-spinner loading-lg' />
      </div>
    );
  }

  return (
    <div
      className={`card mx-auto w-full max-w-4xl bg-base-300 ${!isPopup ? 'border border-base-300 shadow-sm transition-shadow duration-300 hover:shadow-md' : ''}`}
    >
      <div className='card-body p-6 sm:p-8'>
        <h2 className='card-title mb-4'>{t('settings.defaultDelayOptions')}</h2>

        <div className='space-y-4'>
          {topContent}

          <div className='space-y-4'>
            <section className='rounded-xl bg-base-100/50 p-4'>
              <div className='mb-4 flex items-center justify-between gap-4'>
                <div>
                  <h3 className='text-base font-semibold'>
                    {t('settings.presetButtons.later_today')}
                  </h3>
                </div>
                <label className='label cursor-pointer gap-3 py-0'>
                  <span className='label-text'>{t('settings.showButton')}</span>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={isButtonVisible('later_today')}
                    onChange={(event) =>
                      setButtonVisibility('later_today', event.target.checked)
                    }
                  />
                </label>
              </div>
              <fieldset
                disabled={!isButtonVisible('later_today')}
                className={!isButtonVisible('later_today') ? 'opacity-50' : ''}
              >
                <div className='flex flex-wrap items-center gap-2'>
                  <input
                    type='number'
                    className={`${getInputClasses(isPopup)} w-20`}
                    min='0'
                    max='12'
                    value={settings.laterToday}
                    onChange={(event) =>
                      updateSetting(
                        'laterToday',
                        parseNumberInput(event.target.value, 0)
                      )
                    }
                  />
                  <span>{t('settings.hours')}</span>
                  <input
                    type='number'
                    className={`${getInputClasses(isPopup)} w-20`}
                    min='0'
                    max='59'
                    step='5'
                    value={settings.laterTodayMinutes}
                    onChange={(event) =>
                      updateSetting(
                        'laterTodayMinutes',
                        parseNumberInput(event.target.value, 0)
                      )
                    }
                  />
                  <span>{t('settings.minutes')}</span>
                </div>
              </fieldset>
            </section>

            <section className='rounded-xl bg-base-100/50 p-4'>
              <div className='mb-4 flex items-center justify-between gap-4'>
                <h3 className='text-base font-semibold'>
                  {t('settings.presetButtons.tonight')}
                </h3>
                <label className='label cursor-pointer gap-3 py-0'>
                  <span className='label-text'>{t('settings.showButton')}</span>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={isButtonVisible('tonight')}
                    onChange={(event) =>
                      setButtonVisibility('tonight', event.target.checked)
                    }
                  />
                </label>
              </div>
              <fieldset
                disabled={!isButtonVisible('tonight')}
                className={!isButtonVisible('tonight') ? 'opacity-50' : ''}
              >
                <input
                  type='time'
                  className={`${getInputClasses(isPopup)} w-full max-w-72`}
                  value={settings.tonightTime}
                  onChange={(event) =>
                    updateSetting('tonightTime', event.target.value)
                  }
                  style={{ appearance: 'none' }}
                />
              </fieldset>
            </section>

            <section className='rounded-xl bg-base-100/50 p-4'>
              <div className='mb-4 flex items-center justify-between gap-4'>
                <h3 className='text-base font-semibold'>
                  {t('settings.presetButtons.tomorrow')}
                </h3>
                <label className='label cursor-pointer gap-3 py-0'>
                  <span className='label-text'>{t('settings.showButton')}</span>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={isButtonVisible('tomorrow')}
                    onChange={(event) =>
                      setButtonVisibility('tomorrow', event.target.checked)
                    }
                  />
                </label>
              </div>
              <fieldset
                disabled={!isButtonVisible('tomorrow')}
                className={!isButtonVisible('tomorrow') ? 'opacity-50' : ''}
              >
                <input
                  type='time'
                  className={`${getInputClasses(isPopup)} w-full max-w-72`}
                  value={settings.tomorrowTime}
                  onChange={(event) =>
                    updateSetting('tomorrowTime', event.target.value)
                  }
                  style={{ appearance: 'none' }}
                />
              </fieldset>
            </section>

            <section className='rounded-xl bg-base-100/50 p-4'>
              <div className='mb-4 flex items-center justify-between gap-4'>
                <h3 className='text-base font-semibold'>
                  {t('settings.presetButtons.weekend')}
                </h3>
                <label className='label cursor-pointer gap-3 py-0'>
                  <span className='label-text'>{t('settings.showButton')}</span>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={isButtonVisible('weekend')}
                    onChange={(event) =>
                      setButtonVisibility('weekend', event.target.checked)
                    }
                  />
                </label>
              </div>
              <fieldset
                disabled={!isButtonVisible('weekend')}
                className={!isButtonVisible('weekend') ? 'opacity-50' : ''}
              >
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <select
                    className={`${getSelectClasses(isPopup)} w-full max-w-72`}
                    value={settings.weekendDay}
                    onChange={(event) =>
                      updateSetting(
                        'weekendDay',
                        event.target.value as 'saturday' | 'sunday'
                      )
                    }
                  >
                    <option value='saturday'>{t('popup.weekdays.saturday')}</option>
                    <option value='sunday'>{t('popup.weekdays.sunday')}</option>
                  </select>
                  <input
                    type='time'
                    className={`${getInputClasses(isPopup)} w-full max-w-72`}
                    value={settings.weekendTime}
                    onChange={(event) =>
                      updateSetting('weekendTime', event.target.value)
                    }
                    style={{ appearance: 'none' }}
                  />
                </div>
              </fieldset>
            </section>

            <section className='rounded-xl bg-base-100/50 p-4'>
              <div className='mb-4 flex items-center justify-between gap-4'>
                <h3 className='text-base font-semibold'>
                  {t('settings.presetButtons.next_week')}
                </h3>
                <label className='label cursor-pointer gap-3 py-0'>
                  <span className='label-text'>{t('settings.showButton')}</span>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={isButtonVisible('next_week')}
                    onChange={(event) =>
                      setButtonVisibility('next_week', event.target.checked)
                    }
                  />
                </label>
              </div>
              <fieldset
                disabled={!isButtonVisible('next_week')}
                className={!isButtonVisible('next_week') ? 'opacity-50' : ''}
              >
                <div className='mb-2 flex items-center'>
                  <div className='form-control'>
                    <label className='label cursor-pointer'>
                      <input
                        type='radio'
                        name='nextWeekOption'
                        className={getRadioClasses(isPopup)}
                        checked={settings.nextWeekSameDay}
                        onChange={() => updateSetting('nextWeekSameDay', true)}
                      />
                      <span className='label-text ml-2'>
                        {t('settings.sameDayOfWeek')}
                      </span>
                    </label>
                  </div>
                  <div className='form-control ml-4'>
                    <label className='label cursor-pointer'>
                      <input
                        type='radio'
                        name='nextWeekOption'
                        className={getRadioClasses(isPopup)}
                        checked={!settings.nextWeekSameDay}
                        onChange={() => updateSetting('nextWeekSameDay', false)}
                      />
                      <span className='label-text ml-2'>
                        {t('settings.specificDay')}
                      </span>
                    </label>
                  </div>
                </div>

                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  {!settings.nextWeekSameDay && (
                    <select
                      className={`${getSelectClasses(isPopup)} w-full max-w-72`}
                      value={settings.nextWeekDay}
                      onChange={(event) =>
                        updateSetting('nextWeekDay', parseInt(event.target.value, 10))
                      }
                    >
                      <option value='0'>{t('popup.weekdays.sunday')}</option>
                      <option value='1'>{t('popup.weekdays.monday')}</option>
                      <option value='2'>{t('popup.weekdays.tuesday')}</option>
                      <option value='3'>{t('popup.weekdays.wednesday')}</option>
                      <option value='4'>{t('popup.weekdays.thursday')}</option>
                      <option value='5'>{t('popup.weekdays.friday')}</option>
                      <option value='6'>{t('popup.weekdays.saturday')}</option>
                    </select>
                  )}
                  <input
                    type='time'
                    className={`${getInputClasses(isPopup)} w-full max-w-72`}
                    value={settings.nextWeekTime}
                    onChange={(event) =>
                      updateSetting('nextWeekTime', event.target.value)
                    }
                    style={{ appearance: 'none' }}
                  />
                </div>
              </fieldset>
            </section>

            <section className='rounded-xl bg-base-100/50 p-4'>
              <div className='mb-4 flex items-center justify-between gap-4'>
                <h3 className='text-base font-semibold'>
                  {t('settings.presetButtons.next_month')}
                </h3>
                <label className='label cursor-pointer gap-3 py-0'>
                  <span className='label-text'>{t('settings.showButton')}</span>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={isButtonVisible('next_month')}
                    onChange={(event) =>
                      setButtonVisibility('next_month', event.target.checked)
                    }
                  />
                </label>
              </div>
              <fieldset
                disabled={!isButtonVisible('next_month')}
                className={!isButtonVisible('next_month') ? 'opacity-50' : ''}
              >
                <div className='flex items-center'>
                  <div className='form-control'>
                    <label className='label cursor-pointer'>
                      <input
                        type='radio'
                        name='nextMonthOption'
                        className={getRadioClasses(isPopup)}
                        checked={settings.nextMonthSameDay}
                        onChange={() => updateSetting('nextMonthSameDay', true)}
                      />
                      <span className='label-text ml-2'>
                        {t('settings.sameDayOfMonth')}
                      </span>
                    </label>
                  </div>
                  <div className='form-control ml-4'>
                    <label className='label cursor-pointer'>
                      <input
                        type='radio'
                        name='nextMonthOption'
                        className={getRadioClasses(isPopup)}
                        checked={!settings.nextMonthSameDay}
                        onChange={() => updateSetting('nextMonthSameDay', false)}
                      />
                      <span className='label-text ml-2'>
                        {t('settings.sameDayOfWeek')}
                      </span>
                    </label>
                  </div>
                </div>
              </fieldset>
            </section>

            <section className='rounded-xl bg-base-100/50 p-4'>
              <div className='mb-4 flex items-center justify-between gap-4'>
                <h3 className='text-base font-semibold'>
                  {t('settings.presetButtons.someday')}
                </h3>
                <label className='label cursor-pointer gap-3 py-0'>
                  <span className='label-text'>{t('settings.showButton')}</span>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={isButtonVisible('someday')}
                    onChange={(event) =>
                      setButtonVisibility('someday', event.target.checked)
                    }
                  />
                </label>
              </div>
              <fieldset
                disabled={!isButtonVisible('someday')}
                className={!isButtonVisible('someday') ? 'opacity-50' : ''}
              >
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <div>
                    <label className='label'>
                      <span className='label-text'>{t('settings.minMonths')}</span>
                    </label>
                    <input
                      type='number'
                      className={`${getInputClasses(isPopup)} w-20`}
                      min='1'
                      max='12'
                      value={settings.somedayMinMonths}
                      onChange={(event) =>
                        updateSetting(
                          'somedayMinMonths',
                          parseNumberInput(event.target.value, 1)
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className='label'>
                      <span className='label-text'>{t('settings.maxMonths')}</span>
                    </label>
                    <input
                      type='number'
                      className={`${getInputClasses(isPopup)} w-20`}
                      min={settings.somedayMinMonths + 1}
                      max='36'
                      value={settings.somedayMaxMonths}
                      onChange={(event) =>
                        updateSetting(
                          'somedayMaxMonths',
                          parseNumberInput(
                            event.target.value,
                            settings.somedayMinMonths + 1
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </fieldset>
            </section>

            <section className='rounded-xl bg-base-100/50 p-4'>
              <div className='flex items-center justify-between gap-4'>
                <h3 className='text-base font-semibold'>
                  {t('settings.presetButtons.custom_date_time')}
                </h3>
                <label className='label cursor-pointer gap-3 py-0'>
                  <span className='label-text'>{t('settings.showButton')}</span>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={isButtonVisible('custom_date_time')}
                    onChange={(event) =>
                      setButtonVisibility('custom_date_time', event.target.checked)
                    }
                  />
                </label>
              </div>
            </section>

            <section className='rounded-xl bg-base-100/50 p-4'>
              <div className='flex items-center justify-between gap-4'>
                <h3 className='text-base font-semibold'>
                  {t('settings.presetButtons.recurring')}
                </h3>
                <label className='label cursor-pointer gap-3 py-0'>
                  <span className='label-text'>{t('settings.showButton')}</span>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={isButtonVisible('recurring')}
                    onChange={(event) =>
                      setButtonVisibility('recurring', event.target.checked)
                    }
                  />
                </label>
              </div>
            </section>

            {settings.customButtons.map((button, index) => {
              const buttonId = customButtonIds[index];
              const isVisible = isButtonVisible(buttonId);

              return (
                <section
                  key={`custom-button-${index + 1}`}
                  className='rounded-xl bg-base-100/50 p-4'
                >
                  <div className='mb-4 flex items-center justify-between gap-4'>
                    <h3 className='text-base font-semibold'>
                      {button.label ||
                        t('settings.customButtonLabel', {
                          index: index + 1,
                        })}
                    </h3>
                    <label className='label cursor-pointer gap-3 py-0'>
                      <span className='label-text'>{t('settings.showButton')}</span>
                      <input
                        type='checkbox'
                        className='toggle toggle-primary'
                        checked={isVisible}
                        onChange={(event) =>
                          setButtonVisibility(buttonId, event.target.checked)
                        }
                      />
                    </label>
                  </div>

                  <fieldset
                    disabled={!isVisible}
                    className={!isVisible ? 'opacity-50' : ''}
                  >
                    <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end'>
                      <label className='form-control'>
                        <span className='mb-2 text-xs font-medium text-base-content/70'>
                          {t('settings.buttonName')}
                        </span>
                        <input
                          type='text'
                          className={getInputClasses(isPopup)}
                          value={button.label}
                          onChange={(event) =>
                            updateCustomButton(index, 'label', event.target.value)
                          }
                        />
                      </label>
                      <label className='form-control'>
                        <span className='mb-2 text-xs font-medium text-base-content/70'>
                          {t('settings.hours')}
                        </span>
                        <input
                          type='number'
                          className={`${getInputClasses(isPopup)} w-20`}
                          min='0'
                          max='24'
                          value={button.hours}
                          onChange={(event) =>
                            updateCustomButton(
                              index,
                              'hours',
                              parseNumberInput(event.target.value, 0)
                            )
                          }
                        />
                      </label>
                      <label className='form-control'>
                        <span className='mb-2 text-xs font-medium text-base-content/70'>
                          {t('settings.minutes')}
                        </span>
                        <input
                          type='number'
                          className={`${getInputClasses(isPopup)} w-20`}
                          min='0'
                          max='59'
                          value={button.minutes}
                          onChange={(event) =>
                            updateCustomButton(
                              index,
                              'minutes',
                              parseNumberInput(event.target.value, 0)
                            )
                          }
                        />
                      </label>
                    </div>
                  </fieldset>
                </section>
              );
            })}
          </div>
        </div>

        <div className='card-actions mt-6 justify-end'>
          <button
            type='button'
            className='btn btn-outline'
            onClick={resetSettings}
          >
            {t('settings.reset')}
          </button>
          <button
            type='button'
            className='btn btn-primary'
            onClick={handleSave}
            disabled={!hasVisibleButtons}
          >
            {t('common.save')}
          </button>
        </div>

        {!hasVisibleButtons && (
          <div className='mt-4 text-center text-error'>
            {t('settings.selectAtLeastOneButton')}
          </div>
        )}

        {saved && (
          <div className='mt-4 text-center text-success'>
            {t('settings.saved')}
          </div>
        )}
      </div>
    </div>
  );
}

export default DelaySettingsComponent;
