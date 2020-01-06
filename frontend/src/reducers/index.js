import Moment from 'moment';
import { WEEKDAYS, WEEKENDS } from '../UIConstants';

export { default as loading } from './loadingReducer';
export { default as page } from './page';

const momentYesterday = Moment(Date.now() - 24 * 60 * 60 * 1000);

export const initialGraphParams = {
  agencyId: null,
  routeId: null,
  directionId: null,
  startStopId: null,
  endStopId: null,
  startTime: null,
  endTime: null,
  date: momentYesterday.format('YYYY-MM-DD'), // used where date ranges are not supported
  startDate: momentYesterday.format('YYYY-MM-DD'),
  // days of the week is an Object, where the keys are the day's values (0-6), and the value is true for enabled
  daysOfTheWeek: { ...WEEKDAYS.reduce((map, obj) => { map[obj.value] = true; return map}, {}),
                   ...WEEKENDS.reduce((map, obj) => { map[obj.value] = true; return map}, {})},
};

export function graphParams(state = initialGraphParams, action) {
  switch (action.type) {
    case 'RECEIVED_GRAPH_PARAMS':
      return {...state, ...action.params};
    default:
      return state;
  }
};

const initialRoutes = {
  data: null, // array of route config objects for Agencies[0]
};

export function routes(state = initialRoutes, action) {
  switch (action.type) {
    case 'RECEIVED_ROUTES':
      return { ...state, data: action.data };
    case 'ERROR_ROUTES':
      return state;
    default:
      return state;
  }
};

const initialTripMetrics = {
  data: null, // TripMetrics object returned by GraphQL API, containing 'interval' and 'timeRanges' properties
  error: null,
};

export function tripMetrics(state = initialTripMetrics, action) {
  switch (action.type) {
    case 'REQUEST_TRIP_METRICS':
      return {
        ...state,
        error: null,
        data: null,
      };
    case 'RECEIVED_TRIP_METRICS':
      return {
        ...state,
        error: null,
        data: action.data,
      };
    case 'ERROR_TRIP_METRICS':
      return {
        ...state,
        error: action.error,
        data: null
      };
    default:
      break;
  }
  return state;
};

const initialArrivals = {
  data: null,
  url: null,
  error: null,
};

export function arrivals(state = initialArrivals, action) {
  switch (action.type) {
    case 'RECEIVED_ARRIVALS':
      return {
        ...state,
        data: action.data,
        url: action.url,
        error: null,
      };
    case 'ERROR_ARRIVALS':
      return {
        ...state,
        data: null,
        error: action.error,
      };
    default:
      return state;
  }
}

const initialSpiderSelection = {
  stops: [],
  latLng: null,
};

export function spiderSelection(state = initialSpiderSelection, action) {
  switch (action.type) {
    case 'RECEIVED_SPIDER_MAP_CLICK':
      return {
        ...state,
        stops: action.stops,
        latLng: action.latLng,
      };
    default:
      return state;
  }
}

const initialPrecomputedStats = {
  waitTimes: null,
  waitTimesUrl: null,
  tripTimes: null,
  tripTimesUrl: null,
};

export function precomputedStats(state = initialPrecomputedStats, action) {
  switch (action.type) {
    case 'RECEIVED_PRECOMPUTED_WAIT_TIMES':
      return {
        ...state,
        waitTimesUrl: action.url,
        waitTimes: action.data,
      }
    case 'REQUEST_PRECOMPUTED_WAIT_TIMES':
      return {
        ...state,
        waitTimesUrl: action.url,
        waitTimes: null,
      };
    case 'RECEIVED_PRECOMPUTED_TRIP_TIMES':
      return {
        ...state,
        tripTimesUrl: action.url,
        tripTimes: action.data,
      }
    case 'REQUEST_PRECOMPUTED_TRIP_TIMES':
      return {
        ...state,
        tripTimesUrl: action.url,
        tripTimes: null,
      };
    default:
      return state;
  }
};
