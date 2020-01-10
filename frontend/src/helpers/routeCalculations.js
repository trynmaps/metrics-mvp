/**
 * Helper functions for working with routes and stops.  These are used to filter out
 * routes, spurious directions, and idiosyncratic stops when listing and scoring entire routes.
 *
 * Also includes functions for computing distances between coordinates.
 */

import * as d3 from 'd3';
import red from '@material-ui/core/colors/red';
import yellow from '@material-ui/core/colors/yellow';
import lightGreen from '@material-ui/core/colors/lightGreen';
import green from '@material-ui/core/colors/green';
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
    const routeHeuristics = getAgency(route.agencyId).routeHeuristics;
    return (
      !routeHeuristics ||
      !routeHeuristics[route.id] ||
      !routeHeuristics[route.id].ignoreRoute
    );
  });
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
  tripTimesCache,
  graphParams,
  routes,
  routeId,
  directionId,
) {
  const tripTimesForDir = getTripTimesForDirection(
    tripTimesCache,
    graphParams,
    routeId,
    directionId,
  );

  if (!tripTimesForDir || !routes) {
    // console.log("No trip times found at all for " + directionId + " (gtfs out of sync or route not running)");
    // not sure if we should remap to normal terminal
    return { tripTimesForFirstStop: null, directionInfo: null };
  }

  // console.log('trip times for dir: ' + Object.keys(tripTimesForDir).length + ' keys' );

  // Note that some routes do not run their full length all day like the 5 Fulton, so they
  // don't go to all the stops.  Ideally we should know which stops they do run to.

  const route = routes.find(thisRoute => thisRoute.id === routeId);
  const directionInfo = route.directions.find(
    direction => direction.id === directionId,
  );

  const routeHeuristics = getAgency(graphParams.agencyId).routeHeuristics;

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
    // console.log("No trip times found for " + routeId + " from stop " + firstStop + ".  Using stop with most entries.");
    tripTimesForFirstStop = Object.values(tripTimesForDir).reduce(
      (accumulator, currentValue) =>
        Object.values(currentValue).length > Object.values(accumulator).length
          ? currentValue
          : accumulator,
      {},
    );
  }

  return { tripTimesForFirstStop, directionInfo };
}

/**
 * Returns trip time across the full route, applying heuristic rules to ignore
 * the last stop or stops as needed.
 */
