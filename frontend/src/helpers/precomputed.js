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
export function getTimePath(timeStr)
{
    return timeStr ? ('_' + timeStr.replace(/:/g,'').replace('-','_').replace(/\+/g,'%2B')) : '';
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
export function getTripTimesForDirection(tripTimesCache, graphParams, routeId, directionId, stat = 'median') {

  const [timeStr, dateStr] = getTimeStrAndDateStr(graphParams);

  const tripTimes = tripTimesCache[dateStr + timeStr + stat];

  if (!tripTimes) {
    return null;
  }

  const routeTripTimes = tripTimes.routes[routeId];
  if (!routeTripTimes) {
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
export function getTripTimesFromStop(tripTimesCache, graphParams, routeId, directionId, startStopId, stat = 'median')
{
  const directionTripTimes = getTripTimesForDirection(tripTimesCache, graphParams, routeId, directionId);
  if (!directionTripTimes)
  {
    return null;
  }
  const tripTimeValues = directionTripTimes[startStopId];

  if (stat === 'median') // using the median stat group (see getStatPath)
  {
    return tripTimeValues;
  }
  if (stat === 'p10') // using the p10-median-p90 stat group (see getStatPath)
  {
    return getTripTimeStat(tripTimeValues, 0);
  }
  if (stat === 'p90') // using the p10-median-p90 stat group (see getStatPath)
  {
    return getTripTimeStat(tripTimeValues, 2);
  }
}

/**
 * Pulls a data series from a collection by index.
 */
function getTripTimeStat(tripTimeValues, index)
{
  if (!tripTimeValues)
  {
    return null;
  }

  const statValues = {};
  for (let endStopId in tripTimeValues)
  {
    statValues[endStopId] = tripTimeValues[endStopId][index];
  }
  return statValues;
}

/**
 * Maps the given stat to a stat group (part of the file path).  Example stat groups are
 * "median" and "p10-median-p90".  When fetching an individual stat, this function returns
 * which group should be used, favoring more compact groups over larger ones.
 *
 * @param stat
 */
export function getStatPath(stat)
{
    switch (stat)
    {
        case 'median':
            return 'median';
        case 'p10':
        case 'p90':
            return 'p10-median-p90';
        default:
            throw new Error('unknown stat ' + stat);
    }
}

/**
 * Utility method to pull time and date out of graphParams as strings
 */
export function getTimeStrAndDateStr(graphParams) {
  let timeStr = graphParams.start_time ? graphParams.start_time + '-' + graphParams.end_time : '';
  let dateStr = graphParams.date;
  return [timeStr, dateStr];
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
export function getWaitTimeForDirection(waitTimesCache, graphParams, routeId, directionId, stat = 'median') {

  const [timeStr, dateStr] = getTimeStrAndDateStr(graphParams);

  let waitTimes = waitTimesCache[dateStr + timeStr + stat];

  if (!waitTimes) {
    return null;
  }

  let routeWaitTimes = waitTimes.routes[routeId];
  if (!routeWaitTimes)
  {
      return null;
  }

  let directionWaitTimes = routeWaitTimes[directionId];
  if (!directionWaitTimes)
  {
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
export function getAverageOfMedianWait(waitTimesCache, graphParams, route) {
  const directions = route.directions;
  const sumOfMedians = directions.reduce((total, direction) => {
    const waitForDir = getWaitTimeForDirection(waitTimesCache, graphParams, route.id, direction.id);
    if (!waitForDir) {
        return NaN;
    }
    return total + waitForDir.median;
  }, 0);
  return sumOfMedians/directions.length;
}

/*
async function getWaitTimeAtStop(routeId, directionId, stopId, dateStr, timeStr, stat)
{
    let waitTimes = waitTimesCache[dateStr + timeStr + stat];

    if (!waitTimes)
    {
        var timePath = getTimePath(timeStr);
        let statPath = getStatPath(stat);

        let s3Url = 'https://opentransit-precomputed-stats.s3.amazonaws.com/wait-times/v1/sf-muni/'+
            dateStr.replace(/\-/g, '/')+
            '/wait-times_v1_sf-muni_'+dateStr+'_'+statPath+timePath+'.json.gz?v2';

        //console.log(s3Url);

        waitTimes = waitTimesCache[dateStr + timeStr + stat] = await loadJson(s3Url).catch(function(e) {
            sendError("error loading wait times: " + e);
            throw e;
        });
    }

    let routeWaitTimes = waitTimes.routes[routeId];
    if (!routeWaitTimes)
    {
        return null;
    }

    let directionWaitTimes = routeWaitTimes[directionId];
    if (!directionWaitTimes)
    {
        return null;
    }
    let waitTimeValues = directionWaitTimes[stopId];

    if (stat === 'median')
    {
        return waitTimeValues;
    }
    if (stat === 'p10')
    {
        return waitTimeValues ? waitTimeValues[0] : null;
    }
    if (stat === 'p90')
    {
        return waitTimeValues ? waitTimeValues[2] : null;
    }
}
*/