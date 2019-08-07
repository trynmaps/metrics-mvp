/**
 * Helper functions for plotting on maps.
 */

import { milesBetween, metersToMiles } from './routeCalculations';

/**
 * Gets coordinates that can be consumed by a Leaflet Polyline.  Uses
 * the GTFS stop geometry if possible, otherwise just stop to stop.
 *
 *  @param routeInfo route from nextbus route config list
 *  @param dirInfo direction object from route config
 *  @param fromStop stop id (defaults to first stop)
 *  @param toStop stop id (defaults to last stop)
 */
export function getTripPoints(routeInfo, dirInfo, fromStop=null, toStop=null) {

  if (fromStop === null) {
    fromStop = dirInfo.stops[0];
  }
  if (toStop === null) {
    toStop = dirInfo.stops[dirInfo.stops.length-1];
  }

  let fromStopInfo = routeInfo.stops[fromStop];
  let toStopInfo = routeInfo.stops[toStop];

  let fromStopGeometry = dirInfo.stop_geometry[fromStop];
  let toStopGeometry = dirInfo.stop_geometry[toStop];
  let tripPoints = [];

  if (fromStopGeometry && toStopGeometry)
  {
    tripPoints.push(fromStopInfo);
    for (let i = fromStopGeometry.after_index + 1; i <= toStopGeometry.after_index; i++) {
      tripPoints.push(dirInfo.coords[i]);
    }
    tripPoints.push(toStopInfo);
  }
  else // if unknown geometry, draw straight lines between stops
  {
    let fromStopIndex = dirInfo.stops.indexOf(fromStop);
    let toStopIndex = dirInfo.stops.indexOf(toStop);
    if (fromStopIndex !== -1 && toStopIndex !== -1)
    {
      for (let i = fromStopIndex; i <= toStopIndex; i++)
      {
        let stopInfo = routeInfo.stops[dirInfo.stops[i]];
        tripPoints.push(stopInfo);
      }
    }
  }
  return tripPoints;
}

/**
 * Returns distance in miles between two stops, using GTFS-derived distance along
 * route if available, or else haversine distance.
 *
 *  @param routeInfo route from nextbus route config list
 *  @param dirInfo direction object from route config
 *  @param fromStop stop id (defaults to first stop)
 *  @param toStop stop id (defaults to last stop)
 */
export function getDistanceInMiles(routeInfo, dirInfo, fromStop=null, toStop=null) {

  if (fromStop === null) {
    fromStop = dirInfo.stops[0];
  }
  if (toStop === null) {
    toStop = dirInfo.stops[dirInfo.stops.length-1];
  }

  let fromStopInfo = routeInfo.stops[fromStop];
  let toStopInfo = routeInfo.stops[toStop];

  let fromStopGeometry = dirInfo.stop_geometry[fromStop];
  let toStopGeometry = dirInfo.stop_geometry[toStop];
  let distance = null;;

  if (fromStopGeometry && toStopGeometry) {

    distance = metersToMiles(toStopGeometry.distance - fromStopGeometry.distance);

  } else { // if unknown geometry, draw straight lines between stops

    distance = milesBetween(fromStopInfo, toStopInfo);

  }
  return distance;
}