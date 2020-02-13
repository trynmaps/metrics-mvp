import React, { Component, createRef, Fragment } from 'react';
import Button from '@material-ui/core/Button';
import GpsIcon from '@material-ui/icons/GpsFixed';
import { connect } from 'react-redux';
import {
  Map,
  TileLayer,
  CircleMarker,
  Marker,
  Tooltip,
  Polyline,
} from 'react-leaflet';
import L from 'leaflet';
import Control from 'react-leaflet-control';
import * as d3 from 'd3';
import { Snackbar } from '@material-ui/core';
import {
  getDownstreamStopIds,
  getTripPoints,
  isInServiceArea,
} from '../helpers/mapGeometry';
import { filterRoutes, milesBetween } from '../helpers/routeCalculations';
import { handleSpiderMapClick } from '../actions';
import { Agencies } from '../config';

import MapShield from './MapShield';

const CLICK_RADIUS_MI = 0.5; // maximum radius for stops near a point

// Displays alert when an invalid location is set
function ValidLocationAlert(props) {
  return (
    <Snackbar
      message="Location is not in service area"
      open={props.showAlert}
    />
  );
}

class MapSpider extends Component {
  /**
   * A function that returns one of ten colors given a route index.
   * (index modulo 10).
   */
  routeColorOptions = d3.scaleQuantize([0, 9], d3.schemeCategory10);

  constructor(props) {
    super(props);

    // for now, only supports 1 agency at a time.
    // todo: support multiple agencies on one map
    this.agency = Agencies[0];

    this.state = {
      // Should be true by default, so that we don't display the snackbar
      isValidLocation: true,
      height: this.computeHeight(),
    };

    this.routeLayers = [];

    this.mapRef = createRef(); // used for geolocating

    this.handleLocationFound = this.handleLocationFound.bind(this);
  }

  componentDidMount() {
    this.boundUpdate = this.updateDimensions.bind(this);
    window.addEventListener('resize', this.boundUpdate);

    this.updateRouteLayers();
  }

  componentDidUpdate(prevProps) {
    if (this.props.routes !== prevProps.routes) {
      this.updateRouteLayers();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions.bind(this));
  }

  /**
   * Places a Leaflet Marker (blue pin) at the clicked or geolocated map location.
   * Like the isochrone, the marker can be dragged to get new results.
   */
  SpiderOriginMarker = props => {
    let latlng = null;

    return props.spiderLatLng ? (
      <Marker
        position={props.spiderLatLng}
        draggable
        onMove={e => {
          latlng = e.latlng;
        }}
        onMoveEnd={() => {
          this.handleLocationFound({ latlng });
        }}
      />
    ) : null;
  };

  /**
   * Gets color associated with route or one of routeColorOptions
   */

  getLineColor = lineInfo => {
    const lineColor = lineInfo.route.color
      ? `#${lineInfo.route.color}`
      : this.routeColorOptions(lineInfo.routeIndex % 10);

    return lineColor;
  };

  /**
   * Creates a clickable Marker with a custom svg icon (MapShield) for the route
   * represented by lineInfo.
   *
   * https://medium.com/@nikjohn/creating-a-dynamic-jsx-marker-with-react-leaflet-f75fff2ddb9
   */

  generateShield = (lineInfo, waitScaled) => {
    const lastStop =
      lineInfo.downstreamStops[lineInfo.downstreamStops.length - 1];
    const shieldPosition = [lastStop.lat, lastStop.lon];

    const icon = L.divIcon({
      className: 'custom-icon', // this is needed to turn off the default icon styling (blank square)
      html: MapShield({
        waitScaled,
        color: this.getLineColor(lineInfo),
        routeText: lineInfo.route.id,
      }),
    });

    return (
      <Marker
        key={`${lineInfo.route.id}-${lineInfo.direction.id}-Shield`}
        position={shieldPosition}
        icon={icon}
        riseOnHover
        onClick={e => {
          e.originalEvent.view.L.DomEvent.stopPropagation(e);
          this.props.dispatch({
            type: 'ROUTESCREEN',
            payload: {
              routeId: lineInfo.route.id,
              directionId: lineInfo.direction.id,
              startStopId: lineInfo.stop.id,
              endStopId: lastStop.id,
            },
            query: this.props.query,
          });
        }}
      ></Marker>
    );
  };

