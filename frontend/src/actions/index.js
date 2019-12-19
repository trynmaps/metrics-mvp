import axios from 'axios';
import Moment from 'moment';
import {
  MetricsBaseURL,
  S3Bucket,
  RoutesVersion,
  TripTimesVersion,
  WaitTimesVersion,
  ArrivalsVersion,
} from '../config';
import { getTimePath } from '../helpers/precomputed';
import { MAX_DATE_RANGE } from '../UIConstants';

/**
 * Helper function to compute the list of days for the GraphQL query.
 *
 * @param graphParams Current UI state.
 * @returns {Array} List of days to query for.
 */
function computeDates(graphParams) {
  let endMoment = Moment(graphParams.date);

  // If this is a custom date range, compute the number of days back
  // based on the start date.

  const startMoment = Moment(graphParams.startDate);
  const deltaDays = endMoment.diff(startMoment, 'days');
  let numberOfDaysBack = Math.abs(deltaDays) + 1; // add one for the end date itself
  if (deltaDays < 0) {
    // if the start date is after end date, use the start date as the "end"
    endMoment = startMoment;
  }

  if (numberOfDaysBack > MAX_DATE_RANGE) {
    // guard rail
    numberOfDaysBack = MAX_DATE_RANGE;
  }

  // Generate the list of days, filtering by the days of the week checkboxes.

  const dates = [];
  for (let i = 0; i < numberOfDaysBack; i++) {
    if (graphParams.daysOfTheWeek[endMoment.day()]) {
      dates.push(endMoment.format('YYYY-MM-DD'));
    }
    endMoment.subtract(1, 'days');
  }
  return dates;
}

// S3 URL to route configuration
export function generateRoutesURL(agencyId) {
  return `https://${S3Bucket}.s3.amazonaws.com/routes/${RoutesVersion}/routes_${RoutesVersion}_${agencyId}.json.gz?f`;
}

/**
 * Generate S3 url for cached trip time statistics
 * @param agencyId {string} agency ID
 * @param dateStr {string} date
 * @param statPath {string} the statistical measure (e.g. median)
 * @param timePath {string} the time of day
 * @returns {string} S3 url
 */
export function generateTripTimesURL(agencyId, dateStr, statPath, timePath) {
  return `https://${S3Bucket}.s3.amazonaws.com/trip-times/${TripTimesVersion}/${agencyId}/${dateStr.replace(
    /-/g,
    '/',
  )}/trip-times_${TripTimesVersion}_${agencyId}_${dateStr}_${statPath}${timePath}.json.gz?e`;
}

/**
 * Generate S3 url for cached wait time statistics
 * @param agencyId {string} agency ID
 * @param dateStr {string} date
 * @param statPath {string} the statistical measure (e.g. median)
 * @param timePath {string} the time of day
 * @returns {string} S3 url
 */
export function generateWaitTimesURL(agencyId, dateStr, statPath, timePath) {
  return `https://${S3Bucket}.s3.amazonaws.com/wait-times/${WaitTimesVersion}/${agencyId}/${dateStr.replace(
    /-/g,
    '/',
  )}/wait-times_${WaitTimesVersion}_${agencyId}_${dateStr}_${statPath}${timePath}.json.gz?e`;
}

/**
 * Generate S3 url for arrivals
 * @param dateStr {string} date
 * @param routeId {string} route id
 * @returns {string} S3 url
 */
export function generateArrivalsURL(agencyId, dateStr, routeId) {
  return `https://${S3Bucket}.s3.amazonaws.com/arrivals/${ArrivalsVersion}/${agencyId}/${dateStr.replace(
    /-/g,
    '/',
  )}/arrivals_${ArrivalsVersion}_${agencyId}_${dateStr}_${routeId}.json.gz?d`;
}

export function fetchGraphData(params) {
  const dates = computeDates(params);

  return function(dispatch) {
    const query = `query($agencyId:String!, $routeId:String!, $startStopId:String!, $endStopId:String,
    $directionId:String, $date:[String!], $startTime:String, $endTime:String) {
  routeMetrics(agencyId:$agencyId, routeId:$routeId) {
    trip(startStopId:$startStopId, endStopId:$endStopId, directionId:$directionId) {
      interval(dates:$date, startTime:$startTime, endTime:$endTime) {
        headways {
          count median max
          percentiles(percentiles:[90]) { percentile value }
          histogram { binStart binEnd count }
        }
        tripTimes {
          count median avg max
          percentiles(percentiles:[90]) { percentile value }
          histogram { binStart binEnd count }
        }
        waitTimes {
          median max
          percentiles(percentiles:[90]) { percentile value }
          histogram { binStart binEnd count }
        }
      }
      timeRanges(dates:$date) {
        startTime endTime
        waitTimes {
          percentiles(percentiles:[50,90]) { percentile value }
        }
        tripTimes {
          percentiles(percentiles:[50,90]) { percentile value }
        }
      }
    }
  }
}`.replace(/\s+/g, ' ');

    dispatch({ type: 'REQUEST_GRAPH_DATA' });
    axios
      .get('/api/graphql', {
        params: {
          query,
          variables: JSON.stringify({ ...params, date: dates }),
        }, // computed dates aren't in graphParams so add here
        baseURL: MetricsBaseURL,
      })
      .then(response => {
        if (response.data && response.data.errors) {
          // assume there is at least one error, but only show the first one
          dispatch({
            type: 'ERROR_GRAPH_DATA',
            payload: response.data.errors[0].message,
          });
        } else {
          dispatch({
            type: 'RECEIVED_GRAPH_DATA',
            payload: response.data,
            graphParams: params,
          });
        }
      })
      .catch(err => {
        // not sure which of the below is still applicable after moving to graphql
        const errStr =
          err.response && err.response.data && err.response.data.error
            ? err.response.data.error
            : err.message;
        dispatch({ type: 'ERROR_GRAPH_DATA', payload: errStr });
      });
  };
}

