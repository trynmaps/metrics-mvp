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
    default:
      return state;
  }
};
