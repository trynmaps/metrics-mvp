import axios from 'axios';
import { metricsBaseURL } from '../config';
import { getTimePath } from '../helpers/precomputed';
import {
  generateTripURL,
  generateWaitTimeURL,
  routesUrl,
} from '../locationConstants';

export function fetchGraphData(params) {
  return function(dispatch) {
    axios
      .get('/api/metrics', {
        params,
        baseURL: metricsBaseURL,
      })
      .then(response => {
        dispatch({
          type: 'RECEIVED_GRAPH_DATA',
          payload: response.data,
          graphParams: params,
        });
      })
      .catch(err => {
        const errStr =
          err.response && err.response.data && err.response.data.error
            ? err.response.data.error
            : err.message;
        dispatch({ type: 'RECEIVED_GRAPH_ERROR', payload: errStr });
      });
  };
}

export function resetGraphData() {
  return function(dispatch) {
    dispatch({ type: 'RESET_GRAPH_DATA', payload: null });
  };
}

export function fetchIntervalData(params) {
  return function(dispatch) {
    axios
      .get('/api/metrics_by_interval', {
        params,
        baseURL: metricsBaseURL,
      })
      .then(response => {
        dispatch({
          type: 'RECEIVED_INTERVAL_DATA',
          payload: response.data,
          graphParams: params,
        });
      })
      .catch(err => {
        const errStr =
          err.response && err.response.data && err.response.data.error
            ? err.response.data.error
            : err.message;
        dispatch({ type: 'RECEIVED_INTERVAL_ERROR', payload: errStr });
      });
  };
}

export function resetIntervalData() {
  return function(dispatch) {
    dispatch({ type: 'RESET_INTERVAL_DATA', payload: null });
  };
}

export function fetchRoutes() {
  return function(dispatch) {
    axios
      .get(routesUrl)
      .then(response => {
        dispatch({ type: 'RECEIVED_ROUTES', payload: response.data.routes });
      })
      .catch(err => {
        dispatch({ type: 'RECEIVED_ROUTES_ERROR', payload: err });
      });
  };
}

export function fetchPrecomputedWaitAndTripData(params) {
  return function(dispatch, getState) {
    const timeStr = params.startTime
      ? `${params.startTime}-${params.endTime}`
      : '';
    const dateStr = params.date;

    const tripStatGroup = 'p10-median-p90'; // blocked; // 'median'
    const tripTimesCache = getState().routes.tripTimesCache;

    const tripTimes = tripTimesCache[`${dateStr + timeStr}${tripStatGroup}`];

    if (!tripTimes) {
      const timePath = getTimePath(timeStr);
      const statPath = tripStatGroup;

      const s3Url = generateTripURL(dateStr, statPath, timePath);

      axios
        .get(s3Url)
        .then(response => {
          dispatch({
            type: 'RECEIVED_PRECOMPUTED_TRIP_TIMES',
            payload: [response.data, `${dateStr + timeStr}${tripStatGroup}`],
          });
        })
        .catch(() => {
          /* do something? */
        });
    }

    const waitStatGroup = 'median-p90-plt20m';
    const waitTimesCache = getState().routes.waitTimesCache;
    const waitTimes = waitTimesCache[`${dateStr + timeStr}${waitStatGroup}`];

    if (!waitTimes) {
      const timePath = getTimePath(timeStr);
      const statPath = waitStatGroup; // for now, nothing clever about selecting smaller files here //getStatPath(statGroup);

      const s3Url = generateWaitTimeURL(dateStr, statPath, timePath);

      axios
        .get(s3Url)
        .then(response => {
          dispatch({
            type: 'RECEIVED_PRECOMPUTED_WAIT_TIMES',
            payload: [response.data, `${dateStr + timeStr}${waitStatGroup}`],
          });
        })
        .catch(() => {
          /* do something? */
        });
    }
  };
}

/**
 * Action creator that fetches arrival history from S3 corresponding to the
 * day and route specified by params.
 *
 * @param params graphParams object
 */
export function fetchArrivals(params) {
  return function(dispatch) {
    const dateStr = params.date;

    const arrivalsVersion = 'v4a';

    const s3Url = `https://opentransit-stop-arrivals.s3.amazonaws.com/${arrivalsVersion}/sf-muni/${dateStr.replace(
      /-/g,
      '/',
    )}/arrivals_${arrivalsVersion}_sf-muni_${dateStr}_${params.routeId}.json.gz`;

    axios
      .get(s3Url)
      .then(response => {
        dispatch({
          type: 'RECEIVED_ARRIVALS',
          payload: [response.data, dateStr, params.routeId],
        });
      })
      .catch(err => {
        console.error(err);
      });
  };
}

export function handleSpiderMapClick(stops, latLng) {
  return function(dispatch) {
    dispatch({ type: 'RECEIVED_SPIDER_MAP_CLICK', payload: [stops, latLng] });
  };
}

/**
 * This is an action creator where the action calls two actions.
 * Basically this a way of calling two APIs at once, where two APIs
 * have no interactions with each other.
 */
export function fetchData(graphParams, intervalParams) {
  return function(dispatch) {
    dispatch(fetchGraphData(graphParams));
    dispatch(fetchIntervalData(intervalParams));
  };
}

export function handleGraphParams(params) {
  return function(dispatch, getState) {
    dispatch({ type: 'RECEIVED_GRAPH_PARAMS', payload: params });
    const graphParams = getState().routes.graphParams;

    // for debugging: console.log('hGP: ' + graphParams.routeId + ' dirid: ' + graphParams.directionId + " start: " + graphParams.startStopId + " end: " + graphParams.endStopId);
    // fetch graph data if all params provided
    // TODO: fetch route summary data if all we have is a route ID.

    if (graphParams.date) {
      dispatch(fetchPrecomputedWaitAndTripData(graphParams));
    }

    if (
      graphParams.routeId &&
      graphParams.directionId &&
      graphParams.startStopId &&
      graphParams.endStopId
    ) {
      const intervalParams = Object.assign({}, graphParams);
      delete intervalParams.startTime; // for interval api, clear out start/end time and use defaults for now
      delete intervalParams.endTime; // because the hourly graph is spiky and can trigger panda "empty axes" errors.

      dispatch(fetchData(graphParams, intervalParams));
    } else {
      // when we don't have all params, clear graph data

      dispatch(resetGraphData());
      dispatch(resetIntervalData());
    }
  };
}