  /**
   * Rendering of stops nearest to click or current location
   */

  getStartMarkers = () => {
    let items = null;

    /* eslint-disable react/no-array-index-key */

    const nearbyLines = this.props.spiderSelection.nearbyLines;

    if (nearbyLines) {
      items = nearbyLines.map((nearbyLine, index) => {
        const position = [nearbyLine.stop.lat, nearbyLine.stop.lon];

        return (
          <CircleMarker
            key={`startMarker-${index}`}
            center={position}
            radius="8"
            fillColor={this.getLineColor(nearbyLine)}
            fillOpacity={0.2}
            stroke={false}
          >
            <Tooltip>
              {nearbyLine.route.title}
              <br />
              {nearbyLine.direction.title}
              <br />
              {nearbyLine.stop.title}
              <br />
              {nearbyLine.distance.toFixed(1)} mi
            </Tooltip>
          </CircleMarker>
        );
      });
    }
    return items;
  };

  // Rendering of route from nearest stop to terminal.

  DownstreamLines = () => {
    const { spiderSelection } = this.props;
    let items = null;
    if (spiderSelection.latLng) {
      items = spiderSelection.nearbyLines.map(lineInfo => {
        return this.generateLine(lineInfo);
      });
    }
    return <Fragment>{items}</Fragment>;
  };

  generateLine = lineInfo => {
    const downstreamStops = lineInfo.downstreamStops;

    // Add a base polyline connecting the stops.  One polyline between each stop gives better tooltips
    // when selecting a line.

    const statsByRouteId = this.props.statsByRouteId;
    const stats = statsByRouteId[lineInfo.route.id] || {};

    const medianHeadway = stats.medianHeadway;

    let waitScaled = 0;
    if (medianHeadway != null) {
      waitScaled = Math.max((30 - medianHeadway) / 6, 0.5);
    }

    const polylines = [];

    for (let i = 0; i < downstreamStops.length - 1; i++) {
      // for each stop
      polylines.push(this.generatePolyline(lineInfo, waitScaled, i));
    }

    // Add a solid circle at the terminal stop.
    polylines.push(this.generateTerminalCircle(lineInfo, waitScaled));

    // Add a route shield next to the terminal stop.
    polylines.push(this.generateShield(lineInfo, waitScaled));

    return polylines;
  };

  // Creates a circle at the terminal of a route.

  generateTerminalCircle = (lineInfo, waitScaled) => {
    const lastStop =
      lineInfo.downstreamStops[lineInfo.downstreamStops.length - 1];
    const terminalPosition = [lastStop.lat, lastStop.lon];

    return (
      <CircleMarker
        key={`startMarker-${lineInfo.route.id}-terminal-${lastStop.id}`}
        center={terminalPosition}
        radius={3.0 + waitScaled / 2.0}
        fillColor={this.getLineColor(lineInfo)}
        fillOpacity={0.75}
        stroke={false}
      ></CircleMarker>
    );
  };

  // Creates a line between two stops.

