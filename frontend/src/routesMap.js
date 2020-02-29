import { handleGraphParams } from './actions';
import { Agencies } from './config';
import { initialGraphParams } from './reducers';

export const DATE = 'date';
export const START_DATE = 'startDate';
export const START_TIME = 'startTime';
export const END_TIME = 'endTime';
export const DAYS_OF_THE_WEEK = 'daysOfTheWeek';

/**
 * Gets the string values from a date range object within a query string.
 *
 * @param dateRangeQuery A query subobject representing a date range.
 * @returns A graphParams subobject representing a date range.
 */
function processDateRangeQuery(dateRangeQuery) {
  const initialDateRangeParams = initialGraphParams.firstDateRange;

  if (!dateRangeQuery) {
    return null;
  }
  const { date, startDate, startTime, endTime, daysOfTheWeek } = dateRangeQuery;

  // If the values are missing, we must use the defaults, in case the user is changing
  // from a nondefault to default value.

  const newDateRangeParams = {
    date: date || initialDateRangeParams.date,
    startDate: startDate || initialDateRangeParams.startDate,
    startTime: startTime || null,
    endTime: endTime || null,
  };

  if (daysOfTheWeek) {
    // Deserialization via the actual query string gives us an object with values of strings
    // "true" or "false", which we need to convert to booleans.  When we get here via
    // dispatch, then the values are already primitive booleans.

    newDateRangeParams.daysOfTheWeek = Object.keys(daysOfTheWeek).reduce(
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
    newDateRangeParams.daysOfTheWeek = initialDateRangeParams.daysOfTheWeek;
  }
  return newDateRangeParams;
}

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

  // Assume defaults
  let firstDateRangeParams = initialGraphParams.firstDateRange;
  let secondDateRangeParams = null;

  // Then if there is a date range object in the query, use that.
  if (location.query) {
    firstDateRangeParams = processDateRangeQuery(location.query.firstDateRange);
    if (!firstDateRangeParams) {
      // If there is a query but no first date range values, then
      // use defaults.
      firstDateRangeParams = initialGraphParams.firstDateRange;
    }
    secondDateRangeParams = processDateRangeQuery(
      location.query.secondDateRange,
    );
  }

  const newParams = {
    agencyId: Agencies[0].id, // todo: add agency to path to support multiple agencies
    firstDateRange: firstDateRangeParams,
    secondDateRange: secondDateRangeParams,
  };

  return newParams;
}

/**
 * Helper function to build a query's date range subobject.
 * @param params The graphParams subobject.
 * @returns The query subobject.
 */
export function dateQueryFromDateRangeParams(params) {
  const dateQuery = {};
  const initialDateRangeParams = initialGraphParams.firstDateRange;

  if (!params) {
    return undefined; // this range should not be serialized at all
  }
  if (params.startDate !== initialDateRangeParams.startDate) {
    dateQuery.startDate = params.startDate;
  }
  if (params.date !== initialDateRangeParams.date) {
    dateQuery.date = params.date;
  }
  if (params.startTime !== initialDateRangeParams.startTime) {
    dateQuery.startTime = params.startTime;
  }
  if (params.endTime !== initialDateRangeParams.endTime) {
    dateQuery.endTime = params.endTime;
  }
  if (
    JSON.stringify(initialDateRangeParams.daysOfTheWeek) !==
    JSON.stringify(params.daysOfTheWeek)
  ) {
    dateQuery.daysOfTheWeek = params.daysOfTheWeek;
  }
  return dateQuery;
}

/**
 * Builds a query object from a graphParams object. This should be used by any code
 * that needs to update/regenerate the query string in the url.
 *
 * @param {Object} params The current Redux state.
 * @returns The query object to dispatch.
 */
export function fullQueryFromParams(params) {
  const query = {};
  query.firstDateRange = dateQueryFromDateRangeParams(params.firstDateRange);
  query.secondDateRange = params.secondDateRange || undefined;
  return query;
}

export default {
  HOME: '/',
  ABOUT: '/about',
  ISOCHRONE: {
    path: '/isochrone',
    thunk: async (dispatch, getState) => {
      const newParams = processQuery(getState);
      dispatch(handleGraphParams(newParams));
    },
  },
  DASHBOARD: {
    path: '/metrics',
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
