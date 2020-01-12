/**
 * Helper functions for working with routes and stops.  These are used to filter out
 * routes, spurious directions, and idiosyncratic stops when listing and scoring entire routes.
 *
 * Also includes functions for computing distances between coordinates.
 */

import * as d3 from 'd3';
import red from '@material-ui/core/colors/red';
import green from '@material-ui/core/colors/green';
import yellow from '@material-ui/core/colors/yellow';
import lightGreen from '@material-ui/core/colors/lightGreen';
import {
  getTripTimeStat,
  getTripTimesForDirection,
  getAverageOfMedianWaitStat,
} from './precomputed';

import { getAgency } from '../config';

/**
 * Given an array of routes, return only the routes we want to show.
 */
export function filterRoutes(routes) {
  return routes.filter(route => {
    return !isIgnoredRoute(route);
  });
}

export function isIgnoredRoute(route) {
  const routeHeuristics = getAgency(route.agencyId).routeHeuristics;
  return routeHeuristics && routeHeuristics[route.id] && routeHeuristics[route.id].ignoreRoute;
}

/**
 * Whether the first stop in a direction's stop list should be disregarded.
 * For example, the M outbound lists Embarcadero & Folsom as first stop, but few
 * M's actually go to that stop.  For better end to end calculations, need to disregard
 * the first stop.
 */
function ignoreFlag(routeHeuristics, routeId, directionId, flagName) {
  if (!routeHeuristics || !routeHeuristics[routeId]) {
    return false;
  }
  const direction = routeHeuristics[routeId][directionId];
  if (!direction) {
    return false;
  }
  if (direction[flagName]) {
    return direction[flagName];
  }
  return false;
}

function ignoreFirstStop(routeHeuristics, routeId, directionId) {
  return ignoreFlag(routeHeuristics, routeId, directionId, 'ignoreFirstStop');
}

function ignoreLastStop(routeHeuristics, routeId, directionId) {
  return ignoreFlag(routeHeuristics, routeId, directionId, 'ignoreLastStop');
}

/**
 * Get precomputed trip times for the first stop, then apply heuristic rules
 * to trim off the first stop or first stops if needed.
 */
function getTripTimesUsingHeuristics(
  tripTimes,
  route,
  directionId,
) {
  const routeId = route.id;
  const tripTimesForDir = getTripTimesForDirection(
    tripTimes,
    routeId,
    directionId,
  );

  if (!tripTimesForDir) {
    //console.log("No trip times found at all for " + directionId + " (gtfs out of sync or route not running)");
    // not sure if we should remap to normal terminal
    return { tripTimesForFirstStop: null, directionInfo: null, firstStopDistance: null };
  }

  //console.log('trip times for dir: ' + Object.keys(tripTimesForDir).length + ' keys' );

  // Note that some routes do not run their full length all day like the 5 Fulton, so they
  // don't go to all the stops.  Ideally we should know which stops they do run to.

  const directionInfo = route.directions.find(
    direction => direction.id === directionId,
  );

  const routeHeuristics = getAgency(route.agencyId).routeHeuristics;

  const ignoreFirst = ignoreFirstStop(routeHeuristics, routeId, directionId); // look up heuristic rule
  let firstStop = null;

  if (ignoreFirst !== true && ignoreFirst !== false) {
    firstStop = ignoreFirst; // ignore the stops prior the index specified by ignoreFirst
  } else {
    // is a boolean
    firstStop = directionInfo.stops[ignoreFirst ? 1 : 0];
  }

  let tripTimesForFirstStop = tripTimesForDir[firstStop];

  // if this stop doesn't have trip times (like the oddball J direction going to the yard, which we currently ignore)
  // then find the stop with the most trip time entries

  if (!tripTimesForFirstStop || !Object.keys(tripTimesForFirstStop).length) {
    //console.log("No trip times found for " + routeId + " from stop " + firstStop + ".  Using stop with most entries.");
    tripTimesForFirstStop = Object.values(tripTimesForDir).reduce(
      (accumulator, currentValue) =>
        Object.values(currentValue).length > Object.values(accumulator).length
          ? currentValue
          : accumulator,
      {},
    );
  }

  return {
    tripTimesForFirstStop,
    directionInfo,
    firstStopDistance: directionInfo.stop_geometry[firstStop].distance
  };
}

