import { handleGraphParams } from './actions';
import { Agencies } from './config';
import { initialGraphParams } from './reducers';

export const DATE = 'date';
export const START_DATE = 'startDate';
export const START_TIME = 'startTime';
export const END_TIME = 'endTime';
export const DAYS_OF_THE_WEEK = 'daysOfTheWeek';

/**
 * Gets the string values from the query into an object that can be used as graphParams
 * if the route does not provide any values, or merged into graphParams if the route does
 * provide values.
 *
 * @param getState
 * @returns The new graphParams.
 */
function processQuery(getState) {
  const { location } = getState();
  const { date, startDate, startTime, endTime, daysOfTheWeek } =
    location.query || {};

  // If the values are missing, we must use the defaults, in case the user is changing
  // from a nondefault to default value.

  const newParams = {
    agencyId: Agencies[0].id, // todo: add agency to path to support multiple agencies
    date: date || initialGraphParams.date,
    startDate: startDate || initialGraphParams.startDate,
    startTime: startTime || null,
    endTime: endTime || null,
  };

  if (daysOfTheWeek) {
    // Deserialization via the actual query string gives us an object with values of strings
    // "true" or "false", which we need to convert to booleans.  When we get here via
    // dispatch, then the values are already primitive booleans.

    newParams.daysOfTheWeek = Object.keys(daysOfTheWeek).reduce(
      (newDaysOfTheWeek, key) => {
        if (typeof daysOfTheWeek[key] === 'string') {
          newDaysOfTheWeek[key] = daysOfTheWeek[key].toUpperCase() === 'TRUE';
        } else {
          newDaysOfTheWeek[key] = daysOfTheWeek[key];
        }
        return newDaysOfTheWeek;
      },
      {},
    );
  } else {
    newParams.daysOfTheWeek = initialGraphParams.daysOfTheWeek;
  }
  return newParams;
}

/**
 * This function is the reverse of the above method, building a query object from
 * a graphParams object. This should be used by any code that needs to update/regenerate
 * the query string in the url.
 *
 * @param {Object} params The current graphParams state.
 * @returns The query object to dispatch.
 */
export function queryFromParams(params) {
  const query = {};

  if (params.startDate !== initialGraphParams.startDate) {
    query.startDate = params.startDate;
  }
  if (params.date !== initialGraphParams.date) {
    query.date = params.date;
  }
  if (params.startTime !== initialGraphParams.startTime) {
    query.startTime = params.startTime;
  }
  if (params.endTime !== initialGraphParams.endTime) {
    query.endTime = params.endTime;
  }
  if (
    JSON.stringify(initialGraphParams.daysOfTheWeek) !==
    JSON.stringify(params.daysOfTheWeek)
  ) {
    query.daysOfTheWeek = params.daysOfTheWeek;
  }
  return query;
}

export default {
  ABOUT: '/about',
  LANDING: '/landing',
  ISOCHRONE: {
    path: '/isochrone',
    thunk: async (dispatch, getState) => {
      const newParams = processQuery(getState);
      dispatch(handleGraphParams(newParams));
    },
  },
  DASHBOARD: {
    path: '/',
    thunk: async (dispatch, getState) => {
      const newParams = processQuery(getState);
      dispatch(handleGraphParams(newParams));
    },
  },
  DATADIAGNOSTIC: {
    path: '/dataDiagnostic',
    thunk: async (dispatch, getState) => {
      const newParams = processQuery(getState);
      dispatch(handleGraphParams(newParams));
    },
  },
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
        endStopId,
      };

      Object.assign(newParams, processQuery(getState));
      dispatch(handleGraphParams(newParams));
    },
  },
};
