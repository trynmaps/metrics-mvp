import axios from 'axios';
import Moment from 'moment';
import {
  MetricsBaseURL,
  S3Bucket,
  RoutesVersion,
  ArrivalsVersion,
  Agencies,
} from '../config';
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
    if (graphParams.daysOfTheWeek[startMoment.day()]) {
      dates.push(startMoment.format('YYYY-MM-DD'));
    }
    startMoment.add(1, 'days');
  }
  return dates;
}

// S3 URL to route configuration
export function generateRoutesURL(agencyId) {
  return `https://${S3Bucket}.s3.amazonaws.com/routes/${RoutesVersion}/routes_${RoutesVersion}_${agencyId}.json.gz?u`;
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
  )}/arrivals_${ArrivalsVersion}_${agencyId}_${dateStr}_${routeId}.json.gz?ai`;
}

export function fetchTripMetrics(params) {
  const dates = computeDates(params);

  return function(dispatch) {
    const query = `query($agencyId:String!, $routeId:String!, $startStopId:String!, $endStopId:String,
    $directionId:String, $dates:[String!], $startTime:String, $endTime:String) {
  agency(agencyId:$agencyId) {
    route(routeId:$routeId) {
      trip(startStopId:$startStopId, endStopId:$endStopId, directionId:$directionId) {
        interval(dates:$dates, startTime:$startTime, endTime:$endTime) {
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
          departureScheduleAdherence {
            onTimeCount
            scheduledCount
          }
        }
        byDay(dates:$dates, startTime:$startTime, endTime:$endTime) {
          dates
          startTime
          endTime
          tripTimes {
            median
            percentiles(percentiles:[10,90]) { percentile value }
           }
          waitTimes {
            median
            percentiles(percentiles:[90]) { percentile value }
          }
          departureScheduleAdherence {
            onTimeCount
            scheduledCount
          }
        }
        timeRanges(dates:$dates) {
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
  }
}`.replace(/\s+/g, ' ');

    dispatch({ type: 'REQUEST_TRIP_METRICS' });
    axios
      .get('/api/graphql', {
        params: {
          query,
          variables: JSON.stringify({ ...params, dates }),
        }, // computed dates aren't in graphParams so add here
        baseURL: MetricsBaseURL,
      })
      .then(response => {
        const responseData = response.data;
        if (responseData && responseData.errors) {
          // assume there is at least one error, but only show the first one
          dispatch({
            type: 'ERROR_TRIP_METRICS',
            error: responseData.errors[0].message,
          });
        } else {
          const agencyMetrics =
            responseData && responseData.data ? responseData.data.agency : null;
          const routeMetrics = agencyMetrics ? agencyMetrics.route : null;
          const tripMetrics = routeMetrics ? routeMetrics.trip : null;
          dispatch({
            type: 'RECEIVED_TRIP_METRICS',
            data: tripMetrics,
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

export function fetchRoutes() {
  return function(dispatch, getState) {
    const agencyId = Agencies[0].id;

    if (agencyId !== getState().routes.agencyId) {
      dispatch({ type: 'REQUEST_ROUTES', agencyId });
      axios
        .get(generateRoutesURL(agencyId))
        .then(response => {
          const routes = response.data.routes;
          routes.forEach(route => {
            route.agencyId = agencyId;
          });
          dispatch({
            type: 'RECEIVED_ROUTES',
            data: routes,
            agencyId,
          });
        })
        .catch(err => {
          dispatch({ type: 'ERROR_ROUTES', error: err });
        });
    }
  };
}

export function fetchRouteMetrics(params) {
  const dates = computeDates(params);

  return function(dispatch, getState) {
    const query = `query($agencyId:String!, $routeId:String!, $dates:[String!], $startTime:String, $endTime:String) {
  agency(agencyId:$agencyId) {
    route(routeId:$routeId) {
      interval(dates:$dates, startTime:$startTime, endTime:$endTime) {
        directions {
          directionId
          segments {
            fromStopId
            toStopId
            medianTripTime
            trips
          }
          cumulativeSegments {
            fromStopId
            toStopId
            medianTripTime
            trips
          }
        }
      }
    }
  }
}`.replace(/\s+/g, ' ');

    const variablesJson = JSON.stringify({
      agencyId: Agencies[0].id,
      routeId: params.routeId,
      dates,
      startTime: params.startTime,
      endTime: params.endTime,
    });

    if (getState().routeMetrics.variablesJson !== variablesJson) {
      dispatch({
        type: 'REQUEST_ROUTE_METRICS',
        variablesJson,
      });
      axios
        .get('/api/graphql', {
          params: { query, variables: variablesJson }, // computed dates aren't in graphParams so add here
          baseURL: MetricsBaseURL,
        })
        .then(response => {
          const responseData = response.data;
          if (responseData && responseData.errors) {
            // assume there is at least one error, but only show the first one
            dispatch({
              type: 'ERROR_ROUTE_METRICS',
              error: responseData.errors[0].message,
            });
          } else {
            const agencyMetrics =
              responseData && responseData.data
                ? responseData.data.agency
                : null;
            const routeMetrics = agencyMetrics ? agencyMetrics.route : null;
            dispatch({
              type: 'RECEIVED_ROUTE_METRICS',
              variablesJson,
              data: routeMetrics,
            });
          }
        })
        .catch(err => {
          const errStr =
            err.response && err.response.data && err.response.data.errors
              ? err.response.data.errors[0].message
              : err.message;
          dispatch({ type: 'ERROR_ROUTE_METRICS', error: errStr });
        });
    }
  };
}

export function fetchAgencyMetrics(params) {
  const dates = computeDates(params);

  return function(dispatch, getState) {
    const query = `query($agencyId:String!, $dates:[String!], $startTime:String, $endTime:String) {
  agency(agencyId:$agencyId) {
    agencyId
    interval(dates:$dates, startTime:$startTime, endTime:$endTime) {
      routes {
        routeId
        directions {
          directionId
          medianWaitTime
          averageSpeed(units:"mph")
          travelTimeVariability
          onTimeRate
        }
      }
    }
  }
}`.replace(/\s+/g, ' ');

    const variablesJson = JSON.stringify({
      agencyId: Agencies[0].id,
      dates,
      startTime: params.startTime,
      endTime: params.endTime,
    });

    if (getState().agencyMetrics.variablesJson !== variablesJson) {
      dispatch({
        type: 'REQUEST_AGENCY_METRICS',
        variablesJson,
      });
      axios
        .get('/api/graphql', {
          params: { query, variables: variablesJson },
          baseURL: MetricsBaseURL,
        })
        .then(response => {
          const responseData = response.data;
          if (responseData && responseData.errors) {
            // assume there is at least one error, but only show the first one
            dispatch({
              type: 'ERROR_AGENCY_METRICS',
              error: responseData.errors[0].message,
            });
          } else {
            const agencyMetrics =
              responseData && responseData.data
                ? responseData.data.agency
                : null;
            dispatch({
              type: 'RECEIVED_AGENCY_METRICS',
              variablesJson,
              data: agencyMetrics,
            });
          }
        })
        .catch(err => {
          const errStr =
            err.response && err.response.data && err.response.data.errors
              ? err.response.data.errors[0].message
              : err.message;
          dispatch({ type: 'ERROR_AGENCY_METRICS', error: errStr });
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
        .catch(() => {
          dispatch({ type: 'ERROR_ARRIVALS', error: 'No data.' });
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

    if (
      oldParams.date !== graphParams.date ||
      oldParams.routeId !== graphParams.routeId ||
      oldParams.agencyId !== graphParams.agencyId
    ) {
      // Clear out stale data.  We have arrivals for a different route, day, or agency
      // from what is currently selected.
      dispatch(resetArrivals());
    }

    // for debugging: console.log('hGP: ' + graphParams.routeId + ' dirid: ' + graphParams.directionId + " start: " + graphParams.startStopId + " end: " + graphParams.endStopId);
    // fetch graph data if all params provided
    // TODO: fetch route summary data if all we have is a route ID.

    if (graphParams.date) {
      dispatch(fetchAgencyMetrics(graphParams));
    }

    if (graphParams.agencyId && graphParams.routeId) {
      dispatch(fetchRouteMetrics(graphParams));
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