export function getEndToEndTripTime(
  tripTimesCache,
  graphParams,
  routes,
  routeId,
  directionId,
  stat = 'median',
) {
  const { tripTimesForFirstStop, directionInfo } = getTripTimesUsingHeuristics(
    tripTimesCache,
    graphParams,
    routes,
    routeId,
    directionId,
  );

  if (!tripTimesForFirstStop) {
    // no precomputed times
    // console.log("No precomputed trip times for " + routeId + " " + directionId + " (gtfs out of sync with historic data or route not running)");
    return '?';
  }

  const routeHeuristics = getAgency(graphParams.agencyId).routeHeuristics;

  const ignoreLast = ignoreLastStop(routeHeuristics, routeId, directionId); // look up heuristic rule

  let lastStop = null;

  /*
   * For determining end to end trip time, but doesn't currently affect computation of route length,
   * which is based on best guess as to the right GTFS shape. And the shape is not linked to the stops,
   * it's just coordinates and distance along route, so more logic would be needed to "trim" the shape
   * if stops are ignored.
   */
  if (ignoreLast !== true && ignoreLast !== false) {
    lastStop = ignoreLast; // ignore stops after index specified by ignoreLast
  } else {
    // is a boolean
    lastStop =
      directionInfo.stops[directionInfo.stops.length - (ignoreLast ? 2 : 1)];
  }

  // console.log('found ' + Object.keys(tripTimesForFirstStop).length + ' keys' );

  let statIndex = 1; // default to median (p10-median-p90)
  if (stat === 'p90') {
    statIndex = 2;
  } else if (stat === 'p10') {
    statIndex = 0;
  }

  let tripTime = null;
  if (tripTimesForFirstStop[lastStop]) {
    tripTime = tripTimesForFirstStop[lastStop][statIndex];
  }

  // if there is no trip time to the last stop, then use the highest trip time actually observed

  if (!tripTime) {
    tripTime = Math.max(
      ...Object.values(getTripTimeStat(tripTimesForFirstStop, statIndex)),
    );
    // console.log("No trip time found for " + routeId + " " + directionId + " to stop " + lastStop + '. max observed: ' + tripTime);
  }

  // console.log('trip time in minutes is ' + tripTime);
  return tripTime;
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
export function getTripDataSeries(props, routeId, directionId) {
  const { tripTimesForFirstStop, directionInfo } = getTripTimesUsingHeuristics(
    props.tripTimesCache,
    props.graphParams,
    props.routes,
    routeId,
    directionId,
  );

  if (!tripTimesForFirstStop) {
    // console.log('no trip times for first stop ' + routeId + ' ' + directionId);
    return [];
  } // no precomputed times

  const route = props.routes.find(thisRoute => thisRoute.id === routeId);

  const dataSeries = [];

  // Omit the first stop since trip time is always zero.
  //
  // Drop trip data points with no data.

  directionInfo.stops.slice(1).map((stop, index) => {
    if (!directionInfo.stop_geometry[stop]) {
      // console.log('no geometry for ' + routeId + ' ' + directionId + ' ' + stop);
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
 * @param {Object} waitTimesCache
 * @param {Object} graphParams
 * @param {Object} routes
 */
export function getAllWaits(waitTimesCache, graphParams, routes) {
  let allWaits = null;
  if (routes) {
    allWaits = filterRoutes(routes).map(route => {
      return {
        routeId: route.id,
        wait: getAverageOfMedianWaitStat(waitTimesCache, graphParams, route),
        longWait:
          1 -
          getAverageOfMedianWaitStat(
            waitTimesCache,
            graphParams,
            route,
            'plt20m',
          ),
      };
    });
    allWaits = allWaits.filter(waitObj => !Number.isNaN(waitObj.wait));
    allWaits.sort((a, b) => {
      return b.wait - a.wait;
    });
  }

  return allWaits;
}

/**
 * Computes the end to end speed for a route.
 *
 * @param {Object} tripTimesCache
 * @param {Object} graphParams
 * @param {any} routes
 * @param {any} routeId
 */
function getSpeedAndVariabilityForRoute(
  tripTimesCache,
  graphParams,
  routes,
  routeId,
) {
  const route = routes.find(thisRoute => thisRoute.id === routeId);

  let speeds = route.directions.map(direction => {
    const dist = direction.distance;
    const tripTime = getEndToEndTripTime(
      tripTimesCache,
      graphParams,
      routes,
      route.id,
      direction.id,
    );

    const p90tripTime = getEndToEndTripTime(
      tripTimesCache,
      graphParams,
      routes,
      route.id,
      direction.id,
      'p90',
    );

    const p10tripTime = getEndToEndTripTime(
      tripTimesCache,
      graphParams,
      routes,
      route.id,
      direction.id,
      'p10',
    );

    if (dist <= 0 || Number.isNaN(tripTime)) {
      // something wrong with the data here
      // console.log('bad dist or tripTime: ' + dist + ' ' + tripTime + ' for ' + routeId + ' ' + direction.id);
      return -1;
    }

    const speed = (metersToMiles(Number.parseFloat(dist)) / tripTime) * 60.0; // initial units are meters per minute, final are mph

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
export function getAllSpeeds(tripTimesCache, graphParams, routes) {
  let allSpeeds = null;
  if (routes) {
    allSpeeds = filterRoutes(routes).map(route => {
      const speedAndVariability = getSpeedAndVariabilityForRoute(
        tripTimesCache,
        graphParams,
        routes,
        route.id,
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
 * Grade computation.
 *
 * TODO: refactor with Info.jsx's computation of grades once we add in probability
 * of long wait and travel variability to RouteSummary.
 */
export function computeGrades(
  medianWait,
  longWaitProbability,
  speed,
  variability,
) {
  //
  // grade and score for median wait
  //

  const medianWaitScoreScale = d3
    .scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);

  const medianWaitGradeScale = d3
    .scaleThreshold()
    .domain([5, 7.5, 10])
    .range(['A', 'B', 'C', 'D']);

  const longWaitScoreScale = d3
    .scaleLinear()
    .domain([0.1, 0.33])
    .rangeRound([100, 0])
    .clamp(true);

  // grade and score for travel speed

  const speedScoreScale = d3
    .scaleLinear()
    .domain([5, 10])
    .rangeRound([0, 100])
    .clamp(true);

  const speedGradeScale = d3
    .scaleThreshold()
    .domain([5, 7.5, 10])
    .range(['D', 'C', 'B', 'A']);

  //
  // grade score for travel time variability
  //
  // where variability is half of (90th percentile time minus 10th percentile)
  //

  const variabilityScoreScale = d3
    .scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);

  const totalGradeScale = d3
    .scaleThreshold()
    .domain([25, 50, 75])
    .range(['D', 'C', 'B', 'A']);

  let medianWaitScore = 0;
  let medianWaitGrade = '';
  let longWaitScore = 0;
  let speedScore = 0;
  let speedGrade = '';
  let travelVarianceScore = 0;
  let totalScore = 0;
  let totalGrade = '';

  if (medianWait != null) {
    medianWaitScore = medianWaitScoreScale(medianWait);
    medianWaitGrade = medianWaitGradeScale(medianWait);
  }

  if (longWaitProbability != null) {
    longWaitScore = longWaitScoreScale(longWaitProbability);
  }

  if (speed != null) {
    speedScore = speedScoreScale(speed);
    speedGrade = speedGradeScale(speed);
  }

  if (variability != null) {
    travelVarianceScore = variabilityScoreScale(variability);
  }

  totalScore = Math.round(
    (medianWaitScore + longWaitScore + speedScore + travelVarianceScore) / 4.0,
  );
  totalGrade = totalGradeScale(totalScore);

  return {
    medianWaitScore,
    medianWaitGrade,
    longWaitScore,
    speedScore,
    speedGrade,
    travelVarianceScore,
    totalScore,
    totalGrade,
    highestPossibleScore: 100,
  };
}

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
      const grades = computeGrades(
        waitObj.wait,
        waitObj.longWait,
        speedObj.speed,
        speedObj.variability,
      );
      allScores.push({
        routeId: route.id,
        totalScore: grades.totalScore,
        medianWaitScore: grades.medianWaitScore,
        longWaitScore: grades.longWaitScore,
        speedScore: grades.speedScore,
        travelVarianceScore: grades.travelVarianceScore,
      });
    }
  });

  allScores.sort((a, b) => {
    return b.totalScore - a.totalScore;
  });

  // console.log(JSON.stringify(allScores));

  return allScores;
}

export const quartileBackgroundColor = d3
  .scaleThreshold()
  .domain([0.25, 0.5, 0.75])
  .range([red[300], yellow[300], lightGreen[800], green[900]]);

export const quartileContrastColor = d3
  .scaleThreshold()
  .domain([0.25, 0.5, 0.75])
  .range(['black', 'black', 'white', 'white']);

// for coloring the route table's white columns, to emphasize low scoring cells
export const quartileTextColor = d3
  .scaleThreshold()
  .domain([0.25, 0.5, 0.75])
  .range(['black', 'black', '#8a8a8a', '#8a8a8a']);

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
