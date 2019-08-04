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
  getTripTimesForDirection,
  getAverageOfMedianWait,
} from './precomputed';

/**
 * Returns a data object with centralized declarations of "per route" heuristic rules
 * to apply when doing systemwide computations.
 *
 * For example, for routes with directions that should be ignored:
 *
 * {
 *   <routeID>: {
 *     directionsToIgnore: [<directionID>]
 *   }
 * }
 *
 * Other cases:
 * - Routes to filter out completely:
 *   - S due to lack of regular route and schedule
 *   - Owls due to the date boundary problem.
 * - Routes that have non-code issues with arrivals their first or last stop and so the second or penultimate stop
 *     should be used instead for end-to-end calculations.  Cable car lines are like this.  Also the M has a last
 *     stop that it normally does not go to.
 * - Possibly special handling for routes with back end issues (currently 5, 9, 9R) as a temporary workaround.
 *   - The 9 has multiple terminals so use the last common stop.
 *   - The 5 was reconfigured and Nextbus stop configs are out of sync with historic data.  Use last good stop.
 */
export function getRouteHeuristics() {
  return {
    J: {
      directionsToIgnore: ['J____I_D10'], // this is to 23rd and 3rd
    },
    L: {
      directionsToIgnore: ['L____I_U53'],
    },
    M: {
      M____O_D00: {
        ignoreFirstStop: true, // Embarcadero & Folsom is not a real stop
      },
    },
    N: {
      N____O_F10: {
        ignoreFirstStop: true, // 4th and King to 2nd and King trip times are skewed by a few hyperlong trips
      },
    },
    S: {
      ignoreRoute: true,
    },
    '5': {
      '5____I_F00': {
        ignoreFirstStop: '4218', // no data for 3927, and first few stop ids are now different.  Problem is even worse on outbound side, no good fix there.
      },
    },
    '9': {
      '9____I_N00': {
        ignoreFirstStop: '7297', // use Bayshore as actual first stop (daytime)
      },
      '9____O_N00': {
        ignoreLastStop: '7297', // use Bayshore as actual terminal (daytime)
      },
    },
    '24': {
      directionsToIgnore: ['24___I_D10'],
    },
    '90': {
      ignoreRoute: true,
    },
    '91': {
      ignoreRoute: true,
    },
    K_OWL: {
      ignoreRoute: true,
    },
    L_OWL: {
      ignoreRoute: true,
    },
    M_OWL: {
      ignoreRoute: true,
    },
    N_OWL: {
      ignoreRoute: true,
    },
    T_OWL: {
      ignoreRoute: true,
    },
    PM: {
      PM___O_F00: {
        ignoreLastStop: true, // long time to Taylor and Bay (probably in holding area)
      },
      PM___I_F00: {
        ignoreFirstStop: true, // 30 minutes from Hyde & Beach to Hyde & North Point
      },
    },
    PH: {
      PH___I_F00: {
        ignoreFirstStop: true, // 30 minutes from Hyde & Beach to Hyde & North Point
      },
    },
    C: {
      C____I_F00: {
        ignoreLastStop: true, // long time to California & Drumm (probably in holding area)
      },
    },
  };
}

/**
 * Given an array of routes, return only the routes we want to show.
 */
export function filterRoutes(routes) {
  const heuristics = getRouteHeuristics();

  return routes.filter(
    route => !heuristics[route.id] || !heuristics[route.id].ignoreRoute,
  );
}

/**
 * Given directions array for a route and corresponding route ID, return only the valid directions.
 */
export function filterDirections(directions, routeID) {
  const heuristics = getRouteHeuristics();

  if (!heuristics[routeID]) {
    return directions;
  }

  const directionsToIgnore = heuristics[routeID].directionsToIgnore;
  if (!directionsToIgnore) {
    return directions;
  }

  return directions.filter(
    direction => !directionsToIgnore.includes(direction.id),
  );
}

/**
 * Whether the first stop in a direction's stop list should be disregarded.
 * For example, the M outbound lists Embarcadero & Folsom as first stop, but few
 * M's actually go to that stop.  For better end to end calculations, need to disregard
 * the first stop.
 */

export function ignoreFirstStop(routeID, directionID) {
  return ignoreFlag(routeID, directionID, 'ignoreFirstStop');
}

export function ignoreLastStop(routeID, directionID) {
  return ignoreFlag(routeID, directionID, 'ignoreLastStop');
}