/**
 * Returns trip time and distance across the full route, applying heuristic rules to ignore
 * the last stop or stops as needed.
 */
export function getEndToEndTripTime(
  tripTimes,
  route,
  directionId,
  stat = 'median',
) {
  const routeId = route.id;
  const { tripTimesForFirstStop, directionInfo, firstStopDistance } = getTripTimesUsingHeuristics(
    tripTimes,
    route,
    directionId,
  );

  if (!tripTimesForFirstStop) {
    // no precomputed times
    // console.log("No precomputed trip times for " + routeId + " " + directionId + " (gtfs out of sync with historic data or route not running)");
    return '?';
  }

  const routeHeuristics = getAgency(route.agencyId).routeHeuristics;

  const ignoreLast = ignoreLastStop(routeHeuristics, routeId, directionId); // look up heuristic rule

  let lastStop = null;

  /*
   * For determining end to end trip time, taking into account ignored stops.
   */
  if (ignoreLast !== true && ignoreLast !== false) {
    lastStop = ignoreLast; // ignore stops after index specified by ignoreLast
  } else {
    // is a boolean
    lastStop = directionInfo.stops[directionInfo.stops.length - (ignoreLast ? 2 : 1)];
  }

  // console.log('found ' + Object.keys(tripTimesForFirstStop).length + ' keys' );

  let statIndex = 1; // default to median (p10-median-p90)
  if (stat === 'p90') {
    statIndex = 2;
  } else if (stat === 'p10') {
    statIndex = 0;
  }

  let tripTime = null;
  let tripDistance = null;

  if (tripTimesForFirstStop[lastStop]) {
    tripTime = tripTimesForFirstStop[lastStop][statIndex];
    tripDistance = directionInfo.stop_geometry[lastStop].distance - firstStopDistance;
  }

  // if there is no trip time to the last stop, then use the highest trip time actually observed

  if (!tripTime) {
    const tripTimes = getTripTimeStat(tripTimesForFirstStop, statIndex);
    const stopIds = Object.keys(tripTimes);
    tripTime = 0;

    for (let i = 0; i < stopIds.length; i++) {
      if (tripTimes[stopIds[i]] > tripTime && directionInfo.stop_geometry[stopIds[i]]) {
        tripTime = tripTimes[stopIds[i]];
        tripDistance = directionInfo.stop_geometry[stopIds[i]].distance - firstStopDistance;
      }
    }

    //console.log("No trip time found for " + routeId + " " + directionId + " to stop " + lastStop + '. max observed: ' + tripTime);
  }

  // console.log('trip time in minutes is ' + tripTime);

  return { tripTime, tripDistance };
}

/**
 *
 * @param meters
 * @returns Conversion from meters to miles.
 */
export function metersToMiles(meters) {
  return meters / 1609.344;
}

/**
 * Returns an array of {x: stop index, y: time} objects for
 * plotting on a chart.
 */
export function getTripDataSeries(tripTimes, route, directionId) {
  const { tripTimesForFirstStop, directionInfo } = getTripTimesUsingHeuristics(
    tripTimes,
    route,
    directionId,
  );

  if (!tripTimesForFirstStop) {
    //console.log('no trip times for first stop ' + routeId + ' ' + directionId);
    return [];
  } // no precomputed times

  const dataSeries = [];

  // Omit the first stop since trip time is always zero.
  //
  // Drop trip data points with no data.

  directionInfo.stops.slice(1).map((stop, index) => {
    if (!directionInfo.stop_geometry[stop]) {
      //console.log('no geometry for ' + routeId + ' ' + directionId + ' ' + stop);
    } else if (tripTimesForFirstStop[stop]) {
      dataSeries.push({
        x: metersToMiles(directionInfo.stop_geometry[stop].distance),
        y: tripTimesForFirstStop[stop][1], // median
        title: route.stops[stop].title,
        stopIndex: index,
      });
    } /* else {
      console.log('no trip times for first stop ' + routeId + ' ' + directionId + ' ' + stop);
    } */

    return null;
  });

  return dataSeries;
}

