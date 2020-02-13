import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer, Marker, Tooltip, Polyline } from 'react-leaflet';
import * as d3 from 'd3';
import L from 'leaflet';
import Control from 'react-leaflet-control';
import StartStopIcon from '@material-ui/icons/DirectionsTransit';
import EndStopIcon from '@material-ui/icons/Flag';
import { withTheme } from '@material-ui/core/styles';
import { ThemeProvider } from '@material-ui/styles';
import ReactDOMServer from 'react-dom/server';
import { handleGraphParams } from '../actions';
import { getTripPoints, getDistanceInMiles } from '../helpers/mapGeometry';
import { Agencies } from '../config';

class MapStops extends Component {
  constructor(props) {
    super(props);

    this.agency = Agencies[0];

    this.state = {
      height: this.computeHeight(),
    };
  }

  componentDidMount() {
    this.boundUpdate = this.updateDimensions.bind(this);
    window.addEventListener('resize', this.boundUpdate);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions.bind(this));
  }

  /**
   * Helper method that draws one stop with svg graphics and/or Material UI icons.
   *
   * @param {Object} stop The stop info object for this stop.
   * @param {Object} currentPosition Coordinates for this stop.
   * @param {Number} rotation Number of degrees to rotate to point in the direction of travel.
   * @param {Function} onClickHandler Method for handling mouse clicks.
   * @param {Object} tooltip The react-leaflet Tooltip for this stop.
   * @returns {Object} The react-leaflet Marker.
   */
  populateStop = (
    stop,
    IconType,
    currentPosition,
    rotation,
    onClickHandler,
    tooltip,
  ) => {
    let icon = null;
    const stopColor = this.props.theme.palette.primary;

    if (IconType) {
      // Given an IconType indicates start or end stop.  This is a white circle with a black icon,
      // followed by the title of the stop.

      icon = L.divIcon({
        className: 'custom-icon', // this is needed to turn off the default icon styling (blank square)
        iconSize: [240, 24],
        iconAnchor: [12, 12], // centers icon over position, with text to the right
        html:
          `${`<svg width="24" height="24" viewBox="-10 -10 10 10">` +
            // this is a larger white circle

            `<circle cx="-5" cy="-5" r="4.5" fill="white" stroke="${stopColor.main}" stroke-width="0.75"/>` +
            // This is the passed in icon, which we ask React to render as html (becomes an svg object)
            // We need to pass in our custom theme here, or else the page will get the default theme css
            // injected into page, conflicting with our custom theme.

            `</svg><div style="position:relative; top: -26px; left:2px">`}
              ${ReactDOMServer.renderToString(
                <ThemeProvider theme={this.props.theme}>
                  <IconType color="primary" fontSize="small" />
                </ThemeProvider>,
              )}
          </div>` +
          // this is the stop title with a text shadow to outline it in white

          `<div style="position:relative; top:-50px; left:25px; font-weight:bold; color:${stopColor.main}; ` +
          `text-shadow: -1px 1px 0 #fff,` +
          `1px 1px 0 #fff,` +
          `1px -1px 0 #fff,` +
          `-1px -1px 0 #fff;">${stop.title}</div>`,
      });
    } else {
      // If not given an IconType, this is just a regular stop.  This is a white circle with an
      // svg "v" shape rotated by the given rotation value.

      icon = L.divIcon({
        className: `id${stop.id}`, // this is needed to turn off the default icon styling (blank square)
        iconSize: [20, 20],
        iconAnchor: [10, 10], // centers icon over position, with text to the right
        html:
          `<svg opacity="0.7" viewBox="-10 -10 10 10"><g transform="rotate(${rotation} -5 -5)">` +
          // First we draw a white circle
          `<circle cx="-5" cy="-5" r="3" fill="white" stroke="${stopColor.dark}" stroke-width="0.5"/>` +
          // Then the "v" shape point to zero degrees (east).  The entire parent svg is rotated.
          `<polyline points="-5.5,-6 -4,-5 -5.5,-4" stroke-linecap="round" stroke-linejoin="round"
            stroke="${stopColor.dark}" stroke-width="0.6" fill="none"/>` +
          `</g>` +
          `</svg>`,
      });
    }

    return (
      <Marker
        key={`${stop.id}-marker`}
        position={currentPosition}
        icon={icon}
        onClick={e => {
          e.sourceTarget.closeTooltip();
          onClickHandler();
        }}
      >
        {tooltip}
      </Marker>
    );
  };

  /**
   * Computes angle in degrees from one point towards another
   * @param {Object} fromPoint latLng of starting point
   * @param {Object} toPoint latLng of ending point
   * @returns {Number} The angle in degrees (where 0 is east, 90 is south)
   */
  angleFromTo = (fromPoint, toPoint) => {
    const deltaX = toPoint.lon - fromPoint.lon;
    // Note that y is reversed due to latitude's postive direction being reverse of screen y
    const deltaY = fromPoint.lat - toPoint.lat;
    const rotation = Math.round((Math.atan2(deltaY, deltaX) * 180) / Math.PI);
    return rotation;
  };

  /**
   * Draws all the stops in a given direction.
   * @param {Array} routeStops Collection of route stops grouped by direction id
   * @param {String} directionId The direction to render
   * @param {Object} direction The direction info for the given direction
   * @returns {Array} Array of Leaflet Marker objects
   */
  populateStops = (routeInfo, direction) => {
    const stopIds = direction.stops;
    const directionId = direction.id;

    return stopIds.map(stopId => {
      const stop = routeInfo.stops[stopId];

      const currentPosition = [stop.lat, stop.lon];
      const isStart = stopId === this.props.graphParams.startStopId;
      const isEnd = stopId === this.props.graphParams.endStopId;

      const onClickHandler = () => this.handleStopSelect(stop, directionId);
      const tooltip = (
        <Tooltip>
          {stop.title}
          <br />
          {direction.title}
        </Tooltip>
      );

      let IconType = null;
      if (isStart) {
        IconType = StartStopIcon;
      } else if (isEnd) {
        IconType = EndStopIcon;
      }

      // The direction of travel for a stop is from the GTFS shape point just before
      // this stop (represented by after_index) to the next shape point. Edge cases
      // at the beginning and end of a route seem to work out (probably because of
      // extra coords points representing the terminals).

      let rotation = 0;
      const stopGeometry = direction.stop_geometry[stop.id];
      if (stopGeometry) {
        const previousPoint = direction.coords[stopGeometry.after_index];
        const nextPoint = direction.coords[stopGeometry.after_index + 1];
        rotation = this.angleFromTo(previousPoint, nextPoint);
      }

      const icon = this.populateStop(
        stop,
        IconType,
        currentPosition,
        rotation,
        onClickHandler,
        tooltip,
      );
      return icon;
    });
  };

  // plot speed along a route

  populateSpeed = (routeInfo, direction) => {
    const directionId = direction.id;
    const stopIds = direction.stops;
    const polylines = [];

    const graphParams = this.props.graphParams;

    const numSegments = direction.loop ? stopIds.length : stopIds.length - 1;

    const startStopIndex = graphParams.startStopId
      ? stopIds.indexOf(graphParams.startStopId)
      : -1;
    const endStopIndex = graphParams.endStopId
      ? stopIds.indexOf(graphParams.endStopId)
      : -1;

    for (let i = 0; i < numSegments; i++) {
      const segmentStartStopId = stopIds[i];
      const segmentEndStopId = stopIds[(i + 1) % stopIds.length];

      // const segmentStartStop = routeInfo.stops[segmentStartStopId];
      const segmentEndStop = routeInfo.stops[segmentEndStopId];

      const speed = this.getSpeed(
        routeInfo,
        direction,
        segmentStartStopId,
        segmentEndStopId,
      );

      let color = 'white';
      let weight = 12;

      // If this is the start stop or a subsequent stop before the end stop,
      // use a different color to highlight the selected range of stops.

      if (startStopIndex !== -1 && endStopIndex !== -1) {
        if (
          direction.loop && startStopIndex >= endStopIndex
            ? i >= startStopIndex || i < endStopIndex
            : i >= startStopIndex && i < endStopIndex
        ) {
          color = this.props.theme.palette.primary.main;
          weight = 14;
        }
      }

      const tripPoints = getTripPoints(
        routeInfo,
        direction,
        segmentStartStopId,
        segmentEndStopId,
      );

      // draw a wide polyline as a background for the speed polyline

      polylines.push(
        <Polyline
          key={`poly-speed-white-${directionId}-${segmentStartStopId}`}
          positions={tripPoints}
          color={color}
          opacity={1}
          weight={weight}
        ></Polyline>,
      );

      // then the speed polyline on top of the white polyline

      polylines.push(
        <Polyline
          key={`poly-speed-${directionId}-${segmentStartStopId}`}
          positions={tripPoints}
          color={speed < 0 ? 'white' : this.speedColor(speed)}
          opacity={1}
          weight={7}
          onClick={e => {
            // when this segment is clicked, plot only the stops for this route/dir by setting the first stop

            e.originalEvent.view.L.DomEvent.stopPropagation(e);

            /* TODO: decide if clicking on segments changes the stop selection.  Right now no, because
             * the stop markers are fairly prominent at the moment.  If we make them smaller, then
             * reconsider. */
          }}
        >
          <Tooltip>
            {speed < 0 ? '?' : speed.toFixed(1)} mph to {segmentEndStop.title}
          </Tooltip>
        </Polyline>,
      );
    } // end for
    return polylines;
  };

  getSpeed = (routeInfo, direction, firstStopId, nextStopId) => {
    const segmentMetricsMap = this.props.segmentMetricsMap;

    const directionMetrics = segmentMetricsMap
      ? segmentMetricsMap[direction.id]
      : null;

    const segmentMetrics = directionMetrics
      ? directionMetrics[firstStopId]
      : null;

    if (!segmentMetrics || segmentMetrics.toStopId !== nextStopId) {
      return -1;
    }

    const time = segmentMetrics.medianTripTime;

    const distance = getDistanceInMiles(
      routeInfo,
      direction,
      firstStopId,
      nextStopId,
    );

    return time > 0 ? (distance / time) * 60 : -1; // miles per minute -> mph
  };

  SpeedLegend = () => {
    const speedColorValues = [2.5, 6.25, 8.75, 12.5]; // representative values for quantizing
    // center of scale is 7.5 with quartile boundaries at 5 and 10.

    const speedColorLabels = [' < 5', '5-7.5', '7.5-10', '10+'];

    const items = speedColorValues.map(speedColorValue => {
      return (
        <div key={speedColorValue}>
          <i
            style={{
              backgroundColor: this.speedColor(speedColorValue),
              width: 18,
              float: 'left',
            }}
          >
            &nbsp;
          </i>{' '}
          &nbsp;
          {speedColorLabels[speedColorValues.indexOf(speedColorValue)]}
        </div>
      );
    });

    return (
      <Control position="bottomright">
        <div
          style={{
            backgroundColor: 'white',
            padding: '5px',
            opacity: 0.9,
            borderRadius: '5px',
          }}
        >
          Speed (mph)
          {items}
        </div>
      </Control>
    );
  };

  handleStopSelect = (stop, newDirectionId) => {
    let {
      // eslint-disable-next-line prefer-const
      routeId,
      startStopId,
      endStopId,
      directionId,
    } = this.props.graphParams;

    if (!startStopId) {
      // no first stop set: treat as first stop
      startStopId = stop.id;
      endStopId = null;
      directionId = newDirectionId;
    } else if (!endStopId) {
      if (directionId !== newDirectionId) {
        // new direction: treat as first stop
        startStopId = stop.id;
        endStopId = null;
        directionId = newDirectionId;
      } else {
        // set end stop, swap if needed
        const selectedRoute = this.props.routes.find(
          route => route.id === routeId,
        );
        const dirInfo = selectedRoute.directions.find(
          dir => dir.id === directionId,
        );

        const stopIds = dirInfo.stops;

        if (
          !dirInfo.loop &&
          stopIds.indexOf(stop.id) < stopIds.indexOf(startStopId)
        ) {
          endStopId = startStopId;
          startStopId = stop.id;
        } else {
          // order is correct
          endStopId = stop.id;
        }
      }
    } else {
      // both stops were already set, treat as first stop and clear second (although arguably if same direction could set as end stop)
      startStopId = stop.id;
      endStopId = null;
      directionId = newDirectionId;
    }

    this.props.dispatch({
      type: 'ROUTESCREEN',
      payload: {
        routeId,
        directionId,
        startStopId,
        endStopId,
      },
      query: this.props.query,
    });
  };

  // Make the map full height unless the window is smaller than the sm breakpoint (640px), in which
  // case make the map half height.
  //
  // TODO: Need to convert this component to a functional component.  Then we can use the useTheme
  // hook to programatically access the breakpoint widths.
  //
  // Note: This code has to be adjusted to be kept in sync with the UI layout.
  //

  computeHeight() {
    return window.innerWidth >= 600
      ? window.innerHeight - 48 - 64
      : window.innerHeight * 0.65;
  }

  updateDimensions() {
    const height = this.computeHeight();
    this.setState({ height });
  }

  speedColor(mph) {
    // should this be multiples of walking speed? 3/6/9/12?
    return d3
      .scaleQuantize()
      .domain([2.5, 12.5])
      .range(['#8d1212', '#e60000', '#f07d02', '#84ca50'])(mph);
  }

  render() {
    const { position, zoom, routes, graphParams } = this.props;

    const mapStyle = { width: '100%', height: this.state.height };

    let selectedRoute = null;
    const items = [];

    if (routes && graphParams) {
      selectedRoute = routes.find(route => route.id === graphParams.routeId);

      /*
      const otherRoutes = filterRoutes(routes).map(route => {
        if (route.id != graphParams.routeId) {
            const direction = route.directions[0];
            return <Polyline
                key={`poly-${route.id}-${direction.id}`}
                positions={getTripPoints(route, direction)}
                color="#0177BF"
                opacity={0.2}
                weight={1}
              >
              </Polyline>;
        }
      });

        items.push(otherRoutes);
        */

      if (selectedRoute) {
        selectedRoute.directions.forEach(direction => {
          // plot only the selected direction if we have one, or else all directions

          if (
            !graphParams.directionId ||
            graphParams.directionId === direction.id
          ) {
            // add white lines and speed color lines

            items.push(this.populateStops(selectedRoute, direction));

            // draw stop markers on top of lines for all directions

            items.push(this.populateSpeed(selectedRoute, direction));
          }
        });
      }
    }

    /*
    function getMapInstruction() {
      if (!graphParams.directionId) {
        return 'Select a direction to show stops in that direction.';
      }
      if (!graphParams.startStopId) {
        return 'Select origin and destination stops to show statistics for a particular trip.';
      }
      if (!graphParams.endStopId) {
        return 'Select a destination stop to show statistics for a particular trip.';
      }
      return '';
    }  */

    // const mapInstruction = getMapInstruction();

    return (
      <Map
        center={position || this.agency.initialMapCenter}
        bounds={selectedRoute ? selectedRoute.bounds : null}
        zoom={zoom || this.agency.initialMapZoom}
        style={mapStyle}
      >
        <TileLayer
          attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
          url="https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png"
          opacity={0.6}
        />
        {items}
        <this.SpeedLegend />
      </Map>
    );
  }
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
  routes: state.routes.data,
  segmentMetricsMap: state.routeMetrics.segmentsMap,
  query: state.location.query,
});

const mapDispatchToProps = dispatch => {
  return {
    handleGraphParams: params => dispatch(handleGraphParams(params)),
    dispatch,
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(withTheme(MapStops));
