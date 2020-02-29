/**
 * Helper functions for manipulating date and time.
 */

import { WEEKDAYS, WEEKENDS } from '../UIConstants';

/**
 * Whether all of array's entries in the dictionary are false.
 */
export const allFalse = (dictionary, array) => {
  for (let i = 0; i < array.length; i++) {
    if (dictionary[array[i].value]) {
      return false;
    }
  }
  return true;
};

/**
 * Whether all of array's entries in the dictionary are true.
 */
export const allTrue = (dictionary, array) => {
  for (let i = 0; i < array.length; i++) {
    if (!dictionary[array[i].value]) {
      return false;
    }
  }
  return true;
};

export function renderDateString(ymdString) {
  const date = new Date(ymdString);
  return date.toLocaleDateString('en', { timeZone: 'UTC' });
}

/**
 * Returns a string describing the selected days of the week.
 *
 * @param {Object} daysOfTheWeek Dictionary of booleans
 */
export function getDaysOfTheWeekLabel(daysOfTheWeek) {
  const weekdays = allTrue(daysOfTheWeek, WEEKDAYS);
  const weekends = allTrue(daysOfTheWeek, WEEKENDS);
  const noWeekdays = allFalse(daysOfTheWeek, WEEKDAYS);
  const noWeekends = allFalse(daysOfTheWeek, WEEKENDS);

  if (weekdays && weekends) {
    return '';
  }
  if (weekdays && noWeekends) {
    return 'Weekdays';
  }
  if (noWeekdays && weekends) {
    return 'Weekends';
  }

  // Look at all the checked days

  const allDays = WEEKDAYS.concat(WEEKENDS);
  const checkedDays = allDays.filter(
    currentValue => daysOfTheWeek[currentValue.value],
  );

  if (checkedDays.length === 0) {
    // no days checked

    return 'No days';
  }
  if (checkedDays.length === allDays.length - 1) {
    // just one unchecked day

    const uncheckedDay = allDays.filter(
      currentValue => !daysOfTheWeek[currentValue.value],
    );
    return `Except ${uncheckedDay[0].shortLabel}`;
  } // more than one unchecked

  const checkedLabels = checkedDays.reduce((accumulator, currentValue) => {
    accumulator.push(currentValue.shortLabel);
    return accumulator;
  }, []);
  return checkedLabels.join();
}

export function renderDateRange(dateRangeParams) {
  let dateLabel = renderDateString(dateRangeParams.date);
  let smallLabel = '';

  if (dateRangeParams.startDate !== dateRangeParams.date) {
    dateLabel = `${renderDateString(dateRangeParams.startDate)} - ${dateLabel}`;
    smallLabel = `${getDaysOfTheWeekLabel(dateRangeParams.daysOfTheWeek)}`;
  }

  return dateLabel + smallLabel;
}
