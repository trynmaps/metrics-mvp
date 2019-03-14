import axios from 'axios';

export function fetchGraphData (data) {
  return function (dispatch) {
    axios.get('/metrics', {

      params: {
        route_id: data['Route'],
        stop_id: data['From Stop'],
        direction: data['Direction'] === 'inbound' ? 'I' : 'O',
        date: data['date'],
      },
    }).then((response) => {
      dispatch({ type: 'RECEIVED_GRAPH_DATA', payload: response.data });
    }).catch((err) => {
      dispatch({ type: 'RECEIVED_GRAPH_ERROR', payload: err });
    });
  };
}
