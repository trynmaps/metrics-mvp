/**
 * Functions taken from the isochrone branch.
 *
 * Fetching of the precomputed wait/trip time json is done using Redux.
 * getTripTimesFromStop and getWaitTimeAtStop is commented out but left here for usage reference.
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
 *
 * @param routeId
 * @param directionId
 * @param startStopId
 * @param dateStr  "2019-07-02"
 * @param timeStr  "0700-1900" or empty string (values from time picker)
 * @param stat     "median"
 * @returns
 */
/* async function getTripTimesFromStop(routeId, directionId, startStopId, dateStr, timeStr, stat)
{
    let tripTimes = tripTimesCache[dateStr + timeStr + stat];

    if (!tripTimes)
    {
        let timePath = getTimePath(timeStr);
        let statPath = getStatPath(stat);

        let s3Url = 'https://opentransit-precomputed-stats.s3.amazonaws.com/trip-times/v1/sf-muni/'+
            dateStr.replace(/\-/g, '/')+
            '/trip-times_v1_sf-muni_'+dateStr+'_'+statPath+timePath+'.json.gz?v2';

        tripTimes = tripTimesCache[dateStr + timeStr + stat] = await loadJson(s3Url).catch(function(e) {
            sendError("error loading trip times: " + e);
            throw e;
        });
    }

    let routeTripTimes = tripTimes.routes[routeId];
    if (!routeTripTimes)
    {
        return null;
    }
    let directionTripTimes = routeTripTimes[directionId];
    if (!directionTripTimes)
    {
        return null;
    }
    let tripTimeValues = directionTripTimes[startStopId];

    if (stat === 'median')
    {
        return tripTimeValues;
    }
    if (stat === 'p10')
    {
        return getTripTimeStat(tripTimeValues, 0);
    }
    if (stat === 'p90')
    {
        return getTripTimeStat(tripTimeValues, 2);
    }
}
*/

function getTripTimeStat(tripTimeValues, index) {
  if (!tripTimeValues) {
    return null;
  }

  const statValues = {};
  for (const endStopId in tripTimeValues) {
    statValues[endStopId] = tripTimeValues[endStopId][index];
  }
  return statValues;
}

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
