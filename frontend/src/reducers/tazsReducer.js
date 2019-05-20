const initialState = {
  fetching: false,
  tazs: null,
};

export default (state = initialState, action) => {
  switch(action.type) {
    case "RECEIVED_TAZS":
      return {...state,fetched:true, tazs:action.payload};
    case "RECEIVED_TAZS_ERROR":
      return state;
    default:
      return state;
  }
}
