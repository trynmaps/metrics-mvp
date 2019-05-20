const initialState = {
  fetching: false,
  tripTimes: null,
};

export default (state = initialState, action) => {
  switch(action.type) {
    case "RECEIVED_TRIP_TIMES":
      return {...state,fetched:true, tripTimes:action.payload};
    case "RECEIVED_TRIP_TIMES_ERROR":
      return state;
    default:
      return state;
  }
}
