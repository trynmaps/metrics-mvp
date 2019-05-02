import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer, Marker, Popup } from 'react-leaflet';

class MapStops extends Component {
  constructor() {
    super();
    this.state = {
      lat: 37.7793, 
      lng: -122.4193,
      zoom: 13,
    };
  }

  handleRouteSelect = route => {

  }
  render() {
    const position = [this.state.lat, this.state.lng];
    const mapClass = {width:'400px', height:'400px'};
    return (
      <Map center={position} zoom={this.state.zoom} style={mapClass}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url='http://{s}.tile.osm.org/{z}/{x}/{y}.png'
        />
        <Marker position={position}>
          <Popup>
            <span>A pretty CSS3 popup. <br/> Easily customizable.</span>
          </Popup>
        </Marker>
      </Map>
    );
}
}
const mapStateToProps = state => {
	return {
        catFactsAndPicsProps: state.routes.routes
    };
}
export default connect(mapStateToProps,null)(MapStops);