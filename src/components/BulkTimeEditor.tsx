import React, { useState } from 'react';
import { DelayedTabsTimeChange } from '@types';
import {
  formatDateTimeLocalInput,
  getMinimumCustomDelayDate,
} from '@utils/dateTime';
import { useTranslation } from 'react-i18next';

interface BulkTimeEditorProps {
  count: number;
  pending: boolean;
  onApply: (change: DelayedTabsTimeChange) => Promise<void>;
  onCancel: () => void;
}

function BulkTimeEditor({
  count,
  pending,
  onApply,
  onCancel,
}: BulkTimeEditorProps): React.ReactElement {
  const { t } = useTranslation();
  const [duration, setDuration] = useState({
    days: '0',
    hours: '0',
    minutes: '0',
  });
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const durationValues = Object.values(duration).map(Number);
  const hasDuration =
    durationValues.every(
      (value) => Number.isSafeInteger(value) && value >= 0
    ) && durationValues.some((value) => value > 0);
  const hasFutureDate = new Date(date).getTime() > Date.now();

  const submit = (
    event: React.FormEvent<HTMLFormElement>,
    mode: 'add' | 'set'
  ): void => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (mode === 'add') {
      const values = ['days', 'hours', 'minutes'].map((field) =>
        Number(formData.get(field))
      );
      const durationMs =
        (values[0] * 24 * 60 + values[1] * 60 + values[2]) * 60_000;
      if (
        values.some((value) => !Number.isSafeInteger(value) || value < 0) ||
        !Number.isSafeInteger(durationMs) ||
        durationMs <= 0
      ) {
        setError(t('manageTabs.bulk.invalidDuration'));
        return;
      }
      setError(null);
      void onApply({ mode, durationMs });
    } else {
      const wakeTime = new Date(String(formData.get('wakeTime'))).getTime();
      if (!Number.isFinite(wakeTime) || wakeTime <= Date.now()) {
        setError(t('customDelay.invalidDate'));
        return;
      }
      setError(null);
      void onApply({ mode, wakeTime });
    }
  };

  return (
    <fieldset
      disabled={pending}
      className='mb-4 min-w-0 rounded-lg border border-base-content/15 p-4'
    >
      <legend className='px-1 text-sm font-semibold'>
        {t('manageTabs.bulk.title', { count })}
      </legend>
      <div className='flex flex-col sm:flex-row'>
        <form
          onSubmit={(event) => submit(event, 'set')}
          className='flex min-w-0 flex-1 flex-col'
        >
          <label className='form-control'>
            <span className='label label-text font-medium'>
              {t('customDelay.selectDateTime')}
            </span>
            <input
              type='datetime-local'
              name='wakeTime'
              required
              className='input input-bordered w-full min-w-0 border-none bg-base-100/50 shadow-sm transition-all duration-200 focus:bg-base-100/80'
              min={formatDateTimeLocalInput(
                getMinimumCustomDelayDate(new Date())
              )}
              value={date}
              onInput={(event) => {
                setDate(event.currentTarget.value);
                setError(null);
              }}
            />
          </label>
          <p className='mb-4 mt-3 text-xs text-base-content/70'>
            {t('manageTabs.bulk.setHint')}
          </p>
          <div className='mt-auto flex justify-end'>
            <button
              type='submit'
              disabled={!hasFutureDate}
              className='btn btn-primary border-none shadow-sm transition-all duration-200 hover:shadow'
            >
              {t('manageTabs.bulk.set')} ({count})
            </button>
          </div>
        </form>

        <div
          className='my-4 flex items-center gap-3 sm:mx-4 sm:my-0 sm:flex-col'
          aria-hidden='true'
        >
          <div className='h-px flex-1 bg-base-content/10 sm:w-px' />
          <span className='text-xs font-medium uppercase tracking-wide text-base-content/50'>
            {t('customDelay.or')}
          </span>
          <div className='h-px flex-1 bg-base-content/10 sm:w-px' />
        </div>

        <form
          onSubmit={(event) => submit(event, 'add')}
          className='flex min-w-0 flex-1 flex-col'
        >
          <h3 className='label label-text font-medium'>
            {t('manageTabs.bulk.add')}
          </h3>
          <div className='grid grid-cols-3 gap-2'>
            {(['days', 'hours', 'minutes'] as const).map((field) => (
              <label key={field} className='form-control min-w-0'>
                <span className='mb-2 text-xs font-medium text-base-content/70'>
                  {t(`customDelay.relative.${field}`)}
                </span>
                <input
                  type='number'
                  name={field}
                  min='0'
                  step='1'
                  inputMode='numeric'
                  required
                  className='input input-bordered w-full border-none bg-base-100/50 text-center shadow-sm transition-all duration-200 focus:bg-base-100/80'
                  value={duration[field]}
                  onFocus={(event) => event.currentTarget.select()}
                  onClick={(event) => event.currentTarget.select()}
                  onInput={(event) => {
                    setDuration({
                      ...duration,
                      [field]: event.currentTarget.value,
                    });
                    setError(null);
                  }}
                />
              </label>
            ))}
          </div>
          <p className='mb-4 mt-3 text-xs text-base-content/70'>
            {t('manageTabs.bulk.addHint')}
          </p>
          <div className='mt-auto flex justify-end'>
            <button
              type='submit'
              disabled={!hasDuration}
              className='btn btn-primary border-none shadow-sm transition-all duration-200 hover:shadow'
            >
              {t('manageTabs.bulk.add')} ({count})
            </button>
          </div>
        </form>
      </div>
      {error && (
        <p role='alert' className='mt-3 text-sm text-error'>
          {error}
        </p>
      )}
      <div className='mt-3 flex items-center justify-end gap-2'>
        {pending && (
          <span
            role='status'
            aria-label={t('common.loading')}
            className='loading loading-spinner loading-sm'
          />
        )}
        <button
          type='button'
          className='btn btn-ghost btn-sm'
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
      </div>
    </fieldset>
  );
}

export default BulkTimeEditor;
