/**
 * Helper functions for manipulating date and time.
 */

import Moment from 'moment';

import {
  WEEKDAYS,
  WEEKENDS,
  TIME_RANGES,
  TIME_RANGE_ALL_DAY,
} from '../UIConstants';

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
    return 'Every day';
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
 * convert yyyy/mm/dd to mm/dd/yyyy
 */
function convertDate(ymdString) {
  return Moment(ymdString).format('MM/DD/YYYY');
}

/**
 * Create the date range label and small descriptive label.
 *
 * @param {Object} dateRangeParams Date settings from Redux state
 */
export function generateDateLabels(dateRangeParams) {
  // these are the read-only representations of the date and time range
  let dateLabel = convertDate(dateRangeParams.date);
  let smallLabel = '';

  if (dateRangeParams.startDate !== dateRangeParams.date) {
    dateLabel = `${convertDate(dateRangeParams.startDate)} - ${dateLabel}`;

    // generate a days of the week label

    smallLabel = `${getDaysOfTheWeekLabel(dateRangeParams.daysOfTheWeek)}, `;
  }

  // convert the state's current time range to a string or the sentinel value
  const timeRange =
    dateRangeParams.startTime && dateRangeParams.endTime
      ? `${dateRangeParams.startTime}-${dateRangeParams.endTime}`
      : TIME_RANGE_ALL_DAY;

  smallLabel += TIME_RANGES.find(range => range.value === timeRange).shortLabel;

  return { dateLabel, smallLabel };
}