export function ignoreFlag(routeID, directionID, flagName) {
  const heuristics = getRouteHeuristics();
  if (!heuristics[routeID]) {
    return false;
  }
  const direction = heuristics[routeID][directionID];
  if (!direction) {
    return false;
  }
  if (direction[flagName]) {
    return direction[flagName];
  }
  return false;
}

/**
 * Get precomputed trip times for the first stop, then apply heuristic rules
 * to trim off the first stop or first stops if needed.
 */
function getTripTimesUsingHeuristics(props, routeID, directionID) {
  const tripTimesForDir = getTripTimesForDirection(
    props.tripTimesCache,
    props.graphParams,
    routeID,
    directionID,
  );

  if (!tripTimesForDir || !props.routes) {
    // console.log("No trip times found at all for " + directionID + " (gtfs out of sync or route not running)");
    // not sure if we should remap to normal terminal
    return { tripTimesForFirstStop: null, directionInfo: null };
  }
  // console.log('trip times for dir: ' + Object.keys(tripTimesForDir).length + ' keys' );

  // Note that some routes do not run their full length all day like the 5 Fulton, so they
  // don't go to all the stops.  Ideally we should know which stops they do run to.

  const route = props.routes.find(route => route.id === routeID);
  const directionInfo = route.directions.find(
    direction => direction.id === directionID,
  );

  const ignoreFirst = ignoreFirstStop(routeID, directionID); // look up heuristic rule
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

  if (!tripTimesForFirstStop) {
    // console.log("No trip times found for " + routeID + " from stop " + firstStop + ".  Using stop with most entries.");
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
export function getEndToEndTripTime(props, routeID, directionID) {
  const { tripTimesForFirstStop, directionInfo } = getTripTimesUsingHeuristics(
    props,
    routeID,
    directionID,
  );

  if (!tripTimesForFirstStop) {
    // no precomputed times
    // console.log("No precomputed trip times for " + routeID + " " + directionID + " (gtfs out of sync with historic data or route not running)");
    return '?';
  }

  const ignoreLast = ignoreLastStop(routeID, directionID); // look up heuristic rule

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

  let tripTime = tripTimesForFirstStop[lastStop];

  // if there is no trip time to the last stop, then use the highest trip time actually observed

  if (!tripTime) {
    // console.log("No trip time found for " + routeID + " " + directionID + " to stop " + lastStop);
    tripTime = Math.max(...Object.values(tripTimesForFirstStop));
  }

  // console.log('trip time in minutes is ' + tripTime);
  return tripTime;
}

/**
 * Returns an array of {x: stop index, y: time} objects for
 * plotting on a chart.
 */
export function getTripDataSeries(props, routeID, directionID) {
  const { tripTimesForFirstStop, directionInfo } = getTripTimesUsingHeuristics(
    props,
    routeID,
    directionID,
  );

  if (!tripTimesForFirstStop) {
    return [];
  } // no precomputed times

  const route = props.routes.find(route => route.id === routeID);

  const dataSeries = [];

  // Omit the first stop since trip time is always zero.
  //
  // Drop trip data points with no data.

  directionInfo.stops.slice(1).map((stop, index) => {
    if (!directionInfo.stop_geometry[stop]) { console.log('no geometry for ' + routeID + ' ' + directionID + ' ' + stop);}
    if (tripTimesForFirstStop[stop] && directionInfo.stop_geometry[stop]) {
      dataSeries.push({
        x: metersToMiles(directionInfo.stop_geometry[stop].distance),
        y: tripTimesForFirstStop[stop],
        title: route.stops[stop].title,
        stopIndex: index,
      });
    }
    return null;
  });

  return dataSeries;
}

/**
 * Computes waits of all routes.
 *
 * @param {any} props
 */
export function getAllWaits(props) {
  let allWaits = null;
  if (props.routes) {
    allWaits = filterRoutes(props.routes).map(route => {
      return {
        routeID: route.id,
        wait: getAverageOfMedianWait(
          props.waitTimesCache,
          props.graphParams,
          route,
        ),
      };
    });
    allWaits = allWaits.filter(waitObj => !isNaN(waitObj.wait));
    allWaits.sort((a, b) => {
      return b.wait - a.wait;
    });
  }

  return allWaits;
}

/**
 * Precalculated route distances are used instead of trying to extract route lengths
 * from GTFS data on the fly.  This is the average route distance across all directions for a route.
 */
export function getAllDistances() {
  const allDistances = [
    { routeID: 'KT', distance: 23428.5 },
    { routeID: '29', distance: 21773 },
    { routeID: '43', distance: 19751.5 },
    { routeID: '28', distance: 18832 },
    { routeID: '8BX', distance: 18042 },
    { routeID: '8', distance: 17935 },
    { routeID: '54', distance: 16818 },
    { routeID: '44', distance: 16617.5 },
    { routeID: '57', distance: 15346 },
    { routeID: '48', distance: 15314.333333333334 },
    { routeID: 'M', distance: 15072.5 },
    { routeID: 'N', distance: 14551.5 },
    { routeID: '9R', distance: 14407 },
    { routeID: '14X', distance: 14402.5 },
    { routeID: '23', distance: 14192.5 },
    { routeID: '14R', distance: 13741 },
    { routeID: '714', distance: 13623.5 },
    { routeID: 'L', distance: 13437.5 },
    { routeID: '7X', distance: 13373.5 },
    { routeID: '7', distance: 13193 },
    { routeID: '28R', distance: 12828.5 },
    { routeID: '19', distance: 12758.5 },
    { routeID: '14', distance: 12536 },
    { routeID: '9', distance: 12524 },
    { routeID: '8AX', distance: 12330.5 },
    { routeID: 'NX', distance: 12086.5 },
    { routeID: '10', distance: 11986 },
    { routeID: '36', distance: 11702.5 },
    { routeID: '18', distance: 11665 },
    { routeID: 'J', distance: 11443 },
    { routeID: '5', distance: 11400 },
    { routeID: '5R', distance: 11400 },
    { routeID: '31', distance: 11369.5 },
    { routeID: '49', distance: 11233 },
    { routeID: '31AX', distance: 11212.5 },
    { routeID: '38', distance: 11122.5 },
    { routeID: '24', distance: 11057.5 },
    { routeID: '38R', distance: 10782 },
    { routeID: '38AX', distance: 10544 },
    { routeID: '33', distance: 10414.5 },
    { routeID: '12', distance: 10315 },
    { routeID: '6', distance: 10139 },
    { routeID: '22', distance: 9305 },
    { routeID: '1AX', distance: 9271 },
    { routeID: '1', distance: 9255.5 },
    { routeID: '37', distance: 8477 },
    { routeID: '38BX', distance: 8392.5 },
    { routeID: '2', distance: 8315 },
    { routeID: '25', distance: 8219 },
    { routeID: 'F', distance: 8206.5 },
    { routeID: '27', distance: 8177 },
    { routeID: '47', distance: 7845.5 },
    { routeID: '31BX', distance: 7649 },
    { routeID: '30', distance: 7628 },
    { routeID: '21', distance: 7185 },
    { routeID: '45', distance: 6827.5 },
    { routeID: '52', distance: 6766 },
    { routeID: '30X', distance: 6642.5 },
    { routeID: '1BX', distance: 6334.5 },
    { routeID: 'E', distance: 5735 },
    { routeID: '41', distance: 5656 },
    { routeID: '3', distance: 5548 },
    { routeID: '66', distance: 4929 },
    { routeID: '35', distance: 4831.5 },
    { routeID: '56', distance: 4527.5 },
    { routeID: '82X', distance: 4162.5 },
    { routeID: '67', distance: 3977.5 },
    { routeID: '55', distance: 3693 },
    { routeID: 'PH', distance: 3359.3333333333335 },
    { routeID: '81X', distance: 3274 },
    { routeID: '39', distance: 2902 },
    { routeID: '83X', distance: 2622.5 },
    { routeID: 'PM', distance: 2607 },
    { routeID: 'C', distance: 2302 },
    { routeID: '88', distance: 2258 },
  ];

  return allDistances;
}

/**
 * Computes the end to end speed for a route.
 *
 * @param {any} props
 * @param {any} route_id
 * @param {any} allDistances
 */
function getSpeedForRoute(props, route_id, allDistances) {
  const route = props.routes.find(route => route.id === route_id);

  const filteredDirections = filterDirections(route.directions, route_id);
  let speeds = filteredDirections.map(direction => {
    const distObj = allDistances.find(distObj => distObj.routeID === route_id);
    const dist = distObj ? distObj.distance : null;
    const tripTime = getEndToEndTripTime(props, route.id, direction.id);

    if (dist <= 0 || isNaN(tripTime)) {
      // something wrong with the data here
      // console.log('bad dist or tripTime: ' + dist + ' ' + tripTime + ' for ' + route_id + ' ' + direction.id);
      return -1;
    }

    const speed = (metersToMiles(Number.parseFloat(dist)) / tripTime) * 60.0; // initial units are meters per minute, final are mph
    return speed;
  });

  speeds = speeds.filter(speed => speed >= 0); // ignore negative speeds, as with oddball 9 direction

  if (speeds.length === 0) {
    return 0;
  }

  const sum = speeds.reduce((total, currentValue) => total + currentValue);
  return sum / speeds.length;
}

/**
 * Computes speeds of all routes.
 *
 * @param {any} routes
 * @param {any} allDistances
 */
export function getAllSpeeds(props, allDistances) {
  let allSpeeds = null;
  if (props.routes) {
    allSpeeds = filterRoutes(props.routes).map(route => {
      return {
        routeID: route.id,
        speed: getSpeedForRoute(props, route.id, allDistances),
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
 * Computes scores of all routes.
 *
 * @param {any} routes
 * @param {any} speeds
 */
export function getAllScores(routes, waits, speeds) {
  const allScores = [];
  for (const route of routes) {
    const speedObj = speeds.find(speed => speed.routeID === route.id);
    const waitObj = waits.find(wait => wait.routeID === route.id);
    if (waitObj && speedObj) {
      const grades = computeGrades(waitObj.wait, speedObj.speed);
      allScores.push({ routeID: route.id, totalScore: grades.totalScore });
    }
  }
  allScores.sort((a, b) => {
    return b.totalScore - a.totalScore;
  });

  // console.log(JSON.stringify(allScores));

  return allScores;
}

/**
 * Grade computation.
 *
 * TODO: refactor with Info.jsx's computation of grades once we add in probability
 * of long wait and travel variability to RouteSummary.
 */
export function computeGrades(medianWait, speed) {
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

  const totalGradeScale = d3
    .scaleThreshold()
    .domain([25, 50, 75])
    .range(['D', 'C', 'B', 'A']);

  let medianWaitScore = 0;
  let medianWaitGrade = '';
  let speedScore = 0;
  let speedGrade = '';
  let totalScore = 0;
  let totalGrade = '';

  if (medianWait != null) {
    medianWaitScore = medianWaitScoreScale(medianWait);
    medianWaitGrade = medianWaitGradeScale(medianWait);
  }

  if (speed != null) {
    speedScore = speedScoreScale(speed);
    speedGrade = speedGradeScale(speed);
  }

  totalScore = Math.round((medianWaitScore + speedScore) / 2.0);
  totalGrade = totalGradeScale(totalScore);

  return {
    medianWaitScore,
    medianWaitGrade,
    speedScore,
    speedGrade,
    totalScore,
    totalGrade,
    highestPossibleScore: 100,
  };
}

export const quartileBackgroundColor = d3
  .scaleThreshold()
  .domain([0.25, 0.5, 0.75])
  .range([red[300], yellow[500], lightGreen[700], green[900]]);

export const quartileForegroundColor = d3
  .scaleThreshold()
  .domain([0.25, 0.5, 0.75])
  .range(['black', 'black', 'black', 'white']);

/**
 * Returns the distance between two stops in miles.
 */
export function milesBetween(p1, p2) {
  const meters = haverDistance(p1.lat, p1.lon, p2.lat, p2.lon);
  return metersToMiles(meters);
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
 * Haversine formula for calcuating distance between two coordinates in lat lon
 * from bird eye view; seems to be +- 8 meters difference from geopy distance.
 *
 * From eclipses.py.  Returns distance in meters.
 */
export function haverDistance(latstop, lonstop, latbus, lonbus) {
  const deg2rad = x => (x * Math.PI) / 180;

  [latstop, lonstop, latbus, lonbus] = [latstop, lonstop, latbus, lonbus].map(
    deg2rad,
  );
  const eradius = 6371000;

  const latdiff = latbus - latstop;
  const londiff = lonbus - lonstop;

  const a =
    Math.sin(latdiff / 2) ** 2 +
    Math.cos(latstop) * Math.cos(latbus) * Math.sin(londiff / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = eradius * c;
  return distance;
}
