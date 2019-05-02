const initialState = {
  fetching: false,
  graphData: null,
};

export default (state = initialState, action) => {
  switch(action.type) {
    case "RECEIVED_GRAPH_DATA":
      return {...state, fetched:true, err:null, graphData:action.payload, graphParams: action.graphParams};
    case "RESET_GRAPH_DATA":
      return {...state, fetched:false, err:null, graphData:null};
    case "RECEIVED_GRAPH_ERROR":
      return {...state, err: action.payload, graphData:null};
    default:
      break;
  }
  return state;
}
