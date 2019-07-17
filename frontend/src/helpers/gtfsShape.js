  // if we have a route, try to find its shape
  // to do this, convert route id to gtfs route id, and parse the direction to get just the terminal
  // then find a corresponding row in trips.  There are 30k trips so these should be indexed or deduped.
  // any valid trip will give us a shape id (although there can be multiple shapes, like when a route
  // starts out of a yard).
  // finally, search the shapes to get distance along route (use longest shape)


function findGtfsRouteID(route_id, props) {
  // what we call "route_id" is the GTFS route_short_name

  // owl ids in gtfs are like N-OWL, in routes it's N_OWL
  const fixedRouteID = route_id.replace(/_/, "-");

  const routeRecord = props.routeCSVs.find(routeCSV => routeCSV.route_short_name === fixedRouteID);

  if (!routeRecord) {
    return null;
  }
  return routeRecord.route_id;
}

function findTerminal(route_id, direction_id, routes) {
  const route = routes.find(route => route.id === route_id);
  console.log("looking for direction of " + direction_id);
  const directionInfo = route.directions.find(direction => direction.id === direction_id);
  let terminal = directionInfo.title.substr(directionInfo.name.length + " to ".length);

  // some terminals in our config don't match up with current gtfs data

  // TODO: move this to heuristics function.

  const remappingOfTerminal = {
      "17ST AND NOE": "Castro", // F outbound:  in trips.txt for 14358, which is not in routes.txt.  14359 is the F.  As of 6/11 this is no longer in route config, is Castro now.
      "Cow Palace": "Bayshore Boulevard" // 9 outbound: during the day, terminal is bayshore.  See sfmta route description for morning, evening, weekend terminals.
  }

  if (remappingOfTerminal[terminal]) {
    terminal = remappingOfTerminal[terminal];
  }
  return terminal;
}

/**
 * Gets the longest known distance for the selected route and direction.
 * Currently picks longest shape in each direction.  Shorter shapes are usually
 * to/from a yard.
 */
function getRouteDistanceInMeters(props, routeID, directionID, trips, shapes) {
  const gtfsRouteID = findGtfsRouteID(routeID, props);

  if (gtfsRouteID == null) { return 0; }

  const terminal = findTerminal(routeID, directionID, props.routes);
  console.log('found terminal of: ' + terminal);

  // find any shapes with the same route and terminal

  const shapeCandidates = trips.reduce((total, currentValue, currentIndex, arr) => {
    if (currentValue.route_id === gtfsRouteID && currentValue.trip_headsign === terminal) {
      total[currentValue.shape_id] = true;
      return total;
    } else {
      return total;
    }
  }, {});

  //console.log('found shape candidates of: ' + Object.keys(shapeCandidates).toString());

  // find shapes that match this shape id, get largest (some shapes start at a yard in the middle of a route)
  const distByShape = shapes.reduce((total, currentValue, currentIndex, arr) => {
    if (shapeCandidates[currentValue.shape_id] && (!total[currentValue.shape_id] ||
        parseInt(currentValue.shape_dist_traveled) > total[currentValue.shape_id])) {
      total[currentValue.shape_id] = currentValue.shape_dist_traveled;
      return total;
    } else {
      return total;
    }
  }, {});

  console.log('Found distances of: ' + Object.values(distByShape).toString());

  // probably should be using Math.max here
  const maxDist = Object.values(distByShape).reduce((total, currentValue, currentIndex, arr) => {
    if (parseInt(currentValue) > parseInt(total)) { return currentValue} else {
      return total;
    }
  }, 0);
  //console.log('dist in meters is : ' + maxDist);
  return maxDist;
}
