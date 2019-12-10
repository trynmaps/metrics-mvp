const initialState = {
  graphData: null,
  intervalData: null,
};

export default (state = initialState, action) => {
  switch (action.type) {
    case 'RECEIVED_GRAPH_DATA':
      const payloadData = action.payload.data;
      const routeMetrics = payloadData && payloadData.routeMetrics;
      const tripMetrics = routeMetrics && routeMetrics.trip;
      const intervalMetrics = tripMetrics && tripMetrics.interval;
      const timeRangeMetrics = tripMetrics && tripMetrics.timeRanges;
      const byDayMetrics = tripMetrics && tripMetrics.byDay;

      return {
        ...state,
        err: null,
        graphData: intervalMetrics,
        intervalData: timeRangeMetrics,
        byDayData: byDayMetrics,
        graphParams: action.graphParams,
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
