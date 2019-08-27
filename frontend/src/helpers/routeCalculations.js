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
export const routeHeuristics = {
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

/**
 * Given an array of routes, return only the routes we want to show.
 */
export function filterRoutes(routes) {
  return routes.filter(
    route =>
      !routeHeuristics[route.id] || !routeHeuristics[route.id].ignoreRoute,
  );
}

/**
 * Given directions array for a route and corresponding route ID, return only the valid directions.
 */
export function filterDirections(directions, routeID) {
  if (!routeHeuristics[routeID]) {
    return directions;
  }

  const directionsToIgnore = routeHeuristics[routeID].directionsToIgnore;
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
export function ignoreFlag(routeID, directionID, flagName) {
  if (!routeHeuristics[routeID]) {
    return false;
  }
  const direction = routeHeuristics[routeID][directionID];
  if (!direction) {
    return false;
  }
  if (direction[flagName]) {
    return direction[flagName];
  }
  return false;
}

export function ignoreFirstStop(routeID, directionID) {
  return ignoreFlag(routeID, directionID, 'ignoreFirstStop');
}

export function ignoreLastStop(routeID, directionID) {
  return ignoreFlag(routeID, directionID, 'ignoreLastStop');
}

/**
 * Get precomputed trip times for the first stop, then apply heuristic rules
 * to trim off the first stop or first stops if needed.
 */
function getTripTimesUsingHeuristics(
  tripTimesCache,
  graphParams,
  routes,
  routeID,
  directionID,
) {
  const tripTimesForDir = getTripTimesForDirection(
    tripTimesCache,
    graphParams,
    routeID,
    directionID,
  );

  if (!tripTimesForDir || !routes) {
    // console.log("No trip times found at all for " + directionID + " (gtfs out of sync or route not running)");
    // not sure if we should remap to normal terminal
    return { tripTimesForFirstStop: null, directionInfo: null };
  }
  // console.log('trip times for dir: ' + Object.keys(tripTimesForDir).length + ' keys' );

  // Note that some routes do not run their full length all day like the 5 Fulton, so they
  // don't go to all the stops.  Ideally we should know which stops they do run to.

  const route = routes.find(thisRoute => thisRoute.id === routeID);
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
export function getEndToEndTripTime(
  tripTimesCache,
  graphParams,
  routes,
  routeID,
  directionID,
) {
  const { tripTimesForFirstStop, directionInfo } = getTripTimesUsingHeuristics(
    tripTimesCache,
    graphParams,
    routes,
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
export function getTripDataSeries(props, routeID, directionID) {
  const { tripTimesForFirstStop, directionInfo } = getTripTimesUsingHeuristics(
    props.tripTimesCache,
    props.graphParams,
    props.routes,
    routeID,
    directionID,
  );

  if (!tripTimesForFirstStop) {
    return [];
  } // no precomputed times

  const route = props.routes.find(thisRoute => thisRoute.id === routeID);

  const dataSeries = [];

  // Omit the first stop since trip time is always zero.
  //
  // Drop trip data points with no data.

  directionInfo.stops.slice(1).map((stop, index) => {
    if (!directionInfo.stop_geometry[stop]) {
      // console.log('no geometry for ' + routeID + ' ' + directionID + ' ' + stop);
    }
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
export function getAllWaits(waitTimesCache, graphParams, routes) {
  let allWaits = null;
  if (routes) {
    allWaits = filterRoutes(routes).map(route => {
      return {
        routeID: route.id,
        wait: getAverageOfMedianWait(waitTimesCache, graphParams, route),
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
 * @param {any} routes
 * @param {any} route_id
 */
function getSpeedForRoute(tripTimesCache, graphParams, routes, route_id) {
  const route = routes.find(thisRoute => thisRoute.id === route_id);

  const filteredDirections = filterDirections(route.directions, route_id);
  let speeds = filteredDirections.map(direction => {
    const dist = direction.distance;
    const tripTime = getEndToEndTripTime(
      tripTimesCache,
      graphParams,
      routes,
      route.id,
      direction.id,
    );

    if (dist <= 0 || Number.isNaN(tripTime)) {
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
export function getAllSpeeds(tripTimesCache, graphParams, routes) {
  let allSpeeds = null;
  if (routes) {
    allSpeeds = filterRoutes(routes).map(route => {
      return {
        routeID: route.id,
        speed: getSpeedForRoute(tripTimesCache, graphParams, routes, route.id),
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

export const quartileBackgroundColor = d3
  .scaleThreshold()
  .domain([0.25, 0.5, 0.75])
  .range([red[300], yellow[500], lightGreen[700], green[900]]);

export const quartileForegroundColor = d3
  .scaleThreshold()
  .domain([0.25, 0.5, 0.75])
  .range(['black', 'black', 'black', 'white']);

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
