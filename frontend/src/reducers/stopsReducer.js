const initialState = {
  fetching: false,
  stopData: null,
};

export default (state = initialState, action) => {
  switch(action.type) {
    case "RECEIVED_STOP_DATA":
        return {...state, fetched: true, stopData: action.payload}   
    default:
      break;
  }
  return state;
}
