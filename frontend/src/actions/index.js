import axios from 'axios';
import { MetricsBaseURL, S3Bucket, RoutesVersion, TripTimesVersion, WaitTimesVersion, ArrivalsVersion } from '../config';
import Moment from 'moment';
import { MAX_DATE_RANGE } from '../UIConstants';
import { Agencies } from '../config';
import {
  filterRoutes,
  getAllWaits,
  getAllSpeeds,
  getAllScores,
} from '../helpers/routeCalculations';

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
    if (deltaDays < 0) { // if the start date is after end date, use the start date as the "end"
      endMoment = startMoment;
    }

  if (numberOfDaysBack > MAX_DATE_RANGE) { // guard rail
    numberOfDaysBack = MAX_DATE_RANGE;
  }

  // Generate the list of days, filtering by the days of the week checkboxes.

  let dates = [];
  for (let i = 0; i < numberOfDaysBack; i++) {

    if (graphParams.daysOfTheWeek[startMoment.day()]) {
      dates.push(startMoment.format('YYYY-MM-DD'));
    }
    startMoment.add(1, 'days');
  }
  return dates;
}

// S3 URL to route configuration
export function generateRoutesURL(agencyId) {
  return `https://${S3Bucket}.s3.amazonaws.com/routes/${RoutesVersion}/routes_${RoutesVersion}_${agencyId}.json.gz?r`;
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
  )}/trip-times_${TripTimesVersion}_${agencyId}_${dateStr}_${statPath}${timePath}.json.gz?p`;
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
  )}/wait-times_${WaitTimesVersion}_${agencyId}_${dateStr}_${statPath}${timePath}.json.gz?f`;
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
  )}/arrivals_${ArrivalsVersion}_${agencyId}_${dateStr}_${routeId}.json.gz?ab`;
}

export function fetchTripMetrics(params) {

  const dates = computeDates(params);

  return function(dispatch) {

    var query = `query($agencyId:String!, $routeId:String!, $startStopId:String!, $endStopId:String,
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
      byDay(dates:$date, startTime:$startTime, endTime:$endTime) {
        dates
        startTime
        endTime
        tripTimes {
          median
          p10:percentile(percentile:10)
          p90:percentile(percentile:90)
         }
        waitTimes {
          median
          p90:percentile(percentile:90)
          probabilityLessThan(minutes:20)
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

    dispatch({ type: 'REQUEST_TRIP_METRICS' });
    axios.get('/api/graphql', {
        params: { query: query, variables: JSON.stringify({...params, date: dates}) }, // computed dates aren't in graphParams so add here
        baseURL: MetricsBaseURL,
      })
      .then(response => {
        const responseData = response.data;
        if (responseData && responseData.errors) {
          // assume there is at least one error, but only show the first one
          dispatch({
            type: 'ERROR_TRIP_METRICS',
            error: responseData.errors[0].message
          });
        } else {
          const routeMetrics = responseData && responseData.data ? responseData.data.routeMetrics : null;
          const tripMetrics = routeMetrics ? routeMetrics.trip : null;
          dispatch({
            type: 'RECEIVED_TRIP_METRICS',
            data: tripMetrics
          });
        }
      })
      .catch(err => {
        const errStr =
          err.response && err.response.data && err.response.data.errors
            ? err.response.data.errors[0].message
            : err.message;
        dispatch({ type: 'ERROR_TRIP_METRICS', error: errStr });
      });
  };
}

export function resetTripMetrics() {
  return function(dispatch) {
    dispatch({ type: 'RECEIVED_TRIP_METRICS', data: null });
  };
}

export function fetchRoutes(params) {
  return function(dispatch) {
    const agencyId = Agencies[0].id;
    dispatch({ type: 'REQUEST_ROUTES' });
    axios
      .get(generateRoutesURL(agencyId))
      .then(response => {
        var routes = response.data.routes;
        routes.forEach(route => {
          route.agencyId = agencyId;
        });
        dispatch({ type: 'RECEIVED_ROUTES', data: routes });
        dispatch(computeRouteStats());
      })
      .catch(err => {
        dispatch({ type: 'ERROR_ROUTES', error: err });
      });
  };
}

/**
 * Maps time range to a file path (used by Redux action).
 */

function getTimePath(timeStr) {
  return timeStr
    ? `_${timeStr
        .replace(/:/g, '')
        .replace('-', '_')
        .replace(/\+/g, '%2B')}`
    : '';
}

export function fetchPrecomputedStats(params) {
  return function(dispatch, getState) {
    const timeStr = params.startTime
      ? `${params.startTime}-${params.endTime}`
      : '';
    const dateStr = params.date;

    const timePath = getTimePath(timeStr);

    const agency = Agencies[0];

    const agencyId = agency.id;
    const waitTimesUrl = generateWaitTimesURL(agencyId, dateStr, 'median-p90-plt20m', timePath);
    if (getState().precomputedStats.waitTimesUrl !== waitTimesUrl)
    {
      dispatch({
        type: 'REQUEST_PRECOMPUTED_WAIT_TIMES',
        url: waitTimesUrl
      });
      axios
        .get(waitTimesUrl)
        .then(response => {
          dispatch({
            type: 'RECEIVED_PRECOMPUTED_WAIT_TIMES',
            url: waitTimesUrl,
            data: response.data
          });
          dispatch(computeRouteStats());
        })
        .catch(() => {
          dispatch({
            type: 'ERROR_PRECOMPUTED_WAIT_TIMES'
          });
          /* do something? */
        });
    }

    const tripTimesUrl = generateTripTimesURL(agencyId, dateStr, 'p10-median-p90', timePath);
    if (getState().precomputedStats.tripTimesUrl !== tripTimesUrl)
    {
      dispatch({
        type: 'REQUEST_PRECOMPUTED_TRIP_TIMES',
        url: tripTimesUrl
      });
      axios
        .get(tripTimesUrl)
        .then(response => {
          dispatch({
            type: 'RECEIVED_PRECOMPUTED_TRIP_TIMES',
            url: tripTimesUrl,
            data: response.data
          });
          dispatch(computeRouteStats());
        })
        .catch(() => {
          dispatch({
            type: 'ERROR_PRECOMPUTED_TRIP_TIMES',
          });
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
  return function(dispatch, getState) {
    const dateStr = params.date;
    const agencyId = params.agencyId;

    const s3Url = generateArrivalsURL(agencyId, dateStr, params.routeId);

    if (getState().arrivals.url !== s3Url) {
      dispatch({ type: 'REQUEST_ARRIVALS' });
      axios
        .get(s3Url)
        .then(response => {
          dispatch({
            type: 'RECEIVED_ARRIVALS',
            data: response.data,
            url: s3Url,
          });
        })
        .catch(err => {
          dispatch({ type: 'ERROR_ARRIVALS', error: 'No data.' });
          console.error(err);
        });
    }
  };
}

/**
 * Action creator that clears arrival history.
 */
export function resetArrivals() {
  return function(dispatch) {
    dispatch({ type: 'RECEIVED_ARRIVALS', url: null, data: null });
  };
}

export function handleSpiderMapClick(stops, latLng) {
  return function(dispatch) {
    dispatch({ type: 'RECEIVED_SPIDER_MAP_CLICK', stops, latLng });
  };
}

export function handleGraphParams(params) {
  return function(dispatch, getState) {
    const oldParams = getState().graphParams;
    dispatch({ type: 'RECEIVED_GRAPH_PARAMS', params });
    const graphParams = getState().graphParams;

    if (oldParams.date !== graphParams.date
      || oldParams.routeId !== graphParams.routeId
      || oldParams.agencyId !== graphParams.agencyId) {
      // Clear out stale data.  We have arrivals for a different route, day, or agency
      // from what is currently selected.
      dispatch(resetArrivals());
    }

    if (oldParams.date !== graphParams.date
      || oldParams.startTime !== graphParams.startTime
      || oldParams.endTime !== graphParams.endTime) {
      dispatch(resetRouteStats());
    }

    // for debugging: console.log('hGP: ' + graphParams.routeId + ' dirid: ' + graphParams.directionId + " start: " + graphParams.startStopId + " end: " + graphParams.endStopId);
    // fetch graph data if all params provided
    // TODO: fetch route summary data if all we have is a route ID.

    if (graphParams.date) {
      dispatch(fetchPrecomputedStats(graphParams));
    }

    if (
      graphParams.agencyId &&
      graphParams.routeId &&
      graphParams.directionId &&
      graphParams.startStopId &&
      graphParams.endStopId
    ) {
      dispatch(fetchTripMetrics(graphParams));
    } else {
      // when we don't have all params, clear graph data

      dispatch(resetTripMetrics());
    }
  };
}

export function resetRouteStats(params) {
  return function(dispatch) {
    dispatch({ type: 'COMPUTED_ROUTE_STATS', stats: {} });
  };
};

export function computeRouteStats(params) {
  return function(dispatch, getState) {
    const state = getState();
    const routes = state.routes.data;
    const { precomputedStats } = state;
    if (routes) {

      const routeStats = {};

      filterRoutes(routes).forEach(function(route) {
        routeStats[route.id] = {};
      });

      const allWaits = getAllWaits(precomputedStats.waitTimes, routes);
      const waitRankCount = allWaits.length;
      allWaits.forEach(function(waitObj, index) {
        const routeId = waitObj.routeId;
        const stats = routeStats[routeId];
        if (stats) {
          Object.assign(stats, waitObj);
          stats.waitRank = index + 1;
          stats.waitRankCount = waitRankCount;
        }
      });

      const allSpeeds = getAllSpeeds(precomputedStats.tripTimes, routes);
      const speedRankCount = allSpeeds.length;
      allSpeeds.forEach(function(speedObj, index) {
        const routeId = speedObj.routeId;
        const stats = routeStats[routeId];
        if (stats) {
          Object.assign(stats, speedObj);
          stats.speedRank = index + 1;
          stats.speedRankCount = speedRankCount;
        }
      });

      const allScores = getAllScores(routes, allWaits, allSpeeds);
      const scoreRankCount = allScores.length;
      allScores.forEach(function(scoreObj, index) {
        const routeId = scoreObj.routeId;
        const stats = routeStats[routeId];
        if (stats) {
          Object.assign(stats, scoreObj);
          stats.scoreRank = index + 1;
          stats.scoreRankCount = scoreRankCount;
        }
      });

      dispatch({ type: 'COMPUTED_ROUTE_STATS', stats: routeStats });
    } else {
      dispatch(resetRouteStats());
    }
  };
}
