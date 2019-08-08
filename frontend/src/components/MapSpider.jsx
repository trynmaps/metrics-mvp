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
import { filterRoutes, milesBetween } from '../helpers/routeCalculations';
import { handleSpiderMapClick, handleGraphParams } from '../actions';
import { getTripPoints } from '../helpers/mapGeometry';
import { push } from 'redux-first-router'

const SF_COORDINATES = {lat : 37.7793, lng: -122.4193}; // city hall
const ZOOM = 13;
const CLICK_RADIUS_MI = 0.25; // maximum radius for stops near a point

class MapSpider extends Component {

  constructor(props) {
    super(props);
    this.state = {
    }

    this.mapRef = createRef(); // used for geolocating
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
  }

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
  handleLocationFound = e => {
    const stops = this.findStops(e.latlng); // note: all lowercase name in event.

    // Add the downstream stops to the terminal.

    for (let stop of stops) {
      this.addDownstreamStops(stop);
    }

    // Fire events here indicating that the route list should be filtered to just the
    // routes corresponding to "stops".

    const {onSpiderMapClick} = this.props;
    onSpiderMapClick(stops, e.latlng);
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
  StartMarkers = () => {

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
    return <Fragment>{items}</Fragment>
  }

  /**
   * Rendering of route from nearest stop to terminal.
   */
  DownstreamLines = () => {

    const allWaits = this.getAllWaits();

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

    const mapClass = { width: '100%', height: this.state.height };

    return (
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
        <this.StartMarkers/>
        <this.SpiderOriginMarker spiderLatLng={this.props.spiderLatLng}/>

        <Control position="bottomleft" >
          <Button variant="contained" color="primary" onClick={ this.handleGeoLocate }>
            <GpsIcon/>&nbsp;
            Routes near me
          </Button>
          &nbsp;
          <Button variant="contained" color="secondary" onClick={ e => this.props.onSpiderMapClick([], null) }>
            Clear map
          </Button> <br/><br/>

        </Control>

      </Map>
    );
  } // end render

  /**
   * These are static placeholder precomputed average waits per route values.  This will be replaced
   * eventually by values generated from the precomputed wait times for all stops on a route.
   *
   * These are used to draw routes in three widths by frequency: widest is the top third most frequent,
   * medium width for middle third of frequency, and thinnest for the third least frequent.
   */
  getAllWaits() {
    const allWaits =

  [{"routeID":"38BX","wait":169.84285714285716},{"routeID":"38AX","wait":159.70769230769233},
    {"routeID":"1BX","wait":130.49655172413796},{"routeID":"41","wait":110.75636363636364},
    {"routeID":"7X","wait":106.77532467532468},{"routeID":"1AX","wait":102.53235294117647},
    {"routeID":"31BX","wait":97.9939393939394},{"routeID":"8AX","wait":81.05306122448978},
    {"routeID":"82X","wait":77.36500000000002},{"routeID":"30X","wait":72.21538461538461},
    {"routeID":"31AX","wait":48.3780487804878},{"routeID":"14X","wait":45.76607142857143},
    {"routeID":"S","wait":42.98648648648649},{"routeID":"81X","wait":34.93750000000001},
    {"routeID":"56","wait":26.305769230769233},{"routeID":"36","wait":23.021428571428572},
    {"routeID":"23","wait":21.24701492537313},{"routeID":"25","wait":20.81190476190476},
    {"routeID":"67","wait":19.99772727272727},{"routeID":"39","wait":18.764102564102565},
    {"routeID":"18","wait":15.71111111111111},{"routeID":"12","wait":15.61954022988506},
    {"routeID":"52","wait":15.015492957746478},{"routeID":"C","wait":14.902702702702705},
    {"routeID":"PM","wait":14.210869565217392},{"routeID":"8BX","wait":13.026881720430108},
    {"routeID":"PH","wait":12.933333333333332},{"routeID":"54","wait":12.680722891566266},
    {"routeID":"8","wait":12.673636363636362},{"routeID":"35","wait":12.5109375},
    {"routeID":"31","wait":12.00990990990991},{"routeID":"3","wait":11.955172413793104},
    {"routeID":"37","wait":11.766315789473683},{"routeID":"88","wait":11.75263157894737},
    {"routeID":"48","wait":11.725000000000001},{"routeID":"M","wait":11.183636363636365},
    {"routeID":"57","wait":11.163529411764706},{"routeID":"19","wait":11.15373134328358},
    {"routeID":"66","wait":10.487499999999999},{"routeID":"9R","wait":10.371264367816094},
    {"routeID":"10","wait":9.95},{"routeID":"33","wait":9.621839080459772},
    {"routeID":"5","wait":9.588750000000001},{"routeID":"2","wait":9.172},
    {"routeID":"38","wait":8.974850299401195},{"routeID":"27","wait":8.712631578947367},
    {"routeID":"9","wait":8.483185840707964},{"routeID":"KT","wait":8.379761904761907},
    {"routeID":"6","wait":8.184210526315788},{"routeID":"55","wait":7.946428571428571},
    {"routeID":"24","wait":7.747899159663866},{"routeID":"J","wait":7.675000000000001},
    {"routeID":"29","wait":7.4916201117318435},{"routeID":"21","wait":7.115789473684211},
    {"routeID":"7","wait":7.017757009345793},{"routeID":"28R","wait":7.000000000000001},
    {"routeID":"43","wait":6.9662857142857115},{"routeID":"30","wait":6.941176470588235},
    {"routeID":"44","wait":6.82734375},{"routeID":"28","wait":6.578481012658228},
    {"routeID":"45","wait":6.361016949152543},{"routeID":"L","wait":6.295833333333333},
    {"routeID":"22","wait":6.107608695652175},{"routeID":"F","wait":6.010000000000001},
    {"routeID":"NX","wait":5.9375},{"routeID":"N","wait":5.803030303030303},
    {"routeID":"5R","wait":5.579365079365079},{"routeID":"47","wait":5.460344827586206},
    {"routeID":"14","wait":5.4173913043478255},{"routeID":"49","wait":5.0628205128205135},
    {"routeID":"14R","wait":4.806521739130435},{"routeID":"1","wait":3.921875},
    {"routeID":"38R","wait":3.68125}];

    return allWaits;
  }

} // end class

const mapStateToProps = state => ({
  spiderLatLng: state.routes.spiderLatLng,
  spiderSelection: state.routes.spiderSelection,
});

const mapDispatchToProps = dispatch => {
  return ({
    onSpiderMapClick: (stops, latLng) => dispatch(handleSpiderMapClick(stops, latLng)),
  })
}

export default connect(mapStateToProps, mapDispatchToProps)(MapSpider);
