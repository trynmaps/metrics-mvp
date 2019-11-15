import axios from 'axios';
import { metricsBaseURL } from '../config';
import { getTimePath } from '../helpers/precomputed';
import {
  generateArrivalsURL,
  generateTripURL,
  generateWaitTimeURL,
  routesUrl,
} from '../locationConstants';
import Moment from 'moment';
import { CUSTOM_DATE_RANGE, MAX_DATE_RANGE } from '../UIConstants';

/**
 * Helper function to compute the list of days for the GraphQL query.
 *
 * @param graphParams Current UI state.
 * @returns {Array} List of days to query for.
 */
function computeDates(graphParams) {
  let endMoment = Moment(graphParams.date);
  const daysBack = graphParams.daysBack;

  let numberOfDaysBack = Number.parseInt(daysBack);

  // If this is a custom date range, compute the number of days back
  // based on the start date.

  if (daysBack === CUSTOM_DATE_RANGE) {
    const startMoment = Moment(graphParams.startDate);
    const deltaDays = endMoment.diff(startMoment, 'days');
    numberOfDaysBack = Math.abs(deltaDays) + 1; // add one for the end date itself
    if (deltaDays < 0) { // if the start date is after end date, use the start date as the "end"
      endMoment = startMoment;
    }
  }

  if (numberOfDaysBack > MAX_DATE_RANGE) { // guard rail
    numberOfDaysBack = MAX_DATE_RANGE;
  }

  // Generate the list of days, filtering by the days of the week checkboxes.

  let dates = [];
  for (let i = 0; i < numberOfDaysBack; i++) {

    if (graphParams.daysOfTheWeek[endMoment.day()]) {
      dates.push(endMoment.format('YYYY-MM-DD'));
    }
    endMoment.subtract(1, 'days');
  }
  return dates;
}

export function fetchGraphData(params) {

  const dates = computeDates(params);

  return function(dispatch) {

    var query = `query($routeId:String, $startStopId:String, $endStopId:String,
    $directionId:String, $date:[String], $startTime:String, $endTime:String) {
  routeMetrics(routeId:$routeId) {
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

    axios.get('/api/graphql', {
        params: { query: query, variables: JSON.stringify({...params, date: dates}) }, // computed dates aren't in graphParams so add here
        baseURL: metricsBaseURL,
      })
      .then(response => {

        if (response.data && response.data.errors) {
          // assume there is at least one error, but only show the first one
          dispatch({ type: 'RECEIVED_GRAPH_ERROR', payload: response.data.errors[0].message });
        } else {
          dispatch({
            type: 'RECEIVED_GRAPH_DATA',
            payload: response.data,
            graphParams: params,
          });
        }
      })
      .catch(err => { // not sure which of the below is still applicable after moving to graphql
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

    const s3Url = generateArrivalsURL(dateStr, params.routeId);

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
      dispatch(fetchGraphData(graphParams));
    } else {
      // when we don't have all params, clear graph data

      dispatch(resetGraphData());
    }
  };
}
