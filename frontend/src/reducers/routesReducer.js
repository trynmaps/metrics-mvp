/* eslint-disable no-case-declarations */
import Moment from 'moment';
import { WEEKDAYS, WEEKENDS } from '../UIConstants';

const momentYesterday = Moment(Date.now() - 24 * 60 * 60 * 1000);

// Make the initialState available to the rest of the app when resetting to default values.
export const initialState = {
  routes: null,
  spiderSelection: [],
  graphParams: {
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
    daysOfTheWeek: {
      ...WEEKDAYS.reduce((map, obj) => {
        map[obj.value] = true;
        return map;
      }, {}),
      ...WEEKENDS.reduce((map, obj) => {
        map[obj.value] = true;
        return map;
      }, {}),
    },
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
    case 'ERROR_ROUTES':
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
    case 'ERROR_ARRIVALS':
      return {
        ...state,
        arrivals: null,
        arrivalsErr: action.payload,
      };
    default:
      return state;
  }
};
