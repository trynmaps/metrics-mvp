importScripts(
    "https://unpkg.com/kdbush@3.0.0/kdbush.min.js",
    'https://unpkg.com/tinyqueue@2.0.0/tinyqueue.min.js',
    "https://cdn.jsdelivr.net/npm/@turf/turf@5/turf.min.js",
    'common.js?v7'
);

function sendError(err) {
    postMessage({type: 'error', error: err});
};

async function init()
{
    var locations = await loadJson('/locations').catch(function(e) {
        sendError("error loading locations: " + e);
    });

    var index = new KDBush(locations, p => p.lat_lon[0], p => p.lat_lon[1]);

    var MaxWalkRadius = 1800;

    var curComputeId = null;

    onmessage = function(e) {

        var data = e.data;

        if (data && data.action == 'computeIsochrones')
        {
            computeIsochrones(data.latlng, data.maxTripMin, data.routes, data.computeId);
        }
        else
        {
            console.log('Message received from main script');
            console.log(data);
        }

        postMessage({type: 'ok'});
    }

    const deg2rad = x => x * Math.PI / 180;
    const eradius = 6371000;


    function findStopDirectionAndIndex(stopId, routeInfo)
    {
        for (var dirInfo of routeInfo.directions)
        {
            var numStops = dirInfo.stops.length;
            for (var i = 0; i < numStops; i++)
            {
                if (dirInfo.stops[i] == stopId)
                {
                    return {index:i, direction: dirInfo};
                }
            }
        }
        return null;
    }

    function distance(latlon1, latlon2)
    {
        const lat1 = deg2rad(latlon1.lat || latlon1[0]),
            lon1 = deg2rad(latlon1.lon || latlon1.lng || latlon1[1]),
            lat2 = deg2rad(latlon2.lat || latlon2[0]),
            lon2 = deg2rad(latlon2.lon || latlon2.lng || latlon2[1]);

        const latdiff = lat1-lat2;
        const londiff = lon1-lon2;

        const a = Math.sin(latdiff/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(londiff/2)**2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return eradius * c;
    }

    var tripTimes;

    async function getTripTimesFromStop(routeId, directionId, startStopId)
    {
        if (tripTimes == null)
        {
            tripTimes = await loadJson('/trip-times').catch(function(e) {
                sendError("error loading trip times: " + e);
            });
        }

        var routeTripTimes = tripTimes[routeId];
        if (!routeTripTimes)
        {
            return null;
        }
        var directionTripTimes = routeTripTimes[directionId];
        if (!directionTripTimes)
        {
            return null;
        }
        return directionTripTimes[startStopId];
    }

    var waitTimes;

    async function getWaitTimeAtStop(routeId, directionId, stopId)
    {
        if (waitTimes == null)
        {
            waitTimes = await loadJson('/wait-times?v2').catch(function(e) {
                sendError("error loading wait times: " + e);
            });
        }

        var directionTripTimes = waitTimes[directionId];
        if (!directionTripTimes)
        {
            return null;
        }
        return directionTripTimes[stopId];
    }

    function computeIsochrones(latlng, maxTripMin, enabledRoutes, computeId)
    {
        curComputeId = computeId;

        var enabledRoutesMap = {};
        for (var routeId of enabledRoutes)
        {
            enabledRoutesMap[routeId] = true;
        }

        var degLatDist = distance(latlng, [latlng.lat-0.1, latlng.lng])*10;
        var degLonDist = distance(latlng, [latlng.lat, latlng.lng-0.1])*10;

        var queue = new TinyQueue([], function(a, b) {
            return a.tripMin - b.tripMin;
        });

        var reachedLocations = [];
        var addedDirections = {};
        var busMetersPerMinute = 200;

        var numReachedLocations = 0;
        var reachedKeys = {};
        var totalLocations = 0;
        var startTime = new Date().getTime();

        var displayedTripMins = new TinyQueue([]);
        for (var m = 5; m <= maxTripMin; m += 5)
        {
            displayedTripMins.push(m);
        }

        function addNearbyLocations(reachedLocation, radius)
        {
            var latRadius = radius/degLatDist;
            var lonRadius = radius/degLonDist;
            var results = index.range(reachedLocation.lat-latRadius, reachedLocation.lng-lonRadius, reachedLocation.lat+latRadius, reachedLocation.lng+lonRadius).map(id => locations[id]);

            results.forEach(function(loc) {
                var dist = distance(loc.lat_lon, reachedLocation);
                if (dist <= radius)
                {
                    var walkMin = dist / WalkMetersPerMinute;
                    var nextTripMin = reachedLocation.tripMin + walkMin;
                    var nextTripItems = reachedLocation.tripItems.slice();
                    nextTripItems.push({t: walkMin, desc:`walk to ${loc.title}`});
                    //console.log(`can walk to ${loc.title} (${dist.toFixed(0)} m) in ${nextTripMin.toFixed(1)} min`);
                    queue.push({tripMin: nextTripMin, routes:reachedLocation.routes, tripItems: nextTripItems, lat:loc.lat_lon[0], lng: loc.lat_lon[1], loc: loc, title: loc.title, walked: true});
                }
            });
        }

        async function addReachableStopsAfterStop(stopId, routeInfo, reachedLocation)
        {
            var res = findStopDirectionAndIndex(stopId, routeInfo);
            if (res)
            {
                var { direction, index } = res;

                if (addedDirections[direction.id])
                {
                    return;
                }
                addedDirections[direction.id] = true;
                //console.log(`direction ${direction.id}`);

                var stopInfo = routeInfo.stops[stopId];
                var dist = 0;
                var prevStopInfo = stopInfo;

                var tripTimes = await getTripTimesFromStop(routeInfo.id, direction.id, stopId);
                if (!tripTimes)
                {
                    return;
                }

                var waitMin;

                if (!reachedLocation.routes)
                {
                    waitMin = Math.max(1, reachedLocation.tripMin * 0.25);
                }
                else
                {
                    waitMin = await getWaitTimeAtStop(routeInfo.id, direction.id, stopId);
                    if (!waitMin)
                    {
                        return;
                    }
                }

                for (var i = index + 1; i < direction.stops.length; i++)
                {
                    var nextStopId = direction.stops[i];
                    var nextStopInfo = routeInfo.stops[nextStopId];

                    var busMin = tripTimes[nextStopId];
                    if (!busMin || busMin <= 0)
                    {
                        continue;
                    }

                    var nextTripMin = reachedLocation.tripMin + waitMin + busMin;

                    if (nextTripMin <= maxTripMin)
                    {
                        var nextTripItems = reachedLocation.tripItems.slice();

                        nextTripItems.push({t:waitMin, desc:`wait for ${routeInfo.id}`});
                        nextTripItems.push({t:busMin, desc:`take ${routeInfo.id} to ${nextStopInfo.title}`, route: routeInfo.id, direction: direction.id, fromStop: stopId, toStop: nextStopId});

                        var nextRoutes = reachedLocation.routes ? `${reachedLocation.routes}/${routeInfo.id}` : routeInfo.id;

                        //console.log(`will reach ${nextStopId} (${nextStopInfo.title}) (dist=${dist.toFixed(0)}) in ${nextTripMin.toFixed(1)} min`);
                        queue.push({tripMin: nextTripMin, routes: nextRoutes, lat: nextStopInfo.lat, lng: nextStopInfo.lon, title: nextStopInfo.title, tripItems: nextTripItems, walked: false});
                    }
                }
            }
        }

        var lastUnion = null;

        function showReachableLocations(tripMin)
        {
           while (displayedTripMins.length && tripMin >= displayedTripMins.peek() && computeId == curComputeId)
           {
                var displayedTripMin = displayedTripMins.pop();
                var reachableCircles = [];

                var turfCircles = [];

                for (var reachedLocation of reachedLocations)
                {
                    var walkRadius = Math.min(WalkMetersPerMinute * (displayedTripMin - reachedLocation.tripMin), MaxWalkRadius);
                    if (walkRadius > 0)
                    {
                        turfCircles.push(
                            turf.circle([reachedLocation.lng, reachedLocation.lat], walkRadius / 1000, {steps:16})
                        );
                        reachableCircles.push({radius: walkRadius, ...reachedLocation});
                    }
                }

                var union = turf.union.apply(turf, turfCircles);

                var unionDiff = lastUnion ? turf.difference(union, lastUnion) : union;

                lastUnion = union;

                postMessage({type: 'reachableLocations', tripMin: displayedTripMin, computeId: computeId, circles: reachableCircles, geoJson: unionDiff});
           }
        }

        async function processLocations()
        {
            var numProcessed = 0;
            while (true)
            {
                if (computeId != curComputeId) {
                    console.log("compute id changed!");
                    break;
                }

                if (numProcessed++ > 1000) {
                    setTimeout(processLocations, 1); // give onmessage a chance to handle new messages
                    return;
                }

                if (!queue.length || numReachedLocations > 10000) {
                    break;
                }

                totalLocations++;

                var reachedLocation = queue.pop();

                var key = reachedLocation.lat + ',' + reachedLocation.lng;

                if (reachedKeys[key])
                {
                    continue;
                }

                reachedKeys[key] = true;
                numReachedLocations++;

                //console.log(`reached ${reachedLocation.title} in ${reachedLocation.tripMin}`);

                if (reachedLocation.walked)
                {
                    var promises = reachedLocation.loc.stops.map(function(stop) {
                        var routeId = stop.route_id;
                        if (!enabledRoutesMap[routeId])
                        {
                            return null;
                        }

                        return loadRoute(routeId).then(function(routeInfo) {
                            //console.log(`starting from ${stop.id} (${routeInfo.stops[stop.id].title}) on ${stop.route_id}`);
                            return addReachableStopsAfterStop(stop.id, routeInfo, reachedLocation);
                        }).catch(function(e) {
                            sendError('error loading route ' + routeId + ": " + e);
                            throw e;
                        });
                    });

                    await Promise.all(promises);
                }
                else
                {
                    reachedLocations.push(reachedLocation);

                    var tripMin = reachedLocation.tripMin;

                    showReachableLocations(tripMin);

                    var walkRadius = Math.min(WalkMetersPerMinute * (maxTripMin - reachedLocation.tripMin), MaxWalkRadius);

                    if (walkRadius >= 0)
                    {
                        //console.log(reachedLocation);
                        /* console.log(reachedLocation.tripItems.map(function(item) {
                            return item[0].toFixed(1) + ' min: ' + item[1];
                        })); */
                        addNearbyLocations(reachedLocation, walkRadius);
                    }
                }
            }

            showReachableLocations(maxTripMin);

            var endTime = new Date().getTime();
            console.log(`${computeId} done (${numReachedLocations} reached locations, ${totalLocations} processed in ${endTime-startTime} ms)!`);
        }

        queue.push({tripMin: 0, lat: latlng.lat, lng: latlng.lng, routes:null, title: 'initial position', tripItems: [], walked: false});
        processLocations();
    }
}

init();