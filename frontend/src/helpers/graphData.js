/**
 * Helper functions for working with graph data.
 */

/**
 * Helper method to get a specific percentile out of histogram graph data
 * where percentile is 0-100.
 */
export function getPercentileValue(histogram, percentile) {
  const bin = histogram.percentiles.find(x => x.percentile === percentile);
  if (bin) {
    return bin.value;
  } else {
    return 0;
  }
}

/**
 * Given a histogram bin value like "5-10", return "5".
 */
export function getBinMin(bin) {
  return bin.value.split("-")[0];
}

/**
 * Given a histogram bin value like "5-10", return "10".
 */
export function getBinMax(bin) {
  return bin.value.split("-")[1];
}

/**
 * Returns an object with centralized declarations of "per route" heuristic rules to apply to
 * data when doing systemwide computations.
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