export function resetGraphData() {
  return function(dispatch) {
    dispatch({ type: 'RESET_GRAPH_DATA', payload: null });
  };
}

export function fetchRoutes(params) {
  return function(dispatch) {
    const agencyId = params.agencyId;
    dispatch({ type: 'REQUEST_ROUTES' });
    axios
      .get(generateRoutesURL(agencyId))
      .then(response => {
        const routes = response.data.routes;
        routes.forEach(route => {
          route.agencyId = agencyId;
        });
        dispatch({ type: 'RECEIVED_ROUTES', payload: routes });
      })
      .catch(err => {
        dispatch({ type: 'ERROR_ROUTES', payload: err });
      });
  };
}

export function fetchPrecomputedWaitAndTripData(params) {
  return function(dispatch, getState) {
    const timeStr = params.startTime
      ? `${params.startTime}-${params.endTime}`
      : '';
    const dateStr = params.date;
    const agencyId = params.agencyId;

    const tripStatGroup = 'p10-median-p90'; // blocked; // 'median'
    const tripTimesCache = getState().routes.tripTimesCache;

    const tripTimesCacheKey = `${agencyId}-${dateStr +
      timeStr}-${tripStatGroup}`;

    const tripTimes = tripTimesCache[tripTimesCacheKey];

    if (!tripTimes) {
      const timePath = getTimePath(timeStr);
      const statPath = tripStatGroup;

      const s3Url = generateTripTimesURL(agencyId, dateStr, statPath, timePath);

      dispatch({ type: 'REQUEST_PRECOMPUTED_TRIP_TIMES' });
      axios
        .get(s3Url)
        .then(response => {
          dispatch({
            type: 'RECEIVED_PRECOMPUTED_TRIP_TIMES',
            payload: [response.data, tripTimesCacheKey],
          });
        })
        .catch(() => {
          dispatch({ type: 'ERROR_PRECOMPUTED_TRIP_TIMES' });
          /* do something? */
        });
    }

    const waitStatGroup = 'median-p90-plt20m';
    const waitTimesCacheKey = `${agencyId}-${dateStr +
      timeStr}-${waitStatGroup}`;

    const waitTimesCache = getState().routes.waitTimesCache;
    const waitTimes = waitTimesCache[waitTimesCacheKey];

    if (!waitTimes) {
      const timePath = getTimePath(timeStr);
      const statPath = waitStatGroup; // for now, nothing clever about selecting smaller files here //getStatPath(statGroup);

      const s3Url = generateWaitTimesURL(agencyId, dateStr, statPath, timePath);

      dispatch({ type: 'REQUEST_PRECOMPUTED_WAIT_TIMES' });
      axios
        .get(s3Url)
        .then(response => {
          dispatch({
            type: 'RECEIVED_PRECOMPUTED_WAIT_TIMES',
            payload: [response.data, waitTimesCacheKey],
          });
        })
        .catch(() => {
          dispatch({ type: 'ERROR_PRECOMPUTED_WAIT_TIMES' });
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
    const agencyId = params.agencyId;

    const s3Url = generateArrivalsURL(agencyId, dateStr, params.routeId);

    dispatch({ type: 'REQUEST_ARRIVALS' });
    axios
      .get(s3Url)
      .then(response => {
        dispatch({
          type: 'RECEIVED_ARRIVALS',
          payload: [response.data, dateStr, params.routeId],
        });
      })
      .catch(err => {
        dispatch({ type: 'ERROR_ARRIVALS', payload: 'No data.' });
        console.error(err);
      });
  };
}

/**
 * Action creator that clears arrival history.
 */
export function resetArrivals() {
  return function(dispatch) {
    dispatch({ type: 'ERROR_ARRIVALS', payload: null });
  };
}

export function handleSpiderMapClick(stops, latLng) {
  return function(dispatch) {
    dispatch({ type: 'RECEIVED_SPIDER_MAP_CLICK', payload: [stops, latLng] });
  };
}

export function handleGraphParams(params) {
  return function(dispatch, getState) {
    dispatch({ type: 'RECEIVED_GRAPH_PARAMS', payload: params });
    const graphParams = getState().routes.graphParams;

    // for debugging: console.log('hGP: ' + graphParams.routeId + ' dirid: ' + graphParams.directionId + " start: " + graphParams.startStopId + " end: " + graphParams.endStopId);
    // fetch graph data if all params provided
    // TODO: fetch route summary data if all we have is a route ID.

    if (graphParams.date && graphParams.agencyId) {
      dispatch(fetchPrecomputedWaitAndTripData(graphParams));
    }

    if (
      graphParams.agencyId &&
      graphParams.routeId &&
      graphParams.directionId &&
      graphParams.startStopId &&
      graphParams.endStopId
    ) {
      dispatch(fetchGraphData(graphParams));
    } else {
      // when we don't have all params, clear graph data

      dispatch(resetGraphData());
    }
  };
}
