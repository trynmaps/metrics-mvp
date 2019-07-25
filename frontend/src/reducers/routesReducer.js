/* eslint-disable no-case-declarations */
const initialState = {
  routes: null,
  spiderSelection: [],
  graphParams: {
    route_id: null,
    direction_id: null,
    start_stop_id: null,
    end_stop_id: null,
    start_time: null,
    end_time: null,
    date: '2019-07-01',
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
    default:
      return state;
  }
};
