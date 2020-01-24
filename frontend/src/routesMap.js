import { handleGraphParams } from './actions';
import { Agencies } from './config';

export const DATE = 'date';
export const START_DATE = 'startDate';
export const START_TIME = 'startTime';
export const END_TIME = 'endTime';
export const DAYS_OF_THE_WEEK = 'daysOfTheWeek';

/**
 * Gets the string values into an object that be stored as graphParams.
 *
 * @param getState
 * @returns The new graphParams.
 */
function processQuery(getState) {

  const { location } = getState();
  const { date, startDate, startTime, endTime, daysOfTheWeek } = (location.query || {});

  const newParams = {
      agencyId: Agencies[0].id, // todo: add agency to path to support multiple agencies
  };

  if (date) {
    newParams['date'] = date;
  }
  if (startDate) {
    newParams['startDate'] = startDate;
  }
  if (startTime) {
    newParams['startTime'] = startTime;
  }
  if (endTime) {
    newParams['endTime'] = endTime;
  }
  if (daysOfTheWeek) {

    // Deserialization via the actual query string gives us an object with values of strings
    // "true" or "false", which we need to convert to booleans.  When we get here via
    // dispatch, then the values are already primitive booleans.

    newParams['daysOfTheWeek'] = Object.keys(daysOfTheWeek).reduce((newDaysOfTheWeek, key) => {
      if (typeof daysOfTheWeek[key] === "string") {
        newDaysOfTheWeek[key] = (daysOfTheWeek[key].toUpperCase() === 'TRUE');
      } else {
        newDaysOfTheWeek[key] = daysOfTheWeek[key];
      }
      return newDaysOfTheWeek;
    }, {});
  }
  return newParams;
}

export default {
  ABOUT: '/about',
  LANDING: '/landing',
  ISOCHRONE: {
    path: '/isochrone',
    thunk: async (dispatch, getState) => {
      const newParams = processQuery(getState);
      dispatch(handleGraphParams(newParams));
    }
  },
  DASHBOARD: {
    path: '/',
    thunk: async (dispatch, getState) => {
      const newParams = processQuery(getState);
      dispatch(handleGraphParams(newParams));
    }
  },
  DATADIAGNOSTIC: '/dataDiagnostic',
  ROUTESCREEN: {
    /*
    Redux first router path syntax
    https://github.com/faceyspacey/redux-first-router/issues/83
    the : symbol signifies variables
    the ? after the : means an optional paramter variable
    ()* shows am optional parameter label
    */
    path: `/route/:routeId/:directionId?/:startStopId?/:endStopId?`,
    thunk: async (dispatch, getState) => {
      const { location } = getState();
      const { routeId, directionId, startStopId, endStopId } = location.payload;

      const newParams = {
        routeId,
        directionId,
        startStopId,
        endStopId
      };

      Object.assign(newParams, processQuery(getState));
      dispatch(
        handleGraphParams(newParams)
      );
    },
  },
};
