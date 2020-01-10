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
 * Utility method to pull time and date out of graphParams as strings
 */
export function getTimeStrAndDateStr(graphParams) {
  const timeStr = graphParams.startTime
    ? `${graphParams.startTime}-${graphParams.endTime}`
    : '';
  const dateStr = graphParams.date;
  return [timeStr, dateStr];
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
 * Maps time range to a file path (used by Redux action).
 */

export function getTimePath(timeStr) {
  return timeStr
    ? `_${timeStr
        .replace(/:/g, '')
        .replace('-', '_')
        .replace(/\+/g, '%2B')}`
    : '';
}

/**
 * Gets trip times for a given route and direction.
 *
 * @param tripTimesCache
 * @param graphParams -- date and time values
 * @param routeId
 * @param directionId
 * @param stat
 * @returns
 */
export function getTripTimesForDirection(
  tripTimesCache,
  graphParams,
  routeId,
  directionId,
) {
  const [timeStr, dateStr] = getTimeStrAndDateStr(graphParams);

  if (!tripTimesCache) {
    return null;
  }

  const agencyId = graphParams.agencyId;
  const tripTimes =
    tripTimesCache[`${agencyId}-${dateStr + timeStr}-p10-median-p90`]; // 'median'

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
 * @param routeId
 * @param directionId
 * @param startStopId
 * @param dateStr  "2019-07-02"
 * @param timeStr  "0700-1900" or empty string (values from time picker)
 * @param stat     "median"
 * @returns
 */
export function getTripTimesFromStop(
  tripTimesCache,
  graphParams,
  routeId,
  directionId,
  startStopId,
  stat = 'median',
) {
  const directionTripTimes = getTripTimesForDirection(
    tripTimesCache,
    graphParams,
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
 * Maps the given stat to a stat group (part of the file path).  Example stat groups are
 * "median" and "p10-median-p90".  When fetching an individual stat, this function returns
 * which group should be used, favoring more compact groups over larger ones.
 *
 * @param stat
 */
export function getStatPath(stat) {
  switch (stat) {
    case 'median':
      return 'median';
    case 'p10':
    case 'p90':
      return 'p10-median-p90';
    default:
      throw new Error(`unknown stat ${stat}`);
  }
}

/**
 * Gets the wait time info for a given route and direction.
 *
 * @param waitTimesCache
 * @param graphParams -- used for date and time values
 * @param routeId
 * @param directionId
 * @param stat
 */
export function getWaitTimeForDirection(
  waitTimesCache,
  graphParams,
  routeId,
  directionId,
) {
  const [timeStr, dateStr] = getTimeStrAndDateStr(graphParams);

  const agencyId = graphParams.agencyId;

  const waitTimes =
    waitTimesCache[`${agencyId}-${dateStr + timeStr}-median-p90-plt20m`];

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
 * @param {any} waitTimesCache
 * @param {any} graphParams
 * @param {any} route
 */
export function getAverageOfMedianWaitStat(
  waitTimesCache,
  graphParams,
  route,
  stat = 'median',
) {
  const directions = route.directions;
  const sumOfMedians = directions.reduce((total, direction) => {
    const waitForDir = getWaitTimeForDirection(
      waitTimesCache,
      graphParams,
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
