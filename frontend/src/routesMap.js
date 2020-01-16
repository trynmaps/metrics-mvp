import { handleGraphParams } from './actions';
import { Agencies } from './config';

export const DATE = 'date';
export const START_DATE = 'startDate';
export const START_TIME = 'startTime';
export const END_TIME = 'endTime';
export const DAYS_OF_THE_WEEK = 'daysOfTheWeek';

export default {
  ABOUT: '/about',
  LANDING: '/landing',
  ISOCHRONE: '/isochrone',
  DASHBOARD: '/',
  DATADIAGNOSTIC: '/dataDiagnostic',
  ROUTESCREEN: {
    /*
    Redux first router path syntax
    https://github.com/faceyspacey/redux-first-router/issues/83
    the : symbol signifies variables
    the ? after the : means an optional paramter variable
    ()* shows am optional parameter label
    */
    path: `/route/:routeId/:directionId?/:startStopId?/:endStopId?`
      + `/(${DATE})*/:date?/(${START_DATE})*/:startDate?`
      + `/(${START_TIME})*/:startTime?/(${END_TIME})*/:endTime?`
      + `/(${DAYS_OF_THE_WEEK})*/:daysOfTheWeek?`
      ,

    thunk: async (dispatch, getState) => {
      const { location } = getState();
      const { routeId, directionId, startStopId, endStopId,
        date, startDate, startTime, endTime /*, daysOfTheWeek*/} = location.payload;

      const newParams = {
        agencyId: Agencies[0].id,
        routeId,
        directionId,
        startStopId,
        endStopId
      };
      // these are "optional" in urls -- if null (absent) or "null" (serialized to url with no value), do not override existing state
      if (date && date !== 'null') {
        newParams['date'] = date;
      }
      if (startDate && startDate !== 'null') {
        newParams['startDate'] = startDate;
      }
      if (startTime && startTime !== 'null') {
        newParams['startTime'] = startTime;
      }
      if (endTime && endTime !== 'null') {
        newParams['endTime'] = endTime;
      }
      // daysOfTheWeek TODO: serialize and deserialize days of the week into dictionary  */
      // todo: add agency to path to support multiple agencies
      dispatch(
        handleGraphParams(newParams)
      );
    },
  },
};