/**
 * Computes waits of all routes.
 *
 * @param {Object} waitTimes
 * @param {Object} routes
 */
export function getAllWaits(waitTimes, routes) {
  let allWaits = null;
  if (routes) {
    allWaits = filterRoutes(routes).map(route => {
      return {
        routeId: route.id,
        wait: getAverageOfMedianWaitStat(waitTimes, route),
        longWait:
          1 -
          getAverageOfMedianWaitStat(
            waitTimes,
            route,
            'plt20m',
          ),
      };
    });
    allWaits = allWaits.filter(waitObj => !Number.isNaN(waitObj.wait));
    allWaits.sort((a, b) => {
      return a.wait - b.wait;
    });
  }

  return allWaits;
}

/**
 * Computes the end to end speed for a route.
 *
 * @param {Object} tripTimes
 * @param {Object} route
 */
function getSpeedAndVariabilityForRoute(
  tripTimes,
  route,
) {
  let speeds = route.directions.map(direction => {

    const { tripTime, tripDistance } = getEndToEndTripTime(
      tripTimes,
      route,
      direction.id,
    );

    const p90tripTime = getEndToEndTripTime(
      tripTimes,
      route,
      direction.id,
      'p90',
    ).tripTime;

    const p10tripTime = getEndToEndTripTime(
        tripTimes,
        route,
        direction.id,
        'p10',
      ).tripTime;

    if (tripDistance <= 0 || Number.isNaN(tripTime)) {
      // something wrong with the data here
      // console.log('bad dist or tripTime: ' + dist + ' ' + tripTime + ' for ' + routeId + ' ' + direction.id);
      return -1;
    }

    // sanity check for stop to stop distance vs full route distance.
    // console.log(route.id + ': tripDistance ' + tripDistance + ' vs ' + direction.distance );

    const speed = (metersToMiles(Number.parseFloat(tripDistance)) / tripTime) * 60.0; // initial units are meters per minute, final are mph

    return {
      speed,
      variability: (p90tripTime - p10tripTime) / 2.0,
    };
  });

  speeds = speeds.filter(speed => speed.speed >= 0); // ignore negative speeds, as with oddball 9 direction

  if (speeds.length === 0) {
    return 0;
  }

  const sum = speeds.reduce(
    (total, currentValue) => total + currentValue.speed,
    0,
  );
  const sumVariability = speeds.reduce(
    (total, currentValue) => total + currentValue.variability,
    0,
  );
  return {
    speed: sum / speeds.length,
    variability: sumVariability / speeds.length,
  };
}

/**
 * Computes speeds of all routes.
 *
 * @param {any} routes
 * @param {any} allDistances
 */
export function getAllSpeeds(tripTimes, routes) {
  let allSpeeds = null;
  if (routes) {
    allSpeeds = filterRoutes(routes).map(route => {
      const speedAndVariability = getSpeedAndVariabilityForRoute(
        tripTimes,
        route,
      );
      return {
        routeId: route.id,
        speed: speedAndVariability.speed,
        variability: speedAndVariability.variability,
      };
    });
    allSpeeds = allSpeeds.filter(speedObj => speedObj.speed > 0); // not needed?
    allSpeeds.sort((a, b) => {
      return b.speed - a.speed;
    });

    // console.log(JSON.stringify(allSpeeds));
  }

  return allSpeeds;
}

