import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer, CircleMarker, Tooltip, Polyline } from 'react-leaflet';
import * as d3 from 'd3';
import Control from 'react-leaflet-control';
import { DIRECTION, FROM_STOP, TO_STOP, Path } from '../routeUtil';
import { handleGraphParams } from '../actions';
import { getTripTimesFromStop } from '../helpers/precomputed';
import { getTripPoints, getDistanceInMiles } from '../helpers/mapGeometry';
import { STARTING_COORDINATES } from '../locationConstants';

const RADIUS = 6;
const STOP_COLORS = ['blue', 'red', 'green', 'purple'];
const ZOOM = 13;

class MapStops extends Component {
  constructor(props) {
    super(props);
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

  populateRouteDirection = (
    routeStops,
    directionId,
    color,
    radius,
    direction,
    routeInfo,
  ) => {
    let route = null;

    if (routeStops && routeStops[directionId]) {
      route = routeStops[directionId].map(stop => {
        const currentPosition = [stop.lat, stop.lon];
        const isStart = stop.sid === this.props.graphParams.startStopId;
        const isEnd = stop.sid === this.props.graphParams.endStopId;
        const endFillColor = isEnd ? 'red' : 'white';

        return (
          <CircleMarker
            key={`${stop.sid}-${directionId}`}
            center={currentPosition}
            color={color}
            opacity={0.5}
            radius={radius}
            fill
            fillColor={isStart ? 'green' : endFillColor}
            fillOpacity={isStart || isEnd ? 1.0 : 0.5}
            onClick={() => this.handleStopSelect(stop, directionId)}
          >
            <Tooltip>
              {stop.title}
              <br />
              {direction.title}
            </Tooltip>
          </CircleMarker>
        );
      });
      route.unshift(
        this.populateSpeed(routeInfo, direction, routeStops, directionId),
      );
    }
    return route;
  };

  // plot speed along a route

  populateSpeed = (routeInfo, direction, routeStops, directionId) => {
    const downstreamStops = routeStops[directionId];
    const polylines = [];

    for (let i = 0; i < downstreamStops.length - 1; i++) {
      const speed = this.getSpeed(
        routeInfo,
        direction,
        downstreamStops,
        i,
        directionId,
      );

      // draw a wide white polyline as a background for the speed polyline

      polylines.push(
        <Polyline
          key={`poly-speed-white-${directionId}-${downstreamStops[i].sid}`}
          positions={getTripPoints(
            routeInfo,
            direction,
            downstreamStops[i].sid,
            downstreamStops[i + 1].sid,
          )}
          color="white"
          opacity={1}
          weight={10}
        ></Polyline>,
      );

      // then the speed polyline on top of the white polyline

      polylines.push(
        <Polyline
          key={`poly-speed-${directionId}-${downstreamStops[i].sid}`}
          positions={getTripPoints(
            routeInfo,
            direction,
            downstreamStops[i].sid,
            downstreamStops[i + 1].sid,
          )}
          color={speed < 0 ? 'white' : this.speedColor(speed)}
          opacity={1}
          weight={5}
          onClick={e => {
            // when this segment is clicked, plot only the stops for this route/dir by setting the first stop

            e.originalEvent.view.L.DomEvent.stopPropagation(e);

            /* TODO: decide if clicking on segments changes the stop selection.  Right now no, because
             * the stop markers are fairly prominent at the moment.  If we make them smaller, then
             * reconsider. */
          }}
        >
          <Tooltip>
            {speed < 0 ? '?' : speed.toFixed(1)} mph to{' '}
            {downstreamStops[i + 1].title}
          </Tooltip>
        </Polyline>,
      );
    } // end for
    return polylines;
  };

  /**
   * Speed from index to index+1
   */
  getSpeed = (routeInfo, direction, downstreamStops, index, directionId) => {
    const graphParams = this.props.graphParams;
    const routeId = graphParams.routeId;

    const firstStop = downstreamStops[index];
    const firstStopId = firstStop.sid;
    const nextStop = downstreamStops[index + 1];
    const nextStopId = nextStop.sid;

    const tripTimesFromStop = getTripTimesFromStop(
      this.props.tripTimesCache,
      graphParams,
      routeId,
      directionId,
      firstStopId,
    );

    let time = null;
    if (tripTimesFromStop && tripTimesFromStop[nextStopId]) {
      time = tripTimesFromStop[nextStopId];
    } else {
      return -1; // speed not available;
    }

    const distance = getDistanceInMiles(
      routeInfo,
      direction,
      firstStopId,
      nextStopId,
    );

    return (distance / time) * 60; // miles per minute -> mph
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
      startStopId = stop.sid;
      endStopId = null;
      directionId = newDirectionId;
    } else if (!endStopId) {
      if (directionId !== newDirectionId) {
        // new direction: treat as first stop
        startStopId = stop.sid;
        endStopId = null;
        directionId = newDirectionId;
      } else {
        // set end stop, swap if needed
        const selectedRoute = this.props.routes.find(
          route => route.id === routeId,
        );
        const stopSids = selectedRoute.directions.find(
          dir => dir.id === directionId,
        ).stops;

        if (stopSids.indexOf(stop.sid) < stopSids.indexOf(startStopId)) {
          endStopId = startStopId;
          startStopId = stop.sid;
        } else {
          // order is correct
          endStopId = stop.sid;
        }
      }
    } else {
      // both stops were already set, treat as first stop and clear second (although arguably if same direction could set as end stop)
      startStopId = stop.sid;
      endStopId = null;
      directionId = newDirectionId;
    }
    const path = new Path();
    path.buildPath(DIRECTION, directionId).buildPath(FROM_STOP, startStopId);
    if (endStopId) {
      path.buildPath(TO_STOP, endStopId);
    }
    path.commitPath();
    const { onGraphParams } = this.props;
    // for debugging
    // console.log("end state is: start: " + startStopId + " end: " + endStopId + " dir: " + directionId);
    onGraphParams({
      startStopId,
      endStopId,
      directionId,
    });
  };

