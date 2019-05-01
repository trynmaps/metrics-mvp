import React, { Component, createRef, Fragment } from 'react';
import { css } from 'emotion';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
//import PropTypes from 'prop-types';
import { latLngBounds } from 'leaflet';

import DropdownControl from './DropdownControl';

import { Map, TileLayer, Marker, Popup, CircleMarker, Tooltip } from 'react-leaflet'

class StopMap extends Component {

  constructor(props) {
    super(props);
    this.state = {
      routeId: '12',
      directionId: null,
      secondStopList: [],
      firstStopId: null,
      secondStopId: null,
      date: new Date('2019-04-08T03:50'),
      startTimeStr: null,
      endTimeStr: null,
      
      hasLocation: false, // not geolocated
      latLng: {
        lat: 37.7793, // city hall
        lng: -122.4193,
      },
      stopMarkers: [],
    }
    
    this.mapRef = createRef();
    
    
    
  }


          
  componentDidUpdate() {
    const selectedRoute = this.getSelectedRouteInfo();
    if (selectedRoute) {
      if (!selectedRoute.directions) {
        this.props.fetchRouteConfig(this.state.routeId);
      } else if (!this.state.directionId && selectedRoute.directions.length > 0) {
        this.setState({ directionId: selectedRoute.directions[0].id });
      }
    }
  }

  updateGraphData = () => {
    const {
      routeId, directionId, firstStopId, date, secondStopId, startTimeStr, endTimeStr
    } = this.state;

    this.props.resetGraphData();
    if (firstStopId != null && routeId != null) {
      const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const params = {
        route_id: routeId,
        direction_id: directionId,
        start_stop_id: firstStopId,
        end_stop_id: secondStopId,
        start_time: startTimeStr,
        end_time: endTimeStr,
        date: formattedDate,
      };
      this.props.fetchGraphData(params);
    }
  }

  onSubmit = (event) => {
    event.preventDefault();
    this.updateGraphData();
  }

    setTimeRange = timeRange => {
    if (!timeRange) {
      this.setState({ startTimeStr: null, endTimeStr: null }, this.updateGraphData);
    } else {
      var timeRangeParts = timeRange.split('-');
      this.setState({ startTimeStr: timeRangeParts[0], endTimeStr: timeRangeParts[1] }, this.updateGraphData);
    }
  }

  setRouteId = routeId => this.setState({ routeId }, this.selectedRouteChanged)

  setDirectionId = directionId => this.setState({ directionId }, this.selectedDirectionChanged)

  onSelectSecondStop = (firstStopId, selectFirstStopCallback) => {
    selectFirstStopCallback ? selectFirstStopCallback(firstStopId)
      : this.setState({ secondStopId: firstStopId }, this.selectedStopChanged);
  }

  onSelectFirstStop = (stopId) => {
    const { directionId } = this.state;
    const selectedRoute = { ...this.getSelectedRouteInfo() };
    const secondStopInfo = this.getStopsInfoInGivenDirection(selectedRoute, directionId);
    const secondStopListIndex = secondStopInfo.stops.indexOf(stopId);
    const secondStopList = secondStopInfo.stops.slice(secondStopListIndex + 1);
    this.setState({ firstStopId: stopId, secondStopList }, this.selectedStopChanged);
  }

  onSelectSecondStop = (stopId) => {
    this.setState({ secondStopId: stopId }, this.selectedStopChanged);
  }

