import axios from 'axios';

import { metricsBaseURL } from '../config';

/**
 * This is an action creator where the action calls two actions.
 * Basically this a way of calling two APIs at once, where two APIs
 * have no interactions with each other.
 */
export function fetchData (graphParams, intervalParams) {  
  return function (dispatch) {
      dispatch(fetchGraphData(graphParams));
      dispatch(fetchIntervalData(intervalParams));
  }
}

export function fetchGraphData (params) {
  return function (dispatch) {
    axios.get('/metrics', {
      params: params,
      baseURL: metricsBaseURL
    }).then((response) => {
      dispatch({ type: 'RECEIVED_GRAPH_DATA', payload: response.data, graphParams: params });
    }).catch((err) => {
      const errStr = (err.response && err.response.data && err.response.data.error) ? err.response.data.error : err.message;
      dispatch({ type: 'RECEIVED_GRAPH_ERROR', payload: errStr });
    });
  };
}

export function resetGraphData() {
  return function (dispatch) {
    dispatch({ type: 'RESET_GRAPH_DATA', payload: null });
  };
}

export function fetchIntervalData (params) {
    return function (dispatch) {
      axios.get('/metrics_by_interval', {
        params: params,
        baseURL: metricsBaseURL
      }).then((response) => {
        dispatch({ type: 'RECEIVED_INTERVAL_DATA', payload: response.data, graphParams: params });
      }).catch((err) => {
        const errStr = (err.response && err.response.data && err.response.data.error) ? err.response.data.error : err.message;
        dispatch({ type: 'RECEIVED_INTERVAL_ERROR', payload: errStr });
      });
    };
  }

  export function resetIntervalData() {
    return function (dispatch) {
      dispatch({ type: 'RESET_INTERVAL_DATA', payload: null });
    };
  }

export function fetchRoutes() {
  return function (dispatch) {
    axios.get('/routes', {
      baseURL: metricsBaseURL
    }).then((response) => {
      dispatch({ type: 'RECEIVED_ROUTES', payload: response.data });
    }).catch((err) => {
      dispatch({ type: 'RECEIVED_ROUTES_ERROR', payload: err });
    });
  };
}

export function fetchRouteConfig(routeId) {
  return function (dispatch) {
    axios.get('/route', {
      params: {route_id: routeId},
      baseURL: metricsBaseURL
    }).then((response) => {
      dispatch({ type: 'RECEIVED_ROUTE_CONFIG', payload: response.data });
    }).catch((err) => {
      dispatch({ type: 'RECEIVED_ROUTE_CONFIG_ERROR', payload: err });
    });
  };
}

export function fetchAllRouteConfigs(routes) {
    
    
    return function (dispatch) {
        
        for (let i = 0; i < routes.length; i++) { // optimize this on back end
            const route = routes[i];
            if (!route.directions) {
              dispatch(fetchRouteConfig(route.id));
            }
        }
        return Promise.resolve();
    };
  }

export function fetchTazs() {
  return function (dispatch) {
    axios.get('/data/san_francisco_taz.json', {
      xxxbaseURL: metricsBaseURL
    }).then((response) => {
      dispatch({ type: 'RECEIVED_TAZS', payload: response.data });
    }).catch((err) => {
      dispatch({ type: 'RECEIVED_TAZS_ERROR', payload: err });
    });
  };
}

export function fetchTrips() {
    return function (dispatch) {
      axios.get('frontend/public/data/trips.txt', {
        baseURL: metricsBaseURL
      }).then((response) => {
        dispatch({ type: 'RECEIVED_TRIPS', payload: response.data });
      }).catch((err) => {
        dispatch({ type: 'RECEIVED_TRIPS_ERROR', payload: err });
      });
    };
  }

export function fetchRouteCSVs() {
    return function (dispatch) {
      axios.get('frontend/public/data/routes.txt', {
        baseURL: metricsBaseURL
      }).then((response) => {
        dispatch({ type: 'RECEIVED_ROUTE_CSVS', payload: response.data });
      }).catch((err) => {
        dispatch({ type: 'RECEIVED_ROUTE_CSVS_ERROR', payload: err });
      });
    };
  }


export function fetchShapes() {
    return function (dispatch) {
      axios.get('/data/shapes.txt', {
        baseURL: metricsBaseURL
      }).then((response) => {
        dispatch({ type: 'RECEIVED_SHAPES', payload: response.data });
      }).catch((err) => {
        dispatch({ type: 'RECEIVED_SHAPES_ERROR', payload: err });
      });
    };
  }

// these are by route id hash then direction id hash, then first stop hash, then second stop hash, in minutes
export function fetchTripTimes() {
    return function (dispatch) {
      axios.get('/trip-times', { // optional date_str argument omitted, defaults to 4/8
        baseURL: metricsBaseURL
      }).then((response) => {
        dispatch({ type: 'RECEIVED_TRIP_TIMES', payload: response.data });
      }).catch((err) => {
        dispatch({ type: 'RECEIVED_TRIP_TIMES_ERROR', payload: err });
      });
    };
  }

// these are by direction id hash and then stop id hash, in minutes
export function fetchWaitTimes() {
    return function (dispatch) {
      axios.get('/wait-times', { // optional date_str argument omitted, defaults to 4/8
        baseURL: metricsBaseURL
      }).then((response) => {
        dispatch({ type: 'RECEIVED_WAIT_TIMES', payload: response.data });
      }).catch((err) => {
        dispatch({ type: 'RECEIVED_WAIT_TIMES_ERROR', payload: err });
      });
    };
  }



export function fetchAllTheThings() {
    return function (dispatch) {
        
            axios.get('/routes', {
              baseURL: metricsBaseURL
            }).then((response) => {
              dispatch({ type: 'RECEIVED_ROUTES', payload: response.data });
              dispatch(fetchAllRouteConfigs(response.data)).then(
                      () => {
                          dispatch(fetchTrips());
                          dispatch(fetchRouteCSVs());
                          dispatch(fetchShapes());
                          dispatch(fetchTripTimes());
                          dispatch(fetchWaitTimes());
                      }
                      );
            }).catch((err) => {
              dispatch({ type: 'RECEIVED_ROUTES_ERROR', payload: err });
            });
                  
    };
  }

export function handleRouteSelect(route) {
  return function (dispatch) {
      dispatch({ type: 'RECEIVED_ROUTE_SELECTION', payload: route });
  };
}

