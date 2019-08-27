import React, { Fragment, Component, createRef } from 'react';
import Button from '@material-ui/core/Button';
import GpsIcon from '@material-ui/icons/GpsFixed'
import { connect } from 'react-redux';
import {
  Map, TileLayer, CircleMarker, Marker,
  Tooltip, Polyline
} from 'react-leaflet';
import L from 'leaflet';
import MapShield from './MapShield'
import Control from 'react-leaflet-control';
import * as d3 from "d3";
import { getAllWaits, filterRoutes, milesBetween } from '../helpers/routeCalculations';
import { handleSpiderMapClick } from '../actions';
import { getTripPoints, isInServiceArea } from '../helpers/mapGeometry';
import { push } from 'redux-first-router'
import { Snackbar } from '@material-ui/core';
import * as PropTypes from 'prop-types';

const SF_COORDINATES = {lat : 37.7793, lng: -122.4193}; // city hall
const ZOOM = 13;
const CLICK_RADIUS_MI = 0.25; // maximum radius for stops near a point


// Displays alert when an invalid location is set
function ValidLocationAlert(props) {
  return <Snackbar
    message={'Location is not in service area'}
    open={props.showAlert}
  />;
}

ValidLocationAlert.propTypes = { showAlert: PropTypes.bool };


class MapSpider extends Component {

  constructor(props) {
    super(props);
    this.state = {
      // Should be true by default, so that we don't display the snackbar
      isValidLocation: true,
    };

    this.mapRef = createRef(); // used for geolocating

    this.handleLocationFound = this.handleLocationFound.bind(this);
  }

  // TODO: Needs optimizing. This sets height to that of the window, not remaining space, which
  // has to be adjusted for by hand.
  updateDimensions() {
    const height = (window.innerWidth >= 992 ? window.innerHeight : 500) - 64 /* blue app bar */;
    this.setState({ height: height })
  }

  componentWillMount() {
    this.updateDimensions()
  }

