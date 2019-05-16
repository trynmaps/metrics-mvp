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
