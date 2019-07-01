import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer, CircleMarker, Tooltip, Polyline } from 'react-leaflet';
import { handleGraphParams } from '../actions';

const RADIUS = 6;
const STOP_COLORS = ['blue', 'red', 'green', 'purple'];
const SF_COORDINATES = { lat: 37.7793, lng: -122.419 };
const ZOOM = 13;

class MapStops extends Component {

  populateRouteDirection = (routeStops, direction_id, color, radius, direction) => {

    let route = null;

    if (routeStops && routeStops[direction_id]) {
      route = routeStops[direction_id].map((stop) => {
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
            fill={ true }
            fillColor={isStart ? "green" : (isEnd ? "red" : "white") }
            fillOpacity={ isStart || isEnd ? 1.0 : 0.5 }
            onClick={() => this.handleStopSelect(stop, direction_id)}
          >
            <Tooltip>{stop.title}<br/>{direction.title}</Tooltip>
          </CircleMarker>
        );
      });
      // put polyline first so clickable markers are drawn on top of it
      route.unshift(<Polyline key={'polyline-' + direction_id} color={color} positions={routeStops[direction_id]} opacity={0.5} />);
    }
    return route;
  }
  
  handleStopSelect = (stop, new_direction_id) => {
    let { route_id, start_stop_id, end_stop_id, direction_id} = this.props.graphParams;

    if (!start_stop_id) { // no first stop set: treat as first stop
      start_stop_id = stop.sid;
      end_stop_id = null;
      direction_id = new_direction_id;
    }
    else if (!end_stop_id) {
      if (direction_id !== new_direction_id) { // new direction: treat as first stop
        start_stop_id = stop.sid;
        end_stop_id = null;
        direction_id = new_direction_id;
      }
      else { // set end stop, swap if needed
        const selectedRoute = this.props.routes.find(route => route.id === route_id);        
        const stopSids = selectedRoute.directions.find(dir => dir.id === direction_id).stops;
        
        if (stopSids.indexOf(stop.sid) < stopSids.indexOf(start_stop_id)) {
          end_stop_id = start_stop_id;
          start_stop_id = stop.sid;
        } else { // order is correct
          end_stop_id = stop.sid;
        }
      }
    }
    else { // both stops were already set, treat as first stop and clear second (although arguably if same direction could set as end stop)
       start_stop_id = stop.sid;
       end_stop_id = null;
       direction_id = new_direction_id;
    }
  
    const {onGraphParams} = this.props;
    // for debugging
    //console.log("end state is: start: " + start_stop_id + " end: " + end_stop_id + " dir: " + direction_id);
    onGraphParams({
      start_stop_id: start_stop_id,
      end_stop_id: end_stop_id,
      direction_id: direction_id
    });
  }

  
  getStopsInfoInGivenDirection = (selectedRoute, directionId) => {
      const stopSids = selectedRoute.directions.find(dir => dir.id === directionId);
    
    return stopSids.stops.map(stop => {
      let currentStopInfo = {...selectedRoute.stops[stop]};
      currentStopInfo.sid = stop;
      return currentStopInfo;
    });
  }

  render() {
    const {position, zoom, radius } = this.props;
  
    const mapClass = { width: '100%', height: '500px' };
    
    
    const { routes, graphParams } = this.props;

    let selectedRoute = null;
    let routeStops = null;
    let populatedRoutes = null;

    if (routes && graphParams) {
      selectedRoute = routes.find(route => route.id === graphParams.route_id);

      if (selectedRoute) {
        routeStops = {};
        for (let direction of selectedRoute.directions) {
          routeStops[direction.id] = this.getStopsInfoInGivenDirection(selectedRoute, direction.id);
        }
    
        populatedRoutes = selectedRoute.directions.map((direction, index) =>
          this.populateRouteDirection(routeStops, direction.id, STOP_COLORS[index % STOP_COLORS.length], radius ? radius : RADIUS, direction));
      }
    }

    return (
      <Map center={position || SF_COORDINATES} zoom={zoom || ZOOM} style={mapClass}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="http://tile.stamen.com/toner-lite/{z}/{x}/{y}.png"
          opacity={0.3}
        />
        { populatedRoutes }
        </Map>
        );
      }
    }    
    
const mapStateToProps = state => ({
  graphParams: state.routes.graphParams,
});

const mapDispatchToProps = dispatch => {
  return ({
    onGraphParams: params => dispatch(handleGraphParams(params)),
  })
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(MapStops);
