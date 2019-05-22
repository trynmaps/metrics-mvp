import React, { Component } from 'react';
import { connect } from 'react-redux';
import {
  Map, TileLayer, CircleMarker, Popup, Marker,
} from 'react-leaflet';

const INBOUND_COLOR = 'blue';
const INBOUND_RADIUS = 4;
const OUTBOUND_COLOR = 'red';
const OUTBOUND_RADIUS = 4;
const SF_COORDINATES = {lat : 37.7793, lng: -122.419};
const ZOOM = 13;

class MapStops extends Component {

  handleRouteSelect = (route) => {

  }

  render() {
    const { position, zoom, inboundColor, inboundRadius, outboundColor, outboundRadius } = this.props;

    const mapClass = { width: '500px', height: '500px' };
    const { routeStops } = this.props;
    return (
        <div>
      <Map center={position || SF_COORDINATES} zoom={zoom || ZOOM} style={mapClass}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="http://{s}.tile.osm.org/{z}/{x}/{y}.png"
        />
        {routeStops ? routeStops.Inbound.map((stop) => {
          const currentPosition = [stop.lat, stop.lon];
          return (
            <CircleMarker
              center={currentPosition}
              color={inboundColor || INBOUND_COLOR}
              radius={inboundRadius || INBOUND_RADIUS}
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
                color={outboundColor || OUTBOUND_COLOR}
                radius={outboundRadius || OUTBOUND_RADIUS}
              />
            );
          }) : null
        }


      </Map>
          </div>
    );
  }
}
const mapStateToProps = state => ({
  routeStops: state.routes.routeStops,
});
export default connect(mapStateToProps, null)(MapStops);
