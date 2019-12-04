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
      const intervalMetrics2 = tripMetrics && tripMetrics.interval2 ? tripMetrics.interval2 : null;
      const timeRangeMetrics2 = tripMetrics && tripMetrics.timeRanges2 ? tripMetrics.timeRanges2 : null;

      return {
        ...state,
        err: null,
        graphData: intervalMetrics,
        graphData2: intervalMetrics2,
        intervalData: timeRangeMetrics,
        intervalData2: timeRangeMetrics2,
      };
    case 'RESET_GRAPH_DATA':
      return { ...state, err: null, graphData: null };
    case 'ERROR_GRAPH_DATA':
      return { ...state, err: action.payload, graphData: null };
    default:
      break;
  }
  return state;
};