  generatePolyline = (lineInfo, waitScaled, i) => {
    const downstreamStops = lineInfo.downstreamStops;

    const computedWeight = waitScaled * 1.5 + 3;

    return (
      <Polyline
        key={`poly-${lineInfo.route.id}-${downstreamStops[i].id}`}
        positions={getTripPoints(
          lineInfo.route,
          lineInfo.direction,
          downstreamStops[i].id,
          downstreamStops[i + 1].id,
        )}
        color={this.getLineColor(lineInfo)}
        opacity={0.5}
        weight={computedWeight}
        onMouseOver={e => {
          // on hover, draw segment wider
          e.target.setStyle({ opacity: 1, weight: computedWeight + 4 });
          return true;
        }}
        onFocus={e => {
          this.onMouseOver(e);
        }}
        onMouseOut={e => {
          e.target.setStyle({ opacity: 0.5, weight: computedWeight });
          return true;
        }}
        onBlur={e => {
          this.onMouseOut(e);
        }}
        // when this route segment is clicked, plot only the stops for this route/dir by setting the first stop
        onClick={e => {
          e.originalEvent.view.L.DomEvent.stopPropagation(e);

          this.props.dispatch({
            type: 'ROUTESCREEN',
            payload: {
              routeId: lineInfo.route.id,
              directionId: lineInfo.direction.id,
              startStopId: lineInfo.stop.id,
              endStopId: downstreamStops[i + 1].id,
            },
            query: this.props.query,
          });
        }}
      >
        <Tooltip>
          {/* should this hover text be a leaflet control in a fixed position? */}
          {lineInfo.route.title}
          <br />
          {lineInfo.direction.title}
          <br />
          {downstreamStops[i + 1].title}
          <br />
        </Tooltip>
      </Polyline>
    );
  };

  /**
   * Geolocation button handler.
   */
  handleGeoLocate = e => {
    e.preventDefault();
    const map = this.mapRef.current;
    if (map != null) {
      map.leafletElement.locate(); // this is for geolocation, see https://leafletjs.com/examples/mobile/
    }
  };

  /**
   * When the map is clicked on, pass the event on to the location handler.
   */
  handleMapClick = e => {
    const map = this.mapRef.current;
    if (map != null) {
      this.handleLocationFound(e);
    }
  };

  updateRouteLayers() {
    if (!this.mapRef.current) {
      return;
    }
    const map = this.mapRef.current.leafletElement;
    const routes = this.props.routes;

    this.routeLayers.forEach(layer => {
      layer.remove();
    });
    this.routeLayers = [];

    if (routes && map) {
      filterRoutes(routes).forEach(route => {
        route.directions.forEach(direction => {
          const routeLayer = L.polyline(getTripPoints(route, direction), {
            color: '#0177BF',
            opacity: 0.2,
            weight: 1.5,
          }).addTo(map);
          this.routeLayers.push(routeLayer);
        });
      });
    }
  }

  updateDimensions() {
    const height = this.computeHeight();
    this.setState({ height });
  }

  /* Make the map full height unless the window is smaller than the sm breakpoint (600px), in which
   * case make the map half height.
   *
   * TODO: Need to convert this component to a functional component.  Then we can use the useTheme
   * hook to programatically access the breakpoint widths.
   *
   * Note: This code has to be adjusted to be kept in sync with the UI layout.
   */

  computeHeight() {
    return window.innerWidth >= 600
      ? window.innerHeight - 48 /* blue app bar */
      : Math.min(window.innerHeight, 500);
  }

  /**
   * Handles events with a location (either click, or geolocation call).
   * Find nearby stops for each route/direction and plot the rest of the route to its terminal.
   */
  handleLocationFound(e) {
    const { latlng } = e;

    // const icon = L.divIcon({
    //   className: 'custom-icon', // this is needed to turn off the default icon styling (blank square)
    //   html: MapShield({
    //     waitScaled,
    //     color: routeColor,
    //     routeText: startMarker.routeId,
    //   }),
    // });
    // Set whether the location is valid
    this.setState({ isValidLocation: isInServiceArea(this.agency.id, latlng) });

    const nearbyLines = this.findNearbyLines(latlng, CLICK_RADIUS_MI);

    // Fire events here indicating that the route list should be filtered to just the
    // routes corresponding to nearbyLines.

    const { onSpiderMapClick } = this.props;
    onSpiderMapClick(nearbyLines, latlng);
  }

