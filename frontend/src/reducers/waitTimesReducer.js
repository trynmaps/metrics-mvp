const initialState = {
  fetching: false,
  waitTimes: null,
};

export default (state = initialState, action) => {
  switch(action.type) {
    case "RECEIVED_WAIT_TIMES":
      return {...state,fetched:true, waitTimes:action.payload};
    case "RECEIVED_WAIT_TIMES_ERROR":
      return state;
    default:
      return state;
  }
}
