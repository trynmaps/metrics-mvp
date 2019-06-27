import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import { handleGraphParams } from '../actions';

const INBOUND_COLOR = 'blue';
const INBOUND_RADIUS = 4;
const OUTBOUND_COLOR = 'red';
const OUTBOUND_RADIUS = 4;
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
  
  populateRouteDirection = (routeStops, routeDirection, color, radius) => {
    let route = null;
    //const { routeStops } = this.props;
    if (routeStops && routeStops[routeDirection]) {
      route = routeStops[routeDirection].map((stop) => {
        const currentPosition = [stop.lat, stop.lon];
        return (
          <CircleMarker
            center={currentPosition}
            color={color}
            radius={radius}
            onClick={() => this.handleStopSelect(stop,routeDirection)}
            onMouseOver={(e) => e.target.openPopup()}
            onMouseOut={(e) => e.target.closePopup()}
          >
            <Popup>{stop.title}</Popup>
          </CircleMarker>
        );
      });
      route.push(<Polyline color={color} positions={routeStops[routeDirection]} />);
    }
    return route;
  }
  
  handleStopSelect = (stop,newRouteDirection) => {
    const {firstStopId, secondStopId, routeDirection} = this.state;
    if(!firstStopId && !secondStopId) {
      this.setState({firstStopId: stop.sid,routeDirection:newRouteDirection}, () => this.afterStopSelect());
    }
    else if(!secondStopId) {
      if(routeDirection !== newRouteDirection) {
        this.setState({firstStopId: stop.sid, secondStopId: null, routeDirection: newRouteDirection}, () => this.afterStopSelect());
      }
      else {
        this.setState({secondStopId: stop.sid, routeDirection: newRouteDirection}, () => this.afterStopSelect());
      }
    }
    else{
       this.setState({firstStopId: stop.sid, secondStopId: null, routeDirection: newRouteDirection}, () => this.afterStopSelect());
    }
  }
  afterStopSelect = () => {
    const {firstStopId, secondStopId, routeDirection} = this.state;
    const {updateStopSelection} = this.props;
    updateStopSelection({firstStopId:firstStopId, secondStopId: secondStopId, routeDirection: routeDirection});
  }
  

  getStopsInfoInGivenDirectionName(selectedRoute, name) {
    const stopSids= selectedRoute.directions.find(dir => dir.name === name);
    return stopSids.stops.map(stop => selectedRoute.stops[stop]);
  }
  
  render() {
    const {position, zoom, inboundColor, inboundRadius, outboundColor, outboundRadius } = this.props;
  
    const mapClass = { width: '100%', height: '500px' };
    
    
    const { routes, graphParams } = this.props;

    let selectedRoute = null;
    let routeStops = null;


    if (routes && graphParams) {
      selectedRoute = routes.find(route => route.id === graphParams.route_id);

      if (selectedRoute) {
        routeStops = {
          'Inbound'  : this.getStopsInfoInGivenDirectionName(selectedRoute, 'Inbound'),
          'Outbound' : this.getStopsInfoInGivenDirectionName(selectedRoute, 'Outbound')
         };
      }
    }
    
    
    
    
    
    const inboundRoute = this.populateRouteDirection(routeStops, 'Inbound', inboundColor ? inboundColor : INBOUND_COLOR, inboundRadius ? inboundRadius : INBOUND_RADIUS);
    const outboundRoute = this.populateRouteDirection(routeStops, 'Outbound', outboundColor ? outboundColor : OUTBOUND_COLOR, outboundRadius ? outboundRadius : OUTBOUND_RADIUS);
    return (
      <Map center={position || SF_COORDINATES} zoom={zoom || ZOOM} style={mapClass}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="http://{s}.tile.osm.org/{z}/{x}/{y}.png"
        />
        { inboundRoute }
        { outboundRoute }
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

export default connect(
  mapStateToProps,
  null,
)(MapStops);
