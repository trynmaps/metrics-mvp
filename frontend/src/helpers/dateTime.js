/**
 * Helper functions for manipulating date and time.
 */

import { WEEKDAYS, WEEKENDS, TIME_RANGES } from '../UIConstants';

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
 * Returns the short label for the given time range.
 *
 * @param {String} value - string in the format "startTime-endTime".
 */
export function getTimeRangeShortLabel(value) {
  const timeRange = TIME_RANGES.find(r => r.value === value);
  return timeRange ? timeRange.shortLabel : value;
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

/**
 * Returns a string describing the given date/time range parameters.
 */
export function renderDateRange(dateRangeParams) {
  const dateLabel = renderDateString(dateRangeParams.date);
  let res = '';

  if (dateRangeParams.startDate !== dateRangeParams.date) {
    res = `${renderDateString(dateRangeParams.startDate)} - ${dateLabel}`;
    const daysOfTheWeekLabel = getDaysOfTheWeekLabel(
      dateRangeParams.daysOfTheWeek,
    );
    if (daysOfTheWeekLabel) {
      res += ` ${daysOfTheWeekLabel}`;
    }
  } else {
    res = dateLabel;
  }

  if (dateRangeParams.startTime) {
    res += ` ${getTimeRangeShortLabel(
      `${dateRangeParams.startTime}-${dateRangeParams.endTime}`,
    )}`;
  }
  return res;
}
