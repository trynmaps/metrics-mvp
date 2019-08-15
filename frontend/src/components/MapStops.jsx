import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer, CircleMarker, Tooltip, Polyline } from 'react-leaflet';
import { handleGraphParams } from '../actions';
import * as d3 from 'd3';
import Control from 'react-leaflet-control';
import { getTripTimesFromStop } from '../helpers/precomputed';
import { getTripPoints, getDistanceInMiles } from '../helpers/mapGeometry';

const RADIUS = 6;
const STOP_COLORS = ['blue', 'red', 'green', 'purple'];
const SF_COORDINATES = { lat: 37.7793, lng: -122.419 };
const ZOOM = 13;

class MapStops extends Component {
  populateRouteDirection = (
    routeStops,
    direction_id,
    color,
    radius,
    direction,
    routeInfo
  ) => {
    let route = null;

    if (routeStops && routeStops[direction_id]) {
      route = routeStops[direction_id].map(stop => {
        const currentPosition = [stop.lat, stop.lon];
        const isStart = stop.sid === this.props.graphParams.start_stop_id;
        const isEnd = stop.sid === this.props.graphParams.end_stop_id;
        return (
          <CircleMarker
            key={stop.sid + '-' + direction_id}
            center={currentPosition}
            color={color}
            opacity={0.5}
            radius={radius}
            fill={true}
            fillColor={isStart ? 'green' : isEnd ? 'red' : 'white'}
            fillOpacity={isStart || isEnd ? 1.0 : 0.5}
            onClick={() => this.handleStopSelect(stop, direction_id)}
          >
            <Tooltip>
              {stop.title}
              <br />
              {direction.title}
            </Tooltip>
          </CircleMarker>
        );
      });
      route.unshift(this.populateSpeed(routeInfo, direction, routeStops, direction_id));
    }
    return route;
  };

  // plot speed along a route

