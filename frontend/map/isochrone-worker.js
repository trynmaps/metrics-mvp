importScripts(
    "https://unpkg.com/kdbush@3.0.0/kdbush.min.js",
    'https://unpkg.com/tinyqueue@2.0.0/tinyqueue.min.js',
    "https://cdn.jsdelivr.net/npm/@turf/turf@5/turf.min.js",
    'common.js?v11'
);

let locations;
let index;

const deg2rad = x => x * Math.PI / 180;
const EarthRadius = 6371000;
const MaxWalkRadius = 1800;
const FirstStopMinWaitMinutes = 1.0;
const FirstStopWaitTimeToWalkTimeRatio = 0.25;

let curComputeId = null;
let tripTimesCache = {};
let waitTimesCache = {};

function sendError(err) {
    postMessage({type: 'error', error: err});
};

function findStopDirectionAndIndex(stopId, routeInfo)
{
    for (let dirInfo of routeInfo.directions)
    {
        let numStops = dirInfo.stops.length;
        for (let i = 0; i < numStops; i++)
        {
            if (dirInfo.stops[i] === stopId)
            {
                return {index:i, direction: dirInfo};
            }
        }
    }
    return null;
}

function distance(latlon1, latlon2)
{
    // haversine distance formula
    const lat1 = deg2rad(latlon1.lat || latlon1[0]),
        lon1 = deg2rad(latlon1.lon || latlon1.lng || latlon1[1]),
        lat2 = deg2rad(latlon2.lat || latlon2[0]),
        lon2 = deg2rad(latlon2.lon || latlon2.lng || latlon2[1]);

    const latdiff = lat1-lat2;
    const londiff = lon1-lon2;

    const a = Math.sin(latdiff/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(londiff/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return EarthRadius * c;
}

function getTimePath(timeStr)
{
    return timeStr ? ('_' + timeStr.replace(/:/g,'').replace('-','_').replace(/\+/g,'%2B')) : '';
}

async function getTripTimesFromStop(routeId, directionId, startStopId, dateStr, timeStr, stat)
{
    let tripTimes = tripTimesCache[dateStr + timeStr + stat];

    if (!tripTimes)
    {
        var timePath = getTimePath(timeStr);

        let s3Url = 'https://opentransit-stats.s3.amazonaws.com/trip_times/i1/sf-muni/'+
            dateStr.replace(/\-/g, '/')+
            '/trip_times_i1_sf-muni_'+dateStr+'_'+stat+timePath+'.json.gz?v2';

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
    return directionTripTimes[startStopId];
}

async function getWaitTimeAtStop(routeId, directionId, stopId, dateStr, timeStr, stat)
{
    let waitTimes = waitTimesCache[dateStr + timeStr + stat];

    if (!waitTimes)
    {
        var timePath = getTimePath(timeStr);

        let s3Url = 'https://opentransit-stats.s3.amazonaws.com/wait_times/w1/sf-muni/'+
            dateStr.replace(/\-/g, '/')+
            '/wait_times_w1_sf-muni_'+dateStr+'_median'+timePath+'.json.gz?v2';

        console.log(s3Url);

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
    return directionWaitTimes[stopId];
}

function computeIsochrones(latlng, tripMins, enabledRoutes, dateStr, timeStr, stat, computeId)
{
    curComputeId = computeId;

    let enabledRoutesMap = {};
    for (let routeId of enabledRoutes)
    {
        enabledRoutesMap[routeId] = true;
    }

    // Get approximate distance in meters for 1 degree change in latitude/longitude
    // so that addNearbyLocations can convert a radius in meters to approximate delta latitude/longitude
    // to search the KDBush index for stop locations within the bounding box.
    // For longitude, this is only approximate since a delta of 1 degree longitude is not a fixed distance,
    // but it does not vary much over the size of a city (up to 0.2% within SF depending on latitude)
    let degLatDist = distance(latlng, [latlng.lat-0.1, latlng.lng])*10;
    let degLonDist = distance(latlng, [latlng.lat, latlng.lng-0.1])*10;

    let queue = new TinyQueue([], function(a, b) {
        return a.tripMin - b.tripMin;
    });

    let drawableLocations = [];
    let numReachedLocations = 0;
    let totalLocations = 0;
    let startTime = new Date().getTime();
    let maxTripMin = tripMins[tripMins.length - 1];
    let displayedTripMins = new TinyQueue(tripMins);

    let reachedIds = {}; // map of location id => true (set when location dequeued)
    let bestTripMins = {}; // map of location id => best trip min enqueued so far (set when location enqueued)

    function addNearbyLocations(reachedLocation, radius)
    {
        let latRadius = radius/degLatDist;
        let lonRadius = radius/degLonDist;
        let results = index.range(reachedLocation.lat-latRadius, reachedLocation.lng-lonRadius, reachedLocation.lat+latRadius, reachedLocation.lng+lonRadius).map(id => locations[id]);

        for (loc of results)
        {
            let locId = loc.id;
            if (reachedIds[locId])
            {
                continue;
            }

            let latlon = loc.lat_lon;
            let dist = distance(latlon, reachedLocation);
            if (dist <= radius)
            {
                let walkMin = dist / WalkMetersPerMinute;
                let nextTripMin = reachedLocation.tripMin + walkMin;

                if (bestTripMins[locId] < nextTripMin)
                {
                    continue;
                }
                bestTripMins[locId] = nextTripMin;

                let nextTripItems = reachedLocation.tripItems.slice();

                nextTripItems.push({t: walkMin, desc:`walk to ${loc.title}`});

                //console.log(`can walk to ${loc.id} ${loc.title} (${dist.toFixed(0)} m) in ${nextTripMin.toFixed(1)} min`);
                queue.push({
                    id: locId,
                    tripMin: nextTripMin,
                    routes:reachedLocation.routes,
                    tripItems: nextTripItems,
                    lat: latlon[0],
                    lng: latlon[1],
                    loc: loc,
                    title: loc.title,
                    walked: true
                });
            }
        }
    }

    async function addReachableStopsAfterStop(stopId, routeInfo, reachedLocation)
    {
        let res = findStopDirectionAndIndex(stopId, routeInfo);
        if (res)
        {
            let { direction, index } = res;

            let tripMin = reachedLocation.tripMin;

            let stopInfo = routeInfo.stops[stopId];

            let waitMin = await getWaitTimeAtStop(routeInfo.id, direction.id, stopId, dateStr, timeStr, stat);
            if (!waitMin)
            {
                return;
            }

            /* if (!reachedLocation.routes)
            {
                // assume that person checks predictions before leaving, so if the first stop is close to their initial
                // location, they don't have to wait the average wait time.
                // e.g. if the first stop takes <4 minutes to walk to, they only wait 1 minute even if
                // the bus only comes every 20 minutes and the average wait time is ~10 minutes
                waitMin = Math.min(waitMin,
                    Math.max(FirstStopMinWaitMinutes, tripMin * FirstStopWaitTimeToWalkTimeRatio)
                );
            } */

            let departureMin = tripMin + waitMin;

            let tripTimes = await getTripTimesFromStop(routeInfo.id, direction.id, stopId, dateStr, timeStr, stat);
            if (!tripTimes)
            {
                return;
            }

            let waitItem = {
                t:waitMin,
                desc:`wait for ${routeInfo.id}`
            };

            for (let i = index + 1; i < direction.stops.length; i++)
            {
                let nextStopId = direction.stops[i];
                let nextStopInfo = routeInfo.stops[nextStopId];

                let busMin = tripTimes[nextStopId];
                if (!busMin || busMin <= 0)
                {
                    continue;
                }

                let nextTripMin = departureMin + busMin;

                if (nextTripMin <= maxTripMin)
                {
                    let nextLocId = nextStopInfo.location_id;
                    if (bestTripMins[nextLocId] < nextTripMin)
                    {
                        continue;
                    }
                    bestTripMins[nextLocId] = nextTripMin;

                    let nextTripItems = reachedLocation.tripItems.slice();

                    nextTripItems.push(waitItem);
                    nextTripItems.push({
                        t:busMin,
                        desc:`take ${routeInfo.id} to ${nextStopInfo.title}`,
                        route: routeInfo.id,
                        direction: direction.id,
                        fromStop: stopId,
                        toStop: nextStopId
                    });

                    let nextRoutes = reachedLocation.routes ? `${reachedLocation.routes}/${routeInfo.id}` : routeInfo.id;

                    //console.log(`will reach ${nextStopInfo.location_id} ${nextStopId} (${nextStopInfo.title}) in ${nextTripMin.toFixed(1)} min`);
                    queue.push({
                        id: nextLocId,
                        tripMin: nextTripMin,
                        routes: nextRoutes,
                        lat: nextStopInfo.lat,
                        lng: nextStopInfo.lon,
                        title: nextStopInfo.title,
                        tripItems: nextTripItems
                    });
                }
            }
        }
    }

    let lastUnion = null;

    function showReachableLocations(tripMin)
    {
       while (displayedTripMins.length && tripMin >= displayedTripMins.peek() && computeId === curComputeId)
       {
            let displayedTripMin = displayedTripMins.pop();
            let reachableCircles = [];
            let turfCircles = [];

            for (let reachedLocation of drawableLocations)
            {
                let walkRadius = Math.min(WalkMetersPerMinute * (displayedTripMin - reachedLocation.tripMin), MaxWalkRadius);
                if (walkRadius > 0)
                {
                    turfCircles.push(
                        turf.circle([reachedLocation.lng, reachedLocation.lat], walkRadius / 1000, {steps:16})
                    );
                    reachableCircles.push(Object.assign({radius: walkRadius}, reachedLocation));
                }
            }

            let union = turf.union.apply(turf, turfCircles);

            let unionDiff = lastUnion ? turf.difference(union, lastUnion) : union;

            lastUnion = union;

            postMessage({
                type: 'reachableLocations',
                tripMin: displayedTripMin,
                computeId: computeId,
                circles: reachableCircles,
                geoJson: unionDiff
            });
       }
    }

    async function processLocations()
    {
        // Loop dequeues locations from a priority queue sorted by tripMin.
        // When a location is dequeued, it is considered "reached".
        // (The algorithm will skip that location if it appears again later with a larger tripMin.)
        //
        // There are three types of locations in the queue - locations that the person walks to,
        // locations that the person takes a bus to, and the initial location.
        //
        // If the person walks to a location, for all routes that stop at the location,
        // all subsequent stops along those routes that are reachable within the max
        // trip time are enqueued, with a tripMin that adds the wait time and trip time.
        //
        // If the person took a bus to a location (or if it is the initial location),
        // all other stops within walking distance of that location are enqueued,
        // with a tripMin that adds the walking time.
        //
        // As the algorithm progresses, it compute isochrones whenever it reaches a time specified in
        // the tripMins array, and sends the isochrones to the UI for rendering.

        let numProcessed = 0;
        while (true)
        {
            if (computeId !== curComputeId)
            {
                console.log("compute id changed!");
                return;
            }

            if (numProcessed++ > 1000)
            {
                setTimeout(processLocations, 1); // give onmessage a chance to handle new messages
                return;
            }

            if (!queue.length)
            {
                break;
            }

            totalLocations++;

            let reachedLocation = queue.pop();

            let locId = reachedLocation.id;
            if (reachedIds[locId])
            {
                continue;
            }

            reachedIds[locId] = true;
            numReachedLocations++;

            //console.log(`reached ${reachedLocation.title} in ${reachedLocation.tripMin}`);

            if (reachedLocation.walked)
            {
                let promises = reachedLocation.loc.stops.map(function(stop) {
                    let routeId = stop.route_id;
                    if (!enabledRoutesMap[routeId])
                    {
                        return null;
                    }

                    return loadRoute(routeId)
                        .catch(function(e) {
                            sendError('error loading route ' + routeId + ": " + e);
                            throw e;
                        })
                        .then(function(routeInfo) {
                            //console.log(`starting from ${stop.id} (${routeInfo.stops[stop.id].title}) on ${stop.route_id}`);
                            return addReachableStopsAfterStop(stop.id, routeInfo, reachedLocation);
                        });
                });

                await Promise.all(promises);
            }
            else
            {
                drawableLocations.push(reachedLocation);

                let tripMin = reachedLocation.tripMin;

                showReachableLocations(tripMin);

                let walkRadius = Math.min(WalkMetersPerMinute * (maxTripMin - reachedLocation.tripMin), MaxWalkRadius);

                if (walkRadius >= 0)
                {
                    //console.log(reachedLocation);
                    addNearbyLocations(reachedLocation, walkRadius);
                }
            }
        }

        showReachableLocations(maxTripMin);

        let endTime = new Date().getTime();
        console.log(`${computeId} done (${numReachedLocations} reached locations, ${totalLocations} processed in ${endTime-startTime} ms)!`);
    }

    queue.push({
        id: "_init_",
        tripMin: 0,
        lat: latlng.lat,
        lng: latlng.lng,
        routes:null,
        title: 'initial position',
        tripItems: [],
        walked: false
    });
    processLocations();
}

async function init()
{
    locations = await loadJson('/locations').catch(function(e) {
        sendError("error loading locations: " + e);
        throw e;
    });

    index = new KDBush(locations, p => p.lat_lon[0], p => p.lat_lon[1]);

    onmessage = function(e) {

        let data = e.data;

        if (data && data.action === 'computeIsochrones')
        {
            computeIsochrones(data.latlng, data.tripMins, data.routes, data.dateStr, data.timeStr, data.stat, data.computeId);
        }
        else
        {
            console.log('Message received from main script');
            console.log(data);
        }

        postMessage({type: 'ok'});
    }
}

init();