  getStopsInfoInGivenDirection = (selectedRoute, directionId) => {
    const stopSids = selectedRoute.directions.find(
      dir => dir.id === directionId,
    );

    return stopSids.stops.map(stop => {
      const currentStopInfo = { ...selectedRoute.stops[stop] };
      currentStopInfo.sid = stop;
      return currentStopInfo;
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
    return (
      (window.innerWidth >= 640 ? window.innerHeight : window.innerHeight / 2) -
      64 /* blue app bar */
    );
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
      .range(['#9e1313', '#e60000', '#f07d02', '#84ca50'])(mph);
    // return d3.scaleQuantize().domain([0, 4]).range(d3.schemeSpectral[5])(mph/15.0*5);
    // return d3.interpolateRdGy(mph/this.speedMax() /* scale to 0-1 */);
  }

  render() {
    const { position, zoom, radius } = this.props;

    const mapClass = { width: '100%', height: this.state.height };

    const { routes, graphParams } = this.props;

    let selectedRoute = null;
    let routeStops = null;
    const populatedRoutes = [];

    if (routes && graphParams) {
      selectedRoute = routes.find(route => route.id === graphParams.routeId);

      if (selectedRoute) {
        routeStops = {};
        selectedRoute.directions.forEach((direction, index) => {
          // plot only the selected direction if we have one, or else all directions

          if (
            !graphParams.directionId ||
            graphParams.directionId === direction.id
          ) {
            routeStops[direction.id] = this.getStopsInfoInGivenDirection(
              selectedRoute,
              direction.id,
            );
            populatedRoutes.push(
              this.populateRouteDirection(
                routeStops,
                direction.id,
                STOP_COLORS[index % STOP_COLORS.length],
                radius || RADIUS,
                direction,
                selectedRoute,
              ),
            );
          }
        });
      }
    }

    let mapInstruction = '';
    if (!graphParams.endStopId) mapInstruction = 'Click a destination stop.';
    else if (!graphParams.startStopId) mapInstruction = 'Click an origin stop.';
    else if (!graphParams.directionId)
      mapInstruction = 'Select a direction to see stops in that direction.';

    return (
      <Map
        center={position || STARTING_COORDINATES}
        bounds={routeStops ? routeStops[selectedRoute.directions[0].id] : null}
        zoom={zoom || ZOOM}
        style={mapClass}
      >
        <TileLayer
          attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
          url="https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png"
          opacity={0.3}
        />
        {populatedRoutes}
        <this.SpeedLegend />
        <Control position="topright">
          {!graphParams.startStopId || !graphParams.endStopId ? (
            <div className="map-instructions">{mapInstruction}</div>
          ) : null}
        </Control>
      </Map>
    );
  }
}

const mapStateToProps = state => ({
  graphParams: state.routes.graphParams,
  tripTimesCache: state.routes.tripTimesCache,
});

const mapDispatchToProps = dispatch => {
  return {
    onGraphParams: params => dispatch(handleGraphParams(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(MapStops);
