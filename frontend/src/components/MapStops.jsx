import React, { Component } from 'react';
import { connect } from 'react-redux';
import {
  Map, TileLayer, CircleMarker, Popup, Marker,
} from 'react-leaflet';

class MapStops extends Component {
  constructor() {
    super();
    this.state = {
      lat: 37.7793,
      lng: -122.4193,
      zoom: 13,
    };
  }

  handleRouteSelect = (route) => {

  }

  render() {
    const position = [this.state.lat, this.state.lng];
    const mapClass = { width: '400px', height: '400px' };
    const { routeStops } = this.props;
    return (
      <Map center={position} zoom={this.state.zoom} style={mapClass}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="http://{s}.tile.osm.org/{z}/{x}/{y}.png"
        />
        {routeStops ? routeStops.Inbound.map((stop) => {
          const currentPosition = [stop.lat, stop.lon];
          return (
            <CircleMarker
              center={currentPosition}
              color="blue"
              radius={15}
            />
          );
        }) : null
        }
        {
          routeStops ? routeStops.Outbound.map((stop) => {
            const currentPosition = [stop.lat, stop.lon];
            return (
              <CircleMarker
                center={currentPosition}
                color="red"
                radius={15}
              />
            );
          }) : null
        }


      </Map>
    );
  }
}
const mapStateToProps = state => ({
  routeStops: state.routes.routeStops,
});
export default connect(mapStateToProps, null)(MapStops);