/**
 * Score computation.
 *
 * TODO: refactor with Info.jsx's computation of grades once we add in probability
 * of long wait and travel variability to RouteSummary.
 */
export function computeScores(
  medianWait,
  longWaitProbability,
  speed,
  variability,
) {
  const medianWaitScoreScale = d3
    .scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);

  const longWaitScoreScale = d3
    .scaleLinear()
    .domain([0.1, 0.33])
    .rangeRound([100, 0])
    .clamp(true);

  const speedScoreScale = d3
    .scaleLinear()
    .domain([5, 10])
    .rangeRound([0, 100])
    .clamp(true);

  // score for travel time variability
  // where variability is half of (90th percentile time minus 10th percentile)

  const variabilityScoreScale = d3
    .scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);

  const medianWaitScore = (medianWait != null) ? medianWaitScoreScale(medianWait) : 0;
  const longWaitScore = (longWaitProbability != null) ? longWaitScoreScale(longWaitProbability) : 0;
  const speedScore = (speed != null) ? speedScoreScale(speed) : 0;
  const travelVarianceScore = (variability != null) ? variabilityScoreScale(variability) : 0;

  const totalScore = Math.round(
    (medianWaitScore + longWaitScore + speedScore + travelVarianceScore) / 4.0,
  );

  return {
    medianWaitScore,
    longWaitScore,
    speedScore,
    travelVarianceScore,
    totalScore,
  };
}

export const HighestPossibleScore = 100;

/**
 * Computes scores of all routes.
 *
 * @param {any} routes
 * @param {any} speeds
 */
export function getAllScores(routes, waits, speeds) {
  const allScores = [];

  routes.forEach(route => {
    const speedObj = speeds.find(speed => speed.routeId === route.id);
    const waitObj = waits.find(wait => wait.routeId === route.id);
    if (waitObj && speedObj) {
      const scores = computeScores(
        waitObj.wait,
        waitObj.longWait,
        speedObj.speed,
        speedObj.variability,
      );
      allScores.push(Object.assign({ routeId: route.id }, scores));
    }
  });

  allScores.sort((a, b) => {
    return b.totalScore - a.totalScore;
  });

  return allScores;
}

export const scoreBackgroundColor = score => {
  if (score == null || Number.isNaN(score)) {
    return null;
  }
  if (score <= 25) {
    return red[300];
  }
  if (score <= 50) {
    return yellow[300];
  }
  if (score <= 75) {
    return lightGreen[700];
  }
  return green[900];
}

export const scoreContrastColor = score => {
  if (score == null || Number.isNaN(score)) {
    return null;
  }
  if (score <= 25) {
    return 'rgba(0,0,0,0.87)';
  }
  if (score <= 50) {
    return 'rgba(0,0,0,0.87)';
  }
  if (score <= 75) {
    return 'white';
  }
  return 'white';
}

/**
 * Haversine formula for calcuating distance between two coordinates in lat lon
 * from bird eye view; seems to be +- 8 meters difference from geopy distance.
 *
 * From eclipses.py.  Returns distance in meters.
 */
export function haverDistance(degLatStop, degLonStop, degLatBus, degLonBus) {
  const deg2rad = x => (x * Math.PI) / 180;
  const eradius = 6371000;

  const [radLatStop, radLonStop, radLatBus, radLonBus] = [
    degLatStop,
    degLonStop,
    degLatBus,
    degLonBus,
  ].map(deg2rad);

  const latDiff = radLatBus - radLatStop;
  const lonDiff = radLonBus - radLonStop;

  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(radLatStop) * Math.cos(radLatBus) * Math.sin(lonDiff / 2) ** 2;
  const hypotenuse = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = eradius * hypotenuse;

  return distance;
}

/**
 * Returns the distance between two stops in miles.
 */
export function milesBetween(p1, p2) {
  const meters = haverDistance(p1.lat, p1.lon, p2.lat, p2.lon);
  return metersToMiles(meters);
}
