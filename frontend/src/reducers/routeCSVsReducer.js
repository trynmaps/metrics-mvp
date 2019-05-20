import * as Papa from 'papaparse';

const initialState = {
  fetching: false,
  routeCSVs: null,
};

export default (state = initialState, action) => {
  switch(action.type) {
    case "RECEIVED_ROUTE_CSVS":
      const results = Papa.parse(action.payload, { header: true });
      // xxx error check
      return {...state,fetched:true, routeCSVs: results.data};
    case "RECEIVED_ROUTE_CSVS_ERROR":
      return state;
    default:
      return state;
  }
}
