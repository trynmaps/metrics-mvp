/**
 * Helper functions for plotting on maps.
 */

import * as turf from '@turf/turf';
import { milesBetween, metersToMiles } from './routeCalculations';
import { ServiceArea } from '../locationConstants';

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
  const tripPoints = [];

  if (fromStopGeometry && toStopGeometry) {
    tripPoints.push(fromStopInfo);
    for (
      let i = fromStopGeometry.after_index + 1;
      i <= toStopGeometry.after_index;
      i++
    ) {
      tripPoints.push(dirInfo.coords[i]);
    }
    tripPoints.push(toStopInfo);
  } // if unknown geometry, draw straight lines between stops
  else {
    const fromStopIndex = dirInfo.stops.indexOf(fromStop);
    const toStopIndex = dirInfo.stops.indexOf(toStop);
    if (fromStopIndex !== -1 && toStopIndex !== -1) {
      for (let i = fromStopIndex; i <= toStopIndex; i++) {
        const stopInfo = routeInfo.stops[dirInfo.stops[i]];
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
export function getDistanceInMiles(
  routeInfo,
  dirInfo,
  fromStop = dirInfo.stops[0],
  toStop = dirInfo.stops[dirInfo.stops.length - 1],
) {
  const fromStopInfo = routeInfo.stops[fromStop];
  const toStopInfo = routeInfo.stops[toStop];

  const fromStopGeometry = dirInfo.stop_geometry[fromStop];
  const toStopGeometry = dirInfo.stop_geometry[toStop];
  let distance = null;

  if (fromStopGeometry && toStopGeometry) {
    distance = metersToMiles(
      toStopGeometry.distance - fromStopGeometry.distance,
    );
  } else {
    // if unknown geometry, draw straight lines between stops

    distance = milesBetween(fromStopInfo, toStopInfo);
  }
  return distance;
}

/**
 * Determines whether a given coordinate is within our service area
 * @param latLng - coordinate as latitude and longitude
 * @returns {boolean} - true if the coordinate is in the service area
 */
export function isInServiceArea(latLng) {
  const point = turf.point([latLng.lng, latLng.lat]);

  return ServiceArea.features.some(feature => {
    return turf.booleanWithin(point, feature);
  });
}

// Clips any geoJson to the service area.
// For all geoJson Features, check each Feature in the ServiceArea.
// If the geoJson feature is completely enclosed in the serviceArea, retain the feature
// If not, clip it.
export function clipGeoJsonToServiceArea(geoJson) {

  const geoJsonFeatures = turf.flatten(geoJson).features;
  var outputGeoJson = {
    "type": "FeatureCollection",
    "features": []
  };

  for (const geo1 of geoJsonFeatures)  {
    for (const geo2 of ServiceArea.features) {

      if (turf.booleanWithin(geo1, geo2)) {
        outputGeoJson.features.push(geo1);
        break;
      }
       else {
        try {
          var result = turf.intersect(geo1, geo2);
          if (result) {
            result.properties = geo1.properties;
            outputGeoJson.features.push(result);
          }
        } catch (TopologyError) {
          outputGeoJson.features.push(geo1);
        }
      }
    }
  }
  return outputGeoJson;
}