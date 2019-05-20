import * as Papa from 'papaparse';

const initialState = {
  fetching: false,
  shapes: null,
};

export default (state = initialState, action) => {
  switch(action.type) {
    case "RECEIVED_SHAPES":
      const results = Papa.parse(action.payload, { header: true, fastMode: true /* because no quoted values */ });
      // xxx error check
      return {...state,fetched:true, shapes: results.data};
    case "RECEIVED_SHAPES_ERROR":
      return state;
    default:
      return state;
  }
}
