/**
 * Helper functions for working with routes and stops.  These are used to filter out
 * routes, spurious directions, and idiosyncratic stops when listing and scoring entire routes.
 * 
 * Also includes functions for computing distances between coordinates.
 */

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
    
    "J": {
      directionsToIgnore: ["J____I_D10"] // this is to 23rd and 3rd
    },
    "L": {
      directionsToIgnore: ["L____I_U53"]
    },
    "M": {
      "M____O_D00": {
        ignoreFirstStop: true // Embarcadero & Folsom is not a real stop
      }
    },
    "N": {
      "N____O_F10": {
        ignoreFirstStop: true // 4th and King to 2nd and King trip times are skewed by a few hyperlong trips
      }
    },
    "S": {
      ignoreRoute: true
    },
    "5": {
      "5____I_F00": {
        ignoreFirstStop: 4218 // no data for 3927, and first few stop ids are now different.  Problem is even worse on outbound side, no good fix there.
      }
    },
    "9": {
      "9____I_N00": {
        ignoreFirstStop: 7297 // use Bayshore as actual first stop (daytime)
      },
      "9____O_N00": {
        ignoreLastStop: 7297 // use Bayshore as actual terminal (daytime)
      }
    },
    "24": {
      directionsToIgnore: ["24___I_D10"]
    },
    "90": {
      ignoreRoute: true
    },
    "91": {
      ignoreRoute: true
    },
    "K_OWL": {
      ignoreRoute: true
    },
    "L_OWL": {
      ignoreRoute: true
    },
    "M_OWL": {
      ignoreRoute: true
    },
    "N_OWL": {
      ignoreRoute: true
    },
    "T_OWL": {
      ignoreRoute: true
    },
    "PM": {
      "PM___O_F00": {
        ignoreLastStop: true // long time to Taylor and Bay (probably in holding area)
      },
      "PM___I_F00": {
        ignoreFirstStop: true // 30 minutes from Hyde & Beach to Hyde & North Point
      }
    },
    "PH": {
      "PH___I_F00": {
        ignoreFirstStop: true // 30 minutes from Hyde & Beach to Hyde & North Point
      }
    },
    "C": {
      "C____I_F00": {
        ignoreLastStop: true // long time to California & Drumm (probably in holding area)
      }
    }
  }
}

/**
 * Given an array of routes, return only the routes we want to show.
 */
export function filterRoutes(routes) {
  const heuristics = getRouteHeuristics();
  
  return routes.filter(route => !heuristics[route.id] || !heuristics[route.id].ignoreRoute);
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
  
  return directions.filter(direction => !directionsToIgnore.includes(direction.id));
}

/**
 * Whether the first stop in a direction's stop list should be disregarded.
 * For example, the M outbound lists Embarcadero & Folsom as first stop, but few
 * M's actually go to that stop.  For better end to end calculations, need to disregard
 * the first stop.
 */

export function ignoreFirstStop(routeID, directionID) {
  return ignoreFlag(routeID, directionID, "ignoreFirstStop");
}

export function ignoreLastStop(routeID, directionID) {
  return ignoreFlag(routeID, directionID, "ignoreLastStop");
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
  } else {
    return false;
  }
}


/**
 * Returns the distance between two stops in miles.
 */
export function milesBetween(p1, p2) {
  const meters = haverDistance(p1.lat, p1.lon, p2.lat, p2.lon);
  return meters / 1609.344; 
}

/**
 * Haversine formula for calcuating distance between two coordinates in lat lon
 * from bird eye view; seems to be +- 8 meters difference from geopy distance.
 *
 * From eclipses.py.  Returns distance in meters.
 */
export function haverDistance(latstop,lonstop,latbus,lonbus) {

  const deg2rad = x => x * Math.PI / 180;
   
  [latstop,lonstop,latbus,lonbus] = [latstop,lonstop,latbus,lonbus].map(deg2rad);
  const eradius = 6371000;

  const latdiff = (latbus-latstop);
  const londiff = (lonbus-lonstop);

  const a = Math.sin(latdiff/2)**2 + Math.cos(latstop) * Math.cos(latbus) * Math.sin(londiff/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const distance = eradius * c;
  return distance;
}
