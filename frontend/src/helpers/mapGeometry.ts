/**
 * Helper functions for plotting on maps.
 */

import * as turf from '@turf/turf';
import { milesBetween, metersToMiles } from './routeCalculations';
import { getAgency } from '../config';

export function getDownstreamStopIds(routeInfo, dirInfo, stopId) {
  const stopsList = dirInfo.stops;
  const secondStopListIndex = stopId ? stopsList.indexOf(stopId) : 0;

  const isLoopRoute = dirInfo.loop;
  const oneWaySecondStopsList = stopsList.slice(secondStopListIndex + 1);

  if (!isLoopRoute) {
    return oneWaySecondStopsList;
  }
  // loop routes display all subsequent stops up to and including origin stop
  return oneWaySecondStopsList.concat(
    stopsList.slice(0, secondStopListIndex + 1),
  );
}

/**
 * Returns an array of stops along the route between two stops, including the endpoints.
 *
 *  @param routeInfo route from nextbus route config list
 *  @param dirInfo direction object from route config
 *  @param fromStop stop id
 *  @param toStop stop id
 */
export function getTripStops(routeInfo, dirInfo, fromStop, toStop) {
  const stopIds = dirInfo.stops;
  const fromStopIndex = stopIds.indexOf(fromStop);
  const toStopIndex = stopIds.indexOf(toStop);
  const tripStops = [];
  if (fromStopIndex !== -1 && toStopIndex !== -1) {
    let startIndex = fromStopIndex;
    if (dirInfo.loop && toStopIndex <= fromStopIndex) {
      for (let i = startIndex; i < stopIds.length; i++) {
        tripStops.push(routeInfo.stops[stopIds[i]]);
      }
      startIndex = 0;
    }

    for (let i = startIndex; i <= toStopIndex; i++) {
      tripStops.push(routeInfo.stops[stopIds[i]]);
    }
  }
  return tripStops;
}

/**
 * Gets coordinates that can be consumed by a Leaflet Polyline.  Uses
 * the GTFS stop geometry if possible, otherwise just stop to stop.
 *
 *  @param routeInfo route from nextbus route config list
 *  @param dirInfo direction object from route config
 *  @param fromStop stop id (defaults to first stop)
 *  @param toStop stop id (defaults to last stop)
 */
export function getTripPoints(
  routeInfo,
  dirInfo,
  fromStop = dirInfo.stops[0],
  toStop = dirInfo.stops[dirInfo.stops.length - 1],
) {
  const fromStopInfo = routeInfo.stops[fromStop];
  const toStopInfo = routeInfo.stops[toStop];

  const fromStopGeometry = dirInfo.stop_geometry[fromStop];
  const toStopGeometry = dirInfo.stop_geometry[toStop];

  if (fromStopGeometry && toStopGeometry) {
    const tripPoints = [];

    tripPoints.push(fromStopInfo);

    const coords = dirInfo.coords;

    let startIndex = fromStopGeometry.after_index + 1;

    if (
      dirInfo.loop &&
      toStopGeometry.after_index <= fromStopGeometry.after_index
    ) {
      for (let i = startIndex; i < coords.length; i++) {
        tripPoints.push(coords[i]);
      }
      startIndex = 0;
    }

    for (let i = startIndex; i <= toStopGeometry.after_index; i++) {
      tripPoints.push(coords[i]);
    }

    tripPoints.push(toStopInfo);
    return tripPoints;
  } // if unknown geometry, draw straight lines between stops

  return getTripStops(routeInfo, dirInfo, fromStop, toStop);
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
export function getDistanceInMiles(
  routeInfo,
  dirInfo,
  fromStop = dirInfo.stops[0],
  toStop = dirInfo.stops[dirInfo.stops.length - 1],
) {
  const fromStopGeometry = dirInfo.stop_geometry[fromStop];
  const toStopGeometry = dirInfo.stop_geometry[toStop];

  if (fromStopGeometry && toStopGeometry) {
    let distance = toStopGeometry.distance - fromStopGeometry.distance;

    if (distance <= 0 && dirInfo.loop) {
      distance += dirInfo.distance;
    }

    return metersToMiles(distance);
  }
  // if unknown geometry, draw straight lines between stops
  const stopIds = dirInfo.stops;
  const stops = routeInfo.stops;
  const fromStopIndex = stopIds.indexOf(fromStop);
  const toStopIndex = stopIds.indexOf(toStop);
  let miles = 0;

  if (fromStopIndex !== -1 && toStopIndex !== -1) {
    let startIndex = fromStopIndex;
    const numStops = stopIds.length;
    if (dirInfo.loop && toStopIndex <= fromStopIndex) {
      for (let i = startIndex; i < numStops; i++) {
        miles += milesBetween(
          stops[stopIds[i]],
          stops[stopIds[(i + 1) % numStops]],
        );
      }
      startIndex = 0;
    }

    for (let i = startIndex; i < toStopIndex; i++) {
      miles += milesBetween(stops[stopIds[i]], stops[stopIds[i + 1]]);
    }
    return miles;
  }
  return null;
}

/**
 * Determines whether a given coordinate is within an agency's service area
 * @param agencyId - ID of agency in the config
 * @param latLng - coordinate as latitude and longitude
 * @returns {boolean} - true if the coordinate is in the service area
 */
export function isInServiceArea(agencyId, latLng) {
  const point = turf.point([latLng.lng, latLng.lat]);

  const serviceArea = getAgency(agencyId).serviceArea;
  if (!serviceArea) {
    return true;
  }

  return serviceArea.features.some(feature => {
    return turf.booleanWithin(point, feature);
  });
}