  /**
   * Use brute force iteration to find the nearest stop for each direction of each route.
   *
   * Take only stops within maxDistance miles and sort by distance.
   */
  findNearbyLines(latLng, maxDistance) {
    const { routes } = this.props;
    const latLon = { lat: latLng.lat, lon: latLng.lng };
    let nearbyLines = [];

    if (routes) {
      // eslint-disable-next-line no-loop-func
      filterRoutes(routes).forEach((route, i) => {
        if (route.directions) {
          // eslint-disable-next-line no-loop-func
          route.directions.forEach(direction => {
            const nearest = this.findNearestStop(
              latLon,
              direction,
              route,
              maxDistance,
            );
            if (nearest != null) {
              nearest.direction = direction;
              nearest.route = route;
              nearest.routeIndex = i;

              // Add the downstream stops to the terminal.
              const downstreamStopIds = getDownstreamStopIds(
                route,
                nearest.direction,
                nearest.stop.id,
              );
              downstreamStopIds.unshift(nearest.stop.id); // include origin stop

              nearest.downstreamStops = downstreamStopIds.map(stopId => {
                return route.stops[stopId];
              });

              nearbyLines.push(nearest);
            }
          });
        }
      });
    }
    nearbyLines.sort((a, b) => a.distance - b.distance);

    const maxNearbyLines = 20;
    if (nearbyLines.length > maxNearbyLines) {
      nearbyLines = nearbyLines.slice(0, maxNearbyLines);
    }

    return nearbyLines;
  }

  findNearestStop(latLon, direction, route, maxDistance) {
    const stopHash = route.stops;
    let nearest = null;
    direction.stops.forEach(stopId => {
      const stop = stopHash[stopId];
      const distance = milesBetween(latLon, stop);
      if (
        distance <= maxDistance &&
        (nearest == null || distance < nearest.distance)
      ) {
        nearest = { distance, stop };
      }
    });
    return nearest;
  }

  /**
   * Main React render method.
   */
  render() {
    const { position, zoom, spiderSelection } = this.props;
    const { isValidLocation } = this.state;
    const mapStyle = { height: this.state.height };
    const startMarkers = this.getStartMarkers();

    return (
      <div>
        <ValidLocationAlert showAlert={!isValidLocation} />
        <Map
          center={position || this.agency.initialMapCenter}
          zoom={zoom || this.agency.initialMapZoom}
          className="map-fixed-half"
          style={mapStyle}
          minZoom={5}
          maxZoom={18}
          onClick={this.handleMapClick}
          onLocationfound={this.handleLocationFound}
          ref={this.mapRef}
        >
          <TileLayer
            attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
            url="https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png"
            opacity={0.6}
          />
          {/* see http://maps.stamen.com for details */}
          <this.DownstreamLines />
          {startMarkers}
          <this.SpiderOriginMarker spiderLatLng={spiderSelection.latLng} />
          <Control position="topright">
            <div className="map-instructions">
              {spiderSelection.latLng && startMarkers && startMarkers.length
                ? 'Click anywhere along a route to see statistics for trips between the two stops.'
                : 'Click anywhere on the map to see the routes near that point.'}
            </div>
          </Control>
          <Control position="bottomleft">
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={this.handleGeoLocate}
            >
              <GpsIcon />
              &nbsp; Routes near me
            </Button>
            &nbsp;
            {spiderSelection.latLng ? (
              <Button
                variant="contained"
                color="secondary"
                size="small"
                onClick={() => this.props.onSpiderMapClick([], null)}
              >
                Clear map
              </Button>
            ) : null}
            <br />
            <br />
          </Control>
        </Map>
      </div>
    );
  } // end render
} // end class

const mapStateToProps = state => {
  return {
    routes: state.routes.data,
    statsByRouteId: state.agencyMetrics.statsByRouteId,
    graphParams: state.graphParams,
    spiderSelection: state.spiderSelection,
    query: state.location.query,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    onSpiderMapClick: (nearbyLines, latLng) =>
      dispatch(handleSpiderMapClick(nearbyLines, latLng)),
    dispatch,
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(MapSpider);