  populateSpeed = (routeInfo, direction, routeStops, direction_id,) => {
    const downstreamStops = routeStops[direction_id];
    let polylines = [];

    for (let i = 0; i < downstreamStops.length - 1; i++) {

      const speed = this.getSpeed(routeInfo, direction, downstreamStops, i, direction_id);

      // draw a wide white polyline as a background for the speed polyline

      polylines.push(
          <Polyline
            key={'poly-speed-white-' + direction_id + '-' + downstreamStops[i].sid}
            positions={ getTripPoints(routeInfo, direction, downstreamStops[i].sid, downstreamStops[i+1].sid) }
            color="white"
            opacity={1}
            weight={10}
          >
          </Polyline>
      );

      // then the speed polyline on top of the white polyline

      polylines.push(
        <Polyline
          key={'poly-speed-' + direction_id + '-' + downstreamStops[i].sid}
          positions={ getTripPoints(routeInfo, direction, downstreamStops[i].sid, downstreamStops[i+1].sid) }
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

  speedColor(mph) {
    // should this be multiples of walking speed? 3/6/9/12?
    return d3
      .scaleQuantize()
      .domain([2.5, 12.5])
      .range(['#9e1313', '#e60000', '#f07d02', '#84ca50'])(mph);
    // return d3.scaleQuantize().domain([0, 4]).range(d3.schemeSpectral[5])(mph/15.0*5);
    // return d3.interpolateRdGy(mph/this.speedMax() /* scale to 0-1 */);
  }

  /**
   * Speed from index to index+1
   * Using haversine distance for now.
   */
  getSpeed = (routeInfo, direction, downstreamStops, index, directionID) => {
    const graphParams = this.props.graphParams;
    const routeID = graphParams.route_id;

    const firstStop = downstreamStops[index];
    const firstStopID = firstStop.sid;
    const nextStop = downstreamStops[index + 1];
    const nextStopID = nextStop.sid;

    const tripTimesFromStop = getTripTimesFromStop(
      this.props.tripTimesCache,
      graphParams,
      routeID,
      directionID,
      firstStopID,
    );

    let time = null;
    if (tripTimesFromStop && tripTimesFromStop[nextStopID]) {
      time = tripTimesFromStop[nextStopID];
    } else {
      return -1; // speed not available;
    }

    const distance = getDistanceInMiles(routeInfo, direction, firstStopID, nextStopID);

    return (distance / time) * 60; // miles per minute -> mph
  };

  SpeedLegend = () => {
    let items = [];

    const speedColorValues = [2.5, 6.25, 8.75, 12.5]; // representative values for quantizing
    // center of scale is 7.5 with quartile boundaries at 5 and 10.

    const speedColorLabels = [' < 5', '5-7.5', '7.5-10', '10+'];

    for (let speedColorValue of speedColorValues) {
      items.push(
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
        </div>,
      );
    }

    return (
      <Control position="bottomright">
        <div
          style={{
            backgroundColor: 'white',
            padding: '5px',
          }}
        >
          {' '}
          Speed (mph)
          {items}
        </div>
      </Control>
    );
  };

  handleStopSelect = (stop, new_direction_id) => {
    let {
      route_id,
      start_stop_id,
      end_stop_id,
      direction_id,
    } = this.props.graphParams;

    if (!start_stop_id) {
      // no first stop set: treat as first stop
      start_stop_id = stop.sid;
      end_stop_id = null;
      direction_id = new_direction_id;
    } else if (!end_stop_id) {
      if (direction_id !== new_direction_id) {
        // new direction: treat as first stop
        start_stop_id = stop.sid;
        end_stop_id = null;
        direction_id = new_direction_id;
      } else {
        // set end stop, swap if needed
        const selectedRoute = this.props.routes.find(
          route => route.id === route_id,
        );
        const stopSids = selectedRoute.directions.find(
          dir => dir.id === direction_id,
        ).stops;

        if (stopSids.indexOf(stop.sid) < stopSids.indexOf(start_stop_id)) {
          end_stop_id = start_stop_id;
          start_stop_id = stop.sid;
        } else {
          // order is correct
          end_stop_id = stop.sid;
        }
      }
    } else {
      // both stops were already set, treat as first stop and clear second (although arguably if same direction could set as end stop)
      start_stop_id = stop.sid;
      end_stop_id = null;
      direction_id = new_direction_id;
    }

    const { onGraphParams } = this.props;
    // for debugging
    //console.log("end state is: start: " + start_stop_id + " end: " + end_stop_id + " dir: " + direction_id);
    onGraphParams({
      start_stop_id: start_stop_id,
      end_stop_id: end_stop_id,
      direction_id: direction_id,
    });
  };

  getStopsInfoInGivenDirection = (selectedRoute, directionId) => {
    const stopSids = selectedRoute.directions.find(
      dir => dir.id === directionId,
    );

    return stopSids.stops.map(stop => {
      let currentStopInfo = { ...selectedRoute.stops[stop] };
      currentStopInfo.sid = stop;
      return currentStopInfo;
    });
  };

  render() {
    const { position, zoom, radius } = this.props;

    const mapClass = { width: '100%', height: '500px' };

    const { routes, graphParams } = this.props;

    let selectedRoute = null;
    let routeStops = null;
    let populatedRoutes = [];

    if (routes && graphParams) {
      selectedRoute = routes.find(route => route.id === graphParams.route_id);

      if (selectedRoute) {
        routeStops = {};
        let index = 0;
        for (let direction of selectedRoute.directions) {
          // plot only the selected direction if we have one, or else all directions

          if (
            !graphParams.direction_id ||
            graphParams.direction_id === direction.id
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
                radius ? radius : RADIUS,
                direction,
                selectedRoute
              ),
            );
          }
          index++; // use a loop keeps the index consistent with direction and also stop color
        }
      }
    }

    return (
      <Map
        center={position || SF_COORDINATES}
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
        {!graphParams.start_stop_id || !graphParams.end_stop_id ?
          <div className='map-instructions'>
            {!graphParams.direction_id ? "Select a direction to see stops in that direction." :
            !graphParams.start_stop_id ? "Click an origin stop." :
            !graphParams.end_stop_id ? "Click a destination stop." : ""}
          </div> : null}
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
