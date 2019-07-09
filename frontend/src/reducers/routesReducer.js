/* eslint-disable no-case-declarations */
const initialState = {
  fetching: false,
  routes: null,
  spiderSelection: [],
  graphParams: {
    route_id: null,
    direction_id: null,
    start_stop_id: null,
    end_stop_id: null,
    start_time: null,
    end_time: null,
    date: '2019-06-06',
  },
  spiderLatLng: null, 
  tripTimesCache: {},
  waitTimesCache: {},
};

export default (state = initialState, action) => {
  switch (action.type) {
    case 'RECEIVED_ROUTES':
      return { ...state, fetched: true, routes: action.payload };
    case 'RECEIVED_SPIDER_MAP_CLICK':
      return { ...state, fetched: true, spiderSelection: action.payload[0], spiderLatLng: action.payload[1]};
    case 'RECEIVED_GRAPH_PARAMS':
      return { ...state, fetched: true, graphParams: Object.assign({}, state.graphParams, action.payload) };
    case 'RECEIVED_ROUTES_ERROR':
      return state;
    case 'RECEIVED_PRECOMPUTED_TRIP_TIMES':
      return { ...state, fetched: true, tripTimesCache: { ...state.tripTimesCache,
        [action.payload[1]]: action.payload[0] }} ; // add new dictionary entry into tripTimesCache
    case 'RECEIVED_PRECOMPUTED_WAIT_TIMES':
      return { ...state, fetched: true, waitTimesCache: { ...state.waitTimesCache,
        [action.payload[1]]: action.payload[0] }} ; // add new dictionary entry into waitTimesCache
    default:
      return state;
  }
};
