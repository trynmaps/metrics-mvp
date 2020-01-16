/**
 * Pulls a data series from a collection by index.
 */
export function getTripTimeStat(tripTimeValues, index) {
  if (!tripTimeValues) {
    return null;
  }

  const statValues = {};

  Object.keys(tripTimeValues).forEach(endStopId => {
    statValues[endStopId] = tripTimeValues[endStopId][index];
  });

  return statValues;
}

/**
 * Access of precomputed wait and trip times.
 *
 * See https://github.com/trynmaps/metrics-mvp/pull/143 for an overview of the file structure and
 * json structure.
 *
 * Functions taken from the isochrone branch.
 *
 * Fetching of the precomputed wait/trip time json is done using Redux.
 * getWaitTimeAtStop is commented out but left here for usage reference.
 */

/**
 * Gets trip times for a given route and direction.
 *
 * @param tripTimes
 * @param routeId
 * @param directionId
 * @param stat
 * @returns
 */
export function getTripTimesForDirection(tripTimes, routeId, directionId) {
  if (!tripTimes) {
    // console.log('no trip times');
    return null;
  }

  const routeTripTimes = tripTimes.routes[routeId];
  if (!routeTripTimes) {
    // console.log('no trip times for route ' + routeId);
    return null;
  }

  const directionTripTimes = routeTripTimes[directionId];
  return directionTripTimes;
}

/**
 * Gets the downstream trip times for a given route, direction, and stop.
 *
 * @param tripTimes
 * @param routeId
 * @param directionId
 * @param startStopId
 * @param stat     "median"
 * @returns
 */
export function getTripTimesFromStop(
  tripTimes,
  routeId,
  directionId,
  startStopId,
  stat = 'median',
) {
  const directionTripTimes = getTripTimesForDirection(
    tripTimes,
    routeId,
    directionId,
  );
  if (!directionTripTimes) {
    // console.log('null trip times');
    return null;
  }
  const tripTimeValues = directionTripTimes[startStopId];

  if (stat === 'median') {
    // using the median stat group (see getStatPath)
    return getTripTimeStat(tripTimeValues, 1);
    // return tripTimeValues; // p10-median-p90 file blocked:
  }
  if (stat === 'p10') {
    // using the p10-median-p90 stat group (see getStatPath)
    return getTripTimeStat(tripTimeValues, 0);
  }
  if (stat === 'p90') {
    // using the p10-median-p90 stat group (see getStatPath)
    return getTripTimeStat(tripTimeValues, 2);
  }
  return null;
}

/**
 * Gets the wait time info for a given route and direction.
 *
 * @param waitTimes
 * @param routeId
 * @param directionId
 */
export function getWaitTimeForDirection(waitTimes, routeId, directionId) {
  if (!waitTimes) {
    return null;
  }

  const routeWaitTimes = waitTimes.routes[routeId];
  if (!routeWaitTimes) {
    return null;
  }

  const directionWaitTimes = routeWaitTimes[directionId];
  if (!directionWaitTimes) {
    return null;
  }
  return directionWaitTimes;
}

/**
 * Averages together the median wait in all directions for a route.
 *
 * @param {any} waitTimes
 * @param {any} route
 */
export function getAverageOfMedianWaitStat(waitTimes, route, stat = 'median') {
  const directions = route.directions;
  const sumOfMedians = directions.reduce((total, direction) => {
    const waitForDir = getWaitTimeForDirection(
      waitTimes,
      route.id,
      direction.id,
    );
    if (!waitForDir || !waitForDir.median) {
      return NaN;
    }
    if (stat === 'plt20m') {
      // statgroup is median-p90-plt20m
      return total + waitForDir.median[2]; // subscript two is median of per-stop probabilities of < 20m wait
    } // default to median
    return total + waitForDir.median[0]; // subscript zero is median of per-stop medians
  }, 0);
  return sumOfMedians / directions.length;
}
