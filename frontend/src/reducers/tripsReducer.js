import * as Papa from 'papaparse';

const initialState = {
  fetching: false,
  trips: null,
};

export default (state = initialState, action) => {
  switch(action.type) {
    case "RECEIVED_TRIPS":
      const results = Papa.parse(action.payload, { header: true, fastMode: true /* because no quoted values */ });
      // xxx error check
      return {...state,fetched:true, trips: results.data};
    case "RECEIVED_TRIPS_ERROR":
      return state;
    default:
      return state;
  }
}