  componentDidMount() {
    window.addEventListener("resize", this.updateDimensions.bind(this))
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.updateDimensions.bind(this))
  }

  /**
   * Geolocation button handler.
   */
  handleGeoLocate = (e) => {
    e.preventDefault();
    const map = this.mapRef.current;
    if (map != null) {
      map.leafletElement.locate(); // this is for geolocation, see https://leafletjs.com/examples/mobile/
    }
  };

  /**
   * When the map is clicked on, pass the event on to the location handler.
   */
  handleMapClick = (e) => {
    const map = this.mapRef.current
    if (map != null) {
      this.handleLocationFound(e);
    }
  }

  /**
   * Handles events with a location (either click, or geolocation call).
   * Find nearby stops for each route/direction and plot the rest of the route to its terminal.
   */
  handleLocationFound(e) {

    const {latlng} = e;

    // Set whether the location is valid
    this.setState({isValidLocation: isInServiceArea(latlng)});

    const stops = this.findStops(latlng); // note: all lowercase name in event.

    // Add the downstream stops to the terminal.

    for (let stop of stops) {
      this.addDownstreamStops(stop);
    }

    // Fire events here indicating that the route list should be filtered to just the
    // routes corresponding to "stops".

    const {onSpiderMapClick} = this.props;
    onSpiderMapClick(stops, latlng);
  }

  /**
   * Append info about the downstream stops to the given stop object for plotting on the map.
   */
  addDownstreamStops(stop) {
    const selectedRoute = this.props.routes.find(route => route.id === stop.routeID);

    const secondStopInfo = stop.direction;
    const secondStopListIndex = secondStopInfo.stops.indexOf(stop.stopID);

    const secondStopList = secondStopInfo.stops.slice(secondStopListIndex /* + 1  include starting stop */);

    const downstreamStops = secondStopList.map(stopID => Object.assign(selectedRoute.stops[stopID], { stopID: stopID}));
    stop.downstreamStops = downstreamStops;
  }

  /**
   * Use brute force iteration to find the nearest stop for each direction of each route.
   *
   * Take only stops within CLICK_RADIUS_MI miles and sort by distance.
   */
  findStops(latLng) {
    const { routes } = this.props;
    const latLon = { lat: latLng.lat, lon: latLng.lng };
    let stopsByRouteAndDir = [];

    const filteredRoutes = filterRoutes(routes);
    for (let i = 0; i < filteredRoutes.length; i++) { // optimize this on back end
      const route = filteredRoutes[i];

      if (route.directions) {
        for (let direction of route.directions) {
          const stopList = direction.stops;
          const nearest = this.findNearestStop(latLon, stopList, route.stops);
          nearest.routeID = route.id;
          nearest.routeIndex = i;
          nearest.routeTitle = route.title;
          nearest.direction = direction;
          nearest.routeInfo = route;
          stopsByRouteAndDir.push(nearest);
        }
      }
    }
    // truncate by distance (CLICK_RADIUS_MI miles) and then sort

    stopsByRouteAndDir = stopsByRouteAndDir.filter(stop => stop.miles < CLICK_RADIUS_MI);
    stopsByRouteAndDir.sort((a, b) => a.miles - b.miles);

    return stopsByRouteAndDir;
  }


  /**
   * Returns the nearest stop Object to the given latLon coordinates.
   *
   * stopList is an array of strings (stop ids) that are keys into the stopHash,
   * a dictionary of stops (as found in route config objects).
   */
  findNearestStop(latLon, stopList, stopHash) {
    let nearest = { miles: -1,
     stop: null,
     stopID: null,
    }
    for (let stop of stopList) {
      const miles = milesBetween(latLon, stopHash[stop]);
      if (nearest.miles === -1 || miles < nearest.miles) {
        nearest = { miles: miles,
                    stop: stopHash[stop],
                    stopID: stop,
                    }
      }
    }
    return nearest;
  }

  /**
   * A function that returns one of ten colors given a route index.
   * (index modulo 10).
   */
  routeColor = d3.scaleQuantize([0,9], d3.schemeCategory10);

  /**
   * Rendering of stops nearest to click or current location
   */
  getStartMarkers = () => {

    let items = null;

    if (this.props.spiderSelection) {
      items = this.props.spiderSelection.map((startMarker, index) => {

        const position = [ startMarker.stop.lat, startMarker.stop.lon ];
        const routeColor = this.routeColor(startMarker.routeIndex % 10);

        return <CircleMarker key={ "startMarker-" + index } center={position}
            radius="8"
            fillColor={routeColor}
            fillOpacity={0.2}
            stroke={false}
            >
          <Tooltip>
            {startMarker.routeTitle}<br/>
            {startMarker.direction.title}<br/>
            {startMarker.stop.title}<br/>
            {Math.round(startMarker.miles * 5280)} feet
          </Tooltip>
        </CircleMarker>
      });
    }
    return items;
  }

  /**
   * Rendering of route from nearest stop to terminal.
   */
  DownstreamLines = () => {

    const allWaits = getAllWaits(this.props.waitTimesCache, this.props.graphParams, this.props.routes);

    // One polyline for each start marker

    let items = null;

    if (this.props.spiderSelection) {
      items = this.props.spiderSelection.map(startMarker => {
        const downstreamStops = startMarker.downstreamStops;

        const polylines = [];

        // Add a base polyline connecting the stops.  One polyline between each stop gives better tooltips
        // when selecting a line.

        // get wait rank, most frequent is highest (largest) rank
        const waitRank = allWaits.findIndex(wait => wait.routeID === startMarker.routeID);

        // scale wait rank to 0, 1, or 2
        const waitScaled = Math.trunc(waitRank/allWaits.length * 3);

        for (let i=0; i < downstreamStops.length-1; i++) { // for each stop
          polylines.push(this.generatePolyline(startMarker, waitScaled, i));
        }

        // Add a solid circle at the terminal stop.

        polylines.push(this.generateTerminalCircle(startMarker, waitScaled));

        // Add a route shield next to the terminal stop.

        polylines.push(this.generateShield(startMarker, waitScaled));

        return polylines;
      });
    }

    return <Fragment>{items}</Fragment>
  }

  /**
   * Creates a line between two stops.
   */
  generatePolyline = (startMarker, waitScaled, i) => {

    const downstreamStops = startMarker.downstreamStops;

    const computedWeight = waitScaled * 1.5 + 3;

    const routeColor = this.routeColor(startMarker.routeIndex % 10);

    return <Polyline
          key={"poly-" + startMarker.routeID + "-" + downstreamStops[i].stopID}
          positions = { getTripPoints(startMarker.routeInfo, startMarker.direction, downstreamStops[i].stopID, downstreamStops[i+1].stopID) }
          color = { routeColor }
          opacity = { 0.5 }
          weight = { computedWeight }
          onMouseOver = { e => { // on hover, draw segment wider
            e.target.setStyle({opacity:1, weight: computedWeight+4});
            return true;
          }}
          onMouseOut = { e => {
            e.target.setStyle({opacity:0.5, weight:computedWeight});
            return true;
          }}

          // when this route segment is clicked, plot only the stops for this route/dir by setting the first stop

          onClick = {e => {

            e.originalEvent.view.L.DomEvent.stopPropagation(e);

            push(`/route/${startMarker.routeID}/direction/${startMarker.direction.id}/start_stop/${startMarker.stopID}/end_stop/${downstreamStops[i+1].stopID}`);
          }}
        >
          <Tooltip> {/* should this hover text be a leaflet control in a fixed position? */}
           {startMarker.routeTitle}<br/>
           {startMarker.direction.title}<br/>
           {downstreamStops[i+1].title}<br/>
          </Tooltip>
        </Polyline>;
  }


  /**
   * Creates a circle at the terminal of a route.
   */
  generateTerminalCircle = (startMarker, waitScaled) => {

    const lastStop = startMarker.downstreamStops[startMarker.downstreamStops.length - 1];
    const terminalPosition = [ lastStop.lat, lastStop.lon ];
    const routeColor = this.routeColor(startMarker.routeIndex % 10);

    return <CircleMarker key={ "startMarker-" + startMarker.routeID + "-terminal-" + lastStop.stopID }
      center={terminalPosition}
      radius={3.0 + waitScaled/2.0}
      fillColor={routeColor}
      fillOpacity={0.75}
      stroke={false}>
    </CircleMarker>;
  }

  /**
   * Creates a clickable Marker with a custom svg icon (MapShield) for the route
   * represented by startMarker.
   *
   * https://medium.com/@nikjohn/creating-a-dynamic-jsx-marker-with-react-leaflet-f75fff2ddb9
   */
  generateShield = (startMarker, waitScaled) => {

    const lastStop = startMarker.downstreamStops[startMarker.downstreamStops.length - 1];
    const shieldPosition = [ lastStop.lat, lastStop.lon ];
    const routeColor = this.routeColor(startMarker.routeIndex % 10);

    const icon = L.divIcon({
      className: 'custom-icon', // this is needed to turn off the default icon styling (blank square)
      html: MapShield({ waitScaled:waitScaled, color:routeColor, routeText:startMarker.routeID})
    });

    return <Marker
      key={startMarker.routeID + "-" + startMarker.direction.id + "-Shield"} position={shieldPosition}
      icon={icon}
      riseOnHover={true}
      onClick = {e => {

        e.originalEvent.view.L.DomEvent.stopPropagation(e);

        push(`/route/${startMarker.routeID}/direction/${startMarker.direction.id}/start_stop/${startMarker.stopID}/end_stop/${lastStop.stopID}`);
      }}

      >
    </Marker>;
  }


  /**
   * Places a Leaflet Marker (blue pin) at the clicked or geolocated map location.
   * Like the isochrone, the marker can be dragged to get new results.
   */
  SpiderOriginMarker = (props) => {

    let latlng = null;

    return props.spiderLatLng ? <Marker
      position={ props.spiderLatLng }
      draggable={true}
      onMove={ (e) => { latlng = e.latlng; } }
      onMoveEnd={ (e) => { this.handleLocationFound({latlng: latlng})}}
      /> : null;
  }

  /**
   * Main React render method.
   */
  render() {
    const { position, zoom } = this.props;
    const { isValidLocation } = this.state;

    const mapClass = { width: '100%', height: this.state.height };

    let startMarkers = this.getStartMarkers();

    return (
      <div>
        <ValidLocationAlert showAlert={!isValidLocation}/>
        <Map center={position || SF_COORDINATES} zoom={zoom || ZOOM} style={mapClass}
             minZoom={11}
             maxZoom={18}
             onClick={this.handleMapClick}
             onLocationfound={this.handleLocationFound}
             ref={this.mapRef}
        >
          <TileLayer
            attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
            url="https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png"
            opacity={0.3}
          /> {/* see http://maps.stamen.com for details */}
          <this.DownstreamLines/>
          {startMarkers}
          <this.SpiderOriginMarker spiderLatLng={this.props.spiderLatLng}/>

          <Control position="topright">
            <div className='map-instructions'>{
              this.props.spiderLatLng && startMarkers && startMarkers.length ?
                'Click anywhere along a route to see statistics for trips between the two stops.'
                : 'Click anywhere in the city to see the routes near that point.'
            }</div>
          </Control>
          <Control position="bottomleft">
            <Button variant="contained" color="primary" onClick={this.handleGeoLocate}>
              <GpsIcon/>&nbsp;
              Routes near me
            </Button>
            &nbsp;
            <Button variant="contained" color="secondary" onClick={e => this.props.onSpiderMapClick([], null)}>
              Clear map
            </Button> <br/><br/>

          </Control>

        </Map>
      </div>
    );
  } // end render

} // end class

const mapStateToProps = state => ({
  routes: state.routes.routes,
  graphParams: state.routes.graphParams,
  waitTimesCache: state.routes.waitTimesCache,
  spiderLatLng: state.routes.spiderLatLng,
  spiderSelection: state.routes.spiderSelection,
});

const mapDispatchToProps = dispatch => {
  return ({
    onSpiderMapClick: (stops, latLng) => dispatch(handleSpiderMapClick(stops, latLng)),
  })
}

export default connect(mapStateToProps, mapDispatchToProps)(MapSpider);
