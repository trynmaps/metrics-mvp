import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import { handleGraphParams } from '../actions';

const INBOUND_COLOR = 'blue';
const INBOUND_RADIUS = 4;
const OUTBOUND_COLOR = 'red';
const OUTBOUND_RADIUS = 4;
const STOP_COLORS = ['blue', 'red', 'green', 'purple'];
const SF_COORDINATES = { lat: 37.7793, lng: -122.419 };
const ZOOM = 13;

class MapStops extends Component {

  constructor() {
    super();
    /*this.state= {
      firstStopId:null,
      secondStopId:null,
      routeDirection: null
    }*/
  }
  
  populateRouteDirection = (routeStops, direction_id, color, radius) => {
    let route = null;
    //const { routeStops } = this.props;
    if (routeStops && routeStops[direction_id]) {
      route = routeStops[direction_id].map((stop) => {
        const currentPosition = [stop.lat, stop.lon];
        return (
          <CircleMarker
            center={currentPosition}
            color={color}
            radius={radius}
            onClick={() => this.handleStopSelect(stop, direction_id)}
            onMouseOver={(e) => e.target.openPopup()}
            onMouseOut={(e) => e.target.closePopup()}
          >
            <Popup>{stop.title}</Popup>
          </CircleMarker>
        );
      });
      // put polyline first so clickable markers are drawn on top of it
      route.unshift(<Polyline color={color} positions={routeStops[direction_id]} />);
    }
    return route;
  }
  
  handleStopSelect = (stop, new_direction_id) => {
    let { start_stop_id, end_stop_id, direction_id} = this.props.graphParams;

    if (!start_stop_id && !end_stop_id) {
      start_stop_id = stop.sid;
      end_stop_id = null;
      direction_id = new_direction_id;
    }
    else if (!end_stop_id) {
      if (direction_id !== new_direction_id) {
        start_stop_id = stop.sid;
        end_stop_id = null;
        direction_id = new_direction_id;
      }
      else {
        end_stop_id = stop.sid;
      }
    }
    else { // both stops were already set, treat as first stop and clear second
       start_stop_id = stop.sid;
       end_stop_id = null;
       direction_id = new_direction_id;
    }
  
    const {onGraphParams} = this.props;
    // for debugging: console.log("end state is: start: " + start_stop_id + " end: " + end_stop_id + " dir: " + direction_id);
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

  /*
  getStopsInfoInGivenDirectionName(selectedRoute, name) {
    const stopSids= selectedRoute.directions.find(dir => dir.name === name);
    return stopSids.stops.map(stop => selectedRoute.stops[stop]);
  }*/
  
  render() {
    const {position, zoom, inboundColor, inboundRadius, outboundColor, outboundRadius } = this.props;
  
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
/*        routeStops = {
          'Inbound'  : this.getStopsInfoInGivenDirectionName(selectedRoute, 'Inbound'),
          'Outbound' : this.getStopsInfoInGivenDirectionName(selectedRoute, 'Outbound') 
         };*/
    
    
    
    
        populatedRoutes = selectedRoute.directions.map((direction, index) =>
          this.populateRouteDirection(routeStops, direction.id, STOP_COLORS[index % STOP_COLORS.length], inboundRadius ? inboundRadius : INBOUND_RADIUS));
      }
    }
    //const inboundRoute = this.populateRouteDirection(routeStops, 'Inbound', inboundColor ? inboundColor : INBOUND_COLOR, inboundRadius ? inboundRadius : INBOUND_RADIUS);
    //const outboundRoute = this.populateRouteDirection(routeStops, 'Outbound', outboundColor ? outboundColor : OUTBOUND_COLOR, outboundRadius ? outboundRadius : OUTBOUND_RADIUS);
    return (
      <Map center={position || SF_COORDINATES} zoom={zoom || ZOOM} style={mapClass}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="http://{s}.tile.osm.org/{z}/{x}/{y}.png"
        />
        { populatedRoutes }
        </Map>
        );
      }
    }    
    
    
    
    
    
/*  
  return (
    <Map
      center={position || SF_COORDINATES}
      zoom={zoom || ZOOM}
      style={mapClass}
    >
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">
          OpenStreetMap
        </a> contributors'
        url="http://{s}.tile.osm.org/{z}/{x}/{y}.png"
      />
      {routeStops
        ? routeStops.Inbound.map(stop => {
            const currentPosition = [stop.lat, stop.lon];
            return (
              <CircleMarker
                center={currentPosition}
                color={inboundColor || INBOUND_COLOR}
                radius={inboundRadius || INBOUND_RADIUS}
              />
            );
          })
        : null}
      {routeStops
        ? routeStops.Outbound.map(stop => {
            const currentPosition = [stop.lat, stop.lon];
            return (
              <CircleMarker
                center={currentPosition}
                color={outboundColor || OUTBOUND_COLOR}
                radius={outboundRadius || OUTBOUND_RADIUS}
              />
            );
          })
        : null}
    </Map>
  );
  }
 
} */

const mapStateToProps = state => ({
  routeStops: state.routes.routeStops,
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
