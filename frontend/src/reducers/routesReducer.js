/* eslint-disable no-case-declarations */
import Moment from 'moment';

const momentYesterday = Moment(Date.now() - 24 * 60 * 60 * 1000);

// Make the initialState available to the rest of the app when resetting to default values.
export const initialState = {
  routes: null,
  spiderSelection: [],
  graphParams: {
    routeId: null,
    directionId: null,
    startStopId: null,
    endStopId: null,
    startTime: null,
    endTime: null,
    date: momentYesterday.format('YYYY-MM-DD'),
  },
  spiderLatLng: null,
  tripTimesCache: {},
  waitTimesCache: {},
};

export default (state = initialState, action) => {
  switch (action.type) {
    case 'RECEIVED_ROUTES':
      return { ...state, routes: action.payload };
    case 'RECEIVED_SPIDER_MAP_CLICK':
      return {
        ...state,
        spiderSelection: action.payload[0],
        spiderLatLng: action.payload[1],
      };
    case 'RECEIVED_GRAPH_PARAMS':
      return {
        ...state,
        graphParams: Object.assign({}, state.graphParams, action.payload),
      };
    case 'RECEIVED_ROUTES_ERROR':
      return state;
    case 'RECEIVED_PRECOMPUTED_TRIP_TIMES':
      return {
        ...state,
        tripTimesCache: {
          ...state.tripTimesCache,
          [action.payload[1]]: action.payload[0],
        },
      }; // add new dictionary entry into tripTimesCache
    case 'RECEIVED_PRECOMPUTED_WAIT_TIMES':
      return {
        ...state,
        waitTimesCache: {
          ...state.waitTimesCache,
          [action.payload[1]]: action.payload[0],
        },
      }; // add new dictionary entry into waitTimesCache
    case 'RECEIVED_ARRIVALS':
      return {
        ...state,
        arrivals: { ...action.payload[0], date: action.payload[1] }, // augment with date to simplify detection of date change
        arrivalsErr: null,
      };
    case 'RESET_ARRIVALS':
      return {
        ...state,
        arrivals: null,
        arrivalsErr: action.payload,
      };
    default:
      return state;
  }
};
