import React, { Component } from 'react';
import { connect } from 'react-redux';
import {
  Map, TileLayer, CircleMarker, Popup, Marker, Polyline
} from 'react-leaflet';
import { updateGraphData } from '../actions'
const INBOUND_COLOR = 'blue';
const INBOUND_RADIUS = 10;
const OUTBOUND_COLOR = 'red';
const OUTBOUND_RADIUS = 10;
const SF_COORDINATES = {lat : 37.7793, lng: -122.419};
const ZOOM = 13;

class MapStops extends Component {

  constructor() {
    super();
    this.state= {
      firstStopId:null,
      secondStopId:null,
      routeDirection: null
    }
  }
  populateRouteDirection = (routeDirection, color, radius) => {
    let route = null;
        const { routeStops } = this.props;
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
  render() {
    const { position, zoom, inboundColor, inboundRadius, outboundColor, outboundRadius } = this.props;

    const mapClass = { width: '500px', height: '500px' };
    const inboundRoute = this.populateRouteDirection('Inbound', inboundColor ? inboundColor : INBOUND_COLOR, inboundRadius ? inboundRadius : INBOUND_RADIUS);
    const outboundRoute = this.populateRouteDirection('Outbound', outboundColor ? outboundColor : OUTBOUND_COLOR, outboundRadius ? outboundRadius : OUTBOUND_RADIUS);
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
const mapDispatchToProps = dispatch => ({
  updateGraphData: (stopData) => dispatch(updateGraphData(stopData)),
});
const mapStateToProps = state => ({
  routeStops: state.routes.routeStops
});
export default connect(mapStateToProps, mapDispatchToProps)(MapStops);