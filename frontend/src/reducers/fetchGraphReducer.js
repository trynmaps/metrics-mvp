const initialState = {
  graphData: null,
  intervalData: null,
};

export default (state = initialState, action) => {
  switch (action.type) {
    case 'RECEIVED_GRAPH_DATA':
      const payloadData = action.payload.data;
      const routeMetrics = payloadData ? payloadData.routeMetrics : null;
      const tripMetrics = routeMetrics ? routeMetrics.trip : null;
      const intervalMetrics = tripMetrics ? tripMetrics.interval : null;
      const timeRangeMetrics = tripMetrics ? tripMetrics.timeRanges : null;

      return {
        ...state,
        err: null,
        graphData: intervalMetrics,
        intervalData: timeRangeMetrics,
        graphParams: action.graphParams,
      };
    case 'RESET_GRAPH_DATA':
      return { ...state, err: null, graphData: null };
    case 'RECEIVED_GRAPH_ERROR':
      return { ...state, err: action.payload, graphData: null };
    default:
      break;
  }
  return state;
};