  selectedRouteChanged = () => {
    const { routeId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    if (!selectedRoute) {
      return;
    }
    if (!selectedRoute.directions) {
      this.setDirectionId(null);
      this.props.fetchRouteConfig(routeId);
    } else {
      const directionId = selectedRoute.directions.length > 0 ? selectedRoute.directions[0].id : null;
      this.setDirectionId(directionId);
    }
  }

  getStopsInfoInGivenDirection = (selectedRoute, directionId) => selectedRoute.directions.find(dir => dir.id === directionId);

  selectedDirectionChanged = () => {
    const { firstStopId, directionId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? this.getStopsInfoInGivenDirection(selectedRoute, directionId) : null;
    if (firstStopId) {
      if (!selectedDirection || selectedDirection.stops.indexOf(firstStopId) === -1) {
        this.setState({ firstStopId: null, secondStopId: null }, this.selectedStopChanged);
      }
    }
  }

  selectedStopChanged = () => {
    this.updateGraphData();
  }

  handleTimeChange(newTime) {
    this.setState({ time: newTime.formatted });
  }

  getSelectedRouteInfo() {
    const { routes } = this.props;
    const { routeId } = this.state;
    return routes ? routes.find(route => route.id === routeId) : null;
  }

   handleClick = (e) => {
    const map = this.mapRef.current
    if (map != null) {
      this.handleLocationFound(e);
      //map.leafletElement.locate() // this is for geolocation, see https://leafletjs.com/examples/mobile/, should also
      // support location at click
    }
   }
   
  handleLocationFound = (e: Object) => {
    this.setState({
      hasLocation: true,
      latLng: e.latlng,
    })
    this.findAndPlotStops();
  }   
  
  findAndPlotStops() {
     const stops = this.findStops();
     this.setState({ stopMarkers: stops });
  }
  
  // ugly brute force method:  for each route, fetch route config. for each direction of each route
  // iterate through all stops to find nearest stop.
  // collect all nearest stops, sort by distance, and show N stops.
  
  findStops() {
    const { routes } = this.props;
    const latLng = this.state.latLng;
    const latLon = { lat: latLng.lat, lon: latLng.lng };
    let stopsByRouteAndDir = [];
    
    for (let i = 0; i < routes.length; i++) { // optimize this on back end
      const route = routes[i];
      //const route = this.getSelectedRouteInfo();
      if (route.directions) {
        for (let direction of route.directions) {
          const stopList = direction.stops;
          const nearest = this.findNearestStop(latLon, stopList, route.stops);
          nearest.routeID = route.id;
          nearest.routeIndex = i;
          nearest.routeTitle = route.title;
          nearest.direction = direction;
          stopsByRouteAndDir.push(nearest);
        }
      } else { // no good, need a way to fetch all route configs
        this.props.fetchRouteConfig(route.id);
      }
    }
    // sort by distance and truncate by distance
    stopsByRouteAndDir.sort((a, b) => a.miles - b.miles);
    stopsByRouteAndDir = stopsByRouteAndDir.filter(stop => stop.miles < 0.25);
    
    
    return stopsByRouteAndDir;
    
  }
  
  // returns { distance: (miles); stop: stopObject }
  // stop list is an array of strings (stop ids) that key into the stopHash
  findNearestStop(latLon, stopList, stopHash) {
    let nearest = { miles: -1,
     stop: null,
     stopID: null,
    }
    for (let stop of stopList) {
      const miles = this.milesBetween(latLon, stopHash[stop]);
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
   * This is approximate straight line distance between two lat/lon's,
   * assuming a fixed distance per degree of longitude, and that the
   * distance per degree of latitude varies by cosine of latitude.
   *
   * http://jonisalonen.com/2014/computing-distance-between-coordinates-can-be-simple-and-fast/
   */
  milesBetween(p1, p2) {

    const degLength = 69.172; // miles per degree at equator
    const deltaLat = p1.lat - p2.lat;
    const deltaLon = (p1.lon - p2.lon) * Math.cos(p1.lat * 3.1415926 / 180);
    return degLength * Math.sqrt(deltaLat * deltaLat + deltaLon * deltaLon);
  }

  render() {
    const { routes } = this.props;
    
    
    const {
      date, routeId, directionId, firstStopId, secondStopId, secondStopList, startTimeStr, endTimeStr
    } = this.state;

    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? selectedRoute.directions.find(dir => dir.id === directionId) : null;
      
      
    const marker = this.state.hasLocation ? (
      <Marker position={this.state.latLng} opacity="0.01">
        <Popup>You are here</Popup>
      </Marker>
) : null;      

    const StopMarkers = () => {  

      const items = this.state.stopMarkers.map(stopMarker => {
        const position = [ stopMarker.stop.lat, stopMarker.stop.lon ];
        return <CircleMarker key={stopMarker.stopID} center={position} opacity="0.1">
          <Tooltip permanent="true">
          {stopMarker.routeID}
          </Tooltip>
          <Popup>{stopMarker.stop.title}<br/>
            {stopMarker.routeTitle}<br/>
            {stopMarker.direction.title}<br/>
            {Math.round(stopMarker.miles * 5280)} feet
          </Popup>
        </CircleMarker>
      });
      return <Fragment>{items}</Fragment>
    }
 
 
    const FromButtons = () => {  

      const items = this.state.stopMarkers.map(stopMarker => {
        return <Button variant="secondary" key={stopMarker.stopID}>
          {stopMarker.routeTitle} {stopMarker.direction.title}
          </Button>
      });
      return <Fragment>{items}</Fragment>
    }
 
 
    const bounds = this.state.stopMarkers.length > 1 ?
      latLngBounds(this.state.stopMarkers.map(stopMarker => [stopMarker.stop.lat, stopMarker.stop.lon])).pad(0.25) : null;
 
    return (
      <div className={css`
          color: #fff;
          border-radius: 5px;
          padding: 10px;
          margin-right: 20px;
          grid-column: col1-start / col3-start;
          grid-row: row3-start ;
          font-family: 'Oswald', sans-serif;
      `
      }
      >
        <Card bg="light" style={{ color: 'black' }}>
          <Card.Header>Map</Card.Header>
          
      <Map
        style={{
          height:"20vw"
        }}
        bounds={bounds}
        center={this.state.latLng}
        length={4}
        onClick={this.handleClick}
        onLocationfound={this.handleLocationFound}
        ref={this.mapRef}
        zoom={ bounds ? null : 13}
        minZoom={11}
        maxZoom={18}
        >
        <TileLayer
          attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          //url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          url="http://tile.stamen.com/toner-lite/{z}/{x}/{y}.png"
          opacity={0.5}
        /> {/* see http://maps.stamen.com for details */}
        {/*marker*/}
        <StopMarkers/>
        
</Map>          
          
          <ListGroup variant="flush">
          <div className={css`max-height:300px; overflow:scroll;`}>
            <ListGroup.Item>
              <FromButtons/>
            </ListGroup.Item>
            </div>
            
            <ListGroup.Item>
              <DropdownControl
                title="Route"
                name="route"
                variant="info"
                value={routeId}
                options={
                  (routes || []).map(route => ({
                    label: route.title, key: route.id,
                  }))
                }
                onSelect={this.setRouteId}
              />
            </ListGroup.Item>
            { selectedRoute
              ? (
                <ListGroup.Item>
                  <DropdownControl
                    title="Direction"
                    name="direction"
                    variant="info"
                    value={directionId}
                    onSelect={this.setDirectionId}
                    options={
                  (selectedRoute.directions || []).map(direction => ({
                    label: direction.title, key: direction.id,
                  }))
                }
                  />
                </ListGroup.Item>
              ) : null
            }
            { (selectedDirection)
              ? (
                <ListGroup.Item>
                  <DropdownControl
                    title="From Stop"
                    name="stop"
                    variant="info"
                    value={firstStopId}
                    onSelect={this.onSelectFirstStop}
                    options={
                  (selectedDirection.stops || []).map(firstStopId => ({
                    label: (selectedRoute.stops[firstStopId] || { title: firstStopId }).title,
                    key: firstStopId,
                  }))
                }
                  />
                </ListGroup.Item>
              ) : null
            }
            { (selectedDirection)
              ? (
                <ListGroup.Item>
                  <DropdownControl
                    title="To Stop"
                    name="stop"
                    variant="info"
                    value={secondStopId}
                    onSelect={this.onSelectSecondStop}
                    options={
                  (secondStopList || []).map(secondStopId => ({
                    label: (selectedRoute.stops[secondStopId] || { title: secondStopId }).title,
                    key: secondStopId,
                  }))
                }
                  />
                </ListGroup.Item>
              ) : null
            }
          </ListGroup>
        </Card>
      </div>
    );
  }
}

//StopMap.propTypes = {
  //fetchGraphData: PropTypes.func.isRequired,
//};

export default StopMap;
