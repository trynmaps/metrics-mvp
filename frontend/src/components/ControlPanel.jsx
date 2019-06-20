import React, { Component, createRef, Fragment } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import DatePicker from 'react-date-picker';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import PropTypes from 'prop-types';
//import { latLngBounds } from 'leaflet';
import { filterRoutes } from '../helpers/graphData';

import * as d3 from "d3";
import {handleRouteSelect} from '../actions';

import DropdownControl from './DropdownControl';
import './ControlPanel.css';

import { Map, TileLayer, Popup, Marker, CircleMarker, Tooltip, Polyline } from 'react-leaflet'
import Control from 'react-leaflet-control'

import L from 'leaflet';
import MapShield from './MapShield'
import ReactDOMServer from 'react-dom/server';

// todo: figure out why sometimes the zoom gets reset (probably a race condition with setState, need callback)
// todo: make start stops clickable (equivalent to the buttons)
// todo: think about start stops legibility, different color or shape for inbound vs outbound?
// todo: nice if we can intelligently handle multiple routes at the same stop
// todo: when pickers are used to change from stop, need to update map

/**
 * Note: leaflet seems slow when events on leaflet components change React state.  Also seems to regenerate
 * leaflet objects so event handlers lose their context like event target.
 * Currently trying to minimize state changes within leaflet.
 */
class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      routeId: '12',
      directionId: null,
      secondStopList: [],
      firstStopId: null,
      secondStopId: null,
      date: new Date('2019-05-24T03:50'),
      startTimeStr: null,
      endTimeStr: null,





      
      hasLocation: false, // not geolocated
      latLng: {
        lat: 37.7793, // city hall
        lng: -122.4193,
      },
      latLngOriginal: {
        lat: 37.7793, // city hall
        lng: -122.4193,
      },
      startMarkers: [],
      routeMarkers: [],
      hoverMarker: null,
    }
    
    this.mapRef = createRef();



    
  }

  componentDidUpdate() {
    const selectedRoute = this.getSelectedRouteInfo();
    if (selectedRoute) {
      if (!selectedRoute.directions) {
        console.log("Shouldn't happen.");
        debugger;
        // xxx this.props.fetchRouteConfig(this.state.routeId);
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
      const graphParams = {
        route_id: routeId,
        direction_id: directionId,
        start_stop_id: firstStopId,
        end_stop_id: secondStopId,
        start_time: startTimeStr,
        end_time: endTimeStr,
        date: formattedDate,
      };
      const intervalParams = Object.assign({}, graphParams);
      delete intervalParams.start_time; // for interval api, clear out start/end time and use defaults for now
      delete intervalParams.end_time;   // because the hourly graph is spiky and can trigger panda "empty axes" errors.
      this.props.fetchData(graphParams, intervalParams);
    }
  }

  onSubmit = (event) => {
    event.preventDefault();
    this.updateGraphData();
  }

  setDate = date => this.setState({ date }, this.updateGraphData)

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

  onSelectFirstStop = (stopId, optionalSecondStopId) => {
    const { directionId, secondStopId } = this.state;
    const selectedRoute = { ...this.getSelectedRouteInfo() };
    const secondStopInfo = this.getStopsInfoInGivenDirection(selectedRoute, directionId);
    const secondStopListIndex = secondStopInfo.stops.indexOf(stopId);
    const secondStopList = secondStopInfo.stops.slice(secondStopListIndex + 1);

    let newSecondStopId = secondStopId;
    
    // if and only if user clicked on a segment, we get both first and second stop ids
    if (optionalSecondStopId) {
       newSecondStopId = optionalSecondStopId;
    } else {

    // If the "to stop" is not set or is not valid for the current "from stop",
    // set a default "to stop" that is some number of stops down.  If there aren't
    // enough stops, use the end of the line.

      const nStops = 5;

      if (secondStopId == null || !secondStopList.includes(secondStopId)) {
        newSecondStopId = secondStopList.length >= nStops ? secondStopList[nStops-1] :
          secondStopList[secondStopList.length-1];
      }
    }
    
    // if a starting stop is selected, hide mapping of other routes by regenerating just one start marker
    
    let newStartMarkers = this.createStartMarkerForOneRoute(this.state.routeId, directionId, stopId);
    
    this.setState({
      firstStopId: stopId,
      secondStopId: newSecondStopId,
      secondStopList,
      startMarkers: newStartMarkers }, this.selectedStopChanged);
    
  }

  onSelectSecondStop = (stopId) => {
    this.setState({ secondStopId: stopId }, this.selectedStopChanged);
  }

  selectedRouteChanged = () => {
    const {onRouteSelect} = this.props;
    const { routeId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    if (!selectedRoute) {
      return;
    }
    //onRouteSelect(selectedRoute);
    if (!selectedRoute.directions) {
      this.setDirectionId(null);
      console.log("also shouldn't happen");
      debugger;
      //xxx this.props.fetchRouteConfig(routeId);
    } else {
      const directionId = selectedRoute.directions.length > 0 ? selectedRoute.directions[0].id : null;
      this.setDirectionId(directionId);

    }
  }

  getStopsInfoInGivenDirection = (selectedRoute, directionId) => {
    return selectedRoute.directions.find(dir => dir.id === directionId);
  }
  getStopsInfoInGivenDirectionName = (selectedRoute, name) => {
    const stopSids= selectedRoute.directions.find(dir => dir.name === name);
    return stopSids.stops.map(stop => selectedRoute.stops[stop]);

  }

  selectedDirectionChanged = () => {
    const { firstStopId, directionId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? this.getStopsInfoInGivenDirection(selectedRoute, directionId) : null;
      
    const startMarkerArray = this.createStartMarkerForOneRoute(this.state.routeId, directionId);
    
    // there's logic here to preserve the first stop when changing directions, not sure how often
    // that is actually the case.  Keeping for now.
    
    if (firstStopId) {
      if (!selectedDirection || selectedDirection.stops.indexOf(firstStopId) === -1) {
        this.setState({ firstStopId: null, secondStopId: null, startMarkers: startMarkerArray }, this.selectedStopChanged);
      }
    } else {
    
      // if no first stop selected, user is using pulldowns and not clicking on map.
      // make sure that there is a start marker for the selected route and direction
      // starting at the beginning of this direction.
      //
      // state management is getting kind of messy here, need to reexamine.
    
      this.setState({startMarkers: startMarkerArray});
    }
  }

  selectedStopChanged = () => {
    this.plotSelectedRoute();
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

  handleGeoLocate = (e) => {
    e.preventDefault();
    const map = this.mapRef.current;
    if (map != null) {
      map.leafletElement.locate(); // this is for geolocation, see https://leafletjs.com/examples/mobile/
    }
   }
      


   handleClick = (e) => {
    const map = this.mapRef.current
    if (map != null) {
      this.handleLocationFound(e);
    }
   }
   
  handleLocationFound = (e: Object) => {
    this.setState({
      hasLocation: true,
      latLng: e.latlng,
      firstStopId: null,
      secondStopId: null,
    }, this.findAndPlotStops);
    
  }   
  
  findAndPlotStops() {
     const stops = this.findStops();
     
     // what if we also plot all the downstream stops
     
     for (let stop of stops) {
         this.addDownstreamStops(stop);
     }
    
    // to do: indicators for firstStop and secondStop 
     
     this.setState({ startMarkers: stops,
      });
  }
  
  addDownstreamStops(stop) {
         const selectedRoute = this.props.routes.find(route => route.id === stop.routeID);
         
         const secondStopInfo = stop.direction;//this.getStopsInfoInGivenDirection(selectedRoute, stop.direction);
         const secondStopListIndex = secondStopInfo.stops.indexOf(stop.stopID);

         const secondStopList = secondStopInfo.stops.slice(secondStopListIndex /* + 1  include starting stop */);
        
         const downstreamStops = secondStopList.map(stopID => Object.assign(selectedRoute.stops[stopID], { stopID: stopID}));
         if (! downstreamStops || !downstreamStops.length){ debugger; }
         stop.downstreamStops = downstreamStops;
         
  }
  
  // ugly brute force method:  for each route, fetch route config. for each direction of each route
  // iterate through all stops to find nearest stop.
  // collect all nearest stops, sort by distance, and show N stops.
  
  findStops() {
    const { routes } = this.props;
    const latLng = this.state.latLng;
    const latLon = { lat: latLng.lat, lon: latLng.lng };
    let stopsByRouteAndDir = [];
    
    const filteredRoutes = filterRoutes(routes);
    for (let i = 0; i < filteredRoutes.length; i++) { // optimize this on back end
      const route = routes[i];
      
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
      }
    }
    // sort by distance and truncate by distance
    stopsByRouteAndDir.sort((a, b) => a.miles - b.miles);
    stopsByRouteAndDir = stopsByRouteAndDir.filter(stop => stop.miles < 0.25);
    
    
    return stopsByRouteAndDir;
    
  }
  
  createStartMarkerForOneRoute(routeID, directionID, optionalStopID) {
    const { routes } = this.props;
    let startMarkers = [];
    

    const route = this.getSelectedRouteInfo();
    const direction = route.directions.find(dir => dir.id === directionID);

      const stopList = direction.stops;
      let stop = null;
      
      // get the stop object out of the route's hash
      
      if (optionalStopID) {
        stop = route.stops[optionalStopID];
      } else {
        stop = route.stops[stopList[0]];
      }
      
      let nearest = {
        stop: stop,
        stopID: optionalStopID ? optionalStopID : stopList[0],
      };
      nearest.routeID = routeID;
      nearest.routeIndex = routes.indexOf(route);
      nearest.routeTitle = route.title;
      nearest.direction = direction;
      
      this.addDownstreamStops(nearest);
      
      startMarkers.push(nearest);
    
    return startMarkers;
    
  }  
  
  
  /**
   *  returns { distance: (miles); stop: stopObject }
   * stop list is an array of strings (stop ids) that key into the stopHash
   */
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
   * updates state to get all downstream markers replotted after first stop is changed 
   */
  plotSelectedRoute() {
    
    const selectedRoute = this.getSelectedRouteInfo();
    const { directionId, firstStopId } = this.state;
    const secondStopInfo = this.getStopsInfoInGivenDirection(selectedRoute, directionId);
    const secondStopListIndex = secondStopInfo.stops.indexOf(firstStopId);
    const secondStopList = secondStopInfo.stops.slice(secondStopListIndex + 1);
    
    
    const stops = secondStopList.map(stopID => { return {
      stop: selectedRoute.stops[stopID],
      stopID: stopID,
      routeIndex: this.state.rout
      }
    });
     
    
    this.setState({ routeMarkers: stops });
  }





  speedColor(mph) {
  return d3.scaleQuantize().domain([2.5,12.5]).range(["#9e1313", "#e60000", "#f07d02", "#84ca50"])(mph);
//  return d3.scaleQuantize().domain([0, 4]).range(d3.schemeSpectral[5])(mph/this.speedMax()*5);
//    return d3.interpolateRdGy(mph/this.speedMax() /* scale to 0-1 */);
  }
   
  fakeSpeed(i) {
    return Math.abs(i % 20 - 10)/10;
  }    

  speedMax() {
    return 15;
  }


  /**
   * Returns the distance between two stops in miles.
   *
   * todo: refactor into helper   
   */
  milesBetween(p1, p2) {
    const meters = this.haverDistance(p1.lat, p1.lon, p2.lat, p2.lon);
    return meters / 1609.344; 
  }
  
  /**
   * Haversine formula for calcuating distance between two coordinates in lat lon
   * from bird eye view; seems to be +- 8 meters difference from geopy distance.
   *
   * From eclipses.py.  Returns distance in meters.
   *
   * todo: refactor into helper
   */
  haverDistance(latstop,lonstop,latbus,lonbus) {

    const deg2rad = x => x * Math.PI / 180;
     
    [latstop,lonstop,latbus,lonbus] = [latstop,lonstop,latbus,lonbus].map(deg2rad);
    const eradius = 6371000;

    const latdiff = (latbus-latstop);
    const londiff = (lonbus-lonstop);

    const a = Math.sin(latdiff/2)**2 + Math.cos(latstop) * Math.cos(latbus) * Math.sin(londiff/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = eradius * c;
    return distance;
  }
  
  /**
   * Speed from index to index+1
   * Just haversine distance for now, can find actual distance using shapes
   */
  getSpeed(startMarker, index, tripTimes) {
    const routeID = startMarker.routeID;
    const directionID = startMarker.direction.id;
    const firstStop = startMarker.downstreamStops[index];
    const firstStopID = firstStop.stopID;
    const nextStop = startMarker.downstreamStops[index+1];
    const nextStopID = nextStop.stopID;
    
    const tripTimesForRoute = tripTimes[routeID];
    if (!tripTimesForRoute) {
     return -1;
    }
    
    const tripTimesForDir = tripTimesForRoute[directionID];
    
    let time = null;
    if (tripTimesForDir && tripTimesForDir[firstStopID] && tripTimesForDir[firstStopID][nextStopID]) {
      time = tripTimesForDir[firstStopID][nextStopID];
    } else {
      return -1; // speed not available;
    }
    
    const distance = this.milesBetween(firstStop, nextStop);
    
    return distance/time * 60; // mph 
  }

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




  sendRouteStopsToMap = () => {
    const {directionId} = this.state;
    const {onRouteSelect} = this.props;
    const selectedRoute = this.getSelectedRouteInfo();
    onRouteSelect({
      'Inbound' : this.getStopsInfoInGivenDirectionName(selectedRoute, 'Inbound'),
      'Outbound' : this.getStopsInfoInGivenDirectionName(selectedRoute, 'Outbound')
    });
  }

  // toggleTimekeeper(val) {
  //   // this.setState({ displayTimepicker: val });
  // }

  render() {
    const { routes } = this.props;
    
    
      
        
    const {
      date, routeId, directionId, firstStopId, secondStopId, secondStopList, startTimeStr, endTimeStr
    } = this.state;

    const timeRange = (startTimeStr || endTimeStr) ? (startTimeStr + '-' + endTimeStr) : '';

    const selectedRoute = this.getSelectedRouteInfo();
    // now defined further down const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
    //  ? selectedRoute.directions.find(dir => dir.id === directionId) : null;









    // possible first stops near click or current location
    
    const StartMarkers = () => {  


      const items = this.state.startMarkers.map((startMarker, index) => {
      
        const position = [ startMarker.stop.lat, startMarker.stop.lon ];
        const lineColor = routeColor(startMarker.routeIndex % 10); 
        
        return <CircleMarker key={ "startMarker-" + index } center={position}
             radius="6" 
             fillColor = {lineColor}
             fillOpacity={this.state.firstStopId === startMarker.stopID ? 1.0 : 0.2}
             stroke={false}
             >
          <Tooltip>
          {startMarker.routeTitle} <br/> {startMarker.direction.title}
          </Tooltip>
          <Popup>{startMarker.stop.title}<br/>
            {startMarker.routeTitle}<br/>
            {startMarker.direction.title}<br/>
            {Math.round(startMarker.miles * 5280)} feet
          </Popup>
        </CircleMarker>
      });
      return <Fragment>{items}</Fragment>
    }
    
    const routeColor = d3.scaleQuantize([0,9], d3.schemeCategory10);
    
    
    const allWaits = this.getAllWaits();
    
    const DownstreamLine = () => {  

      // for each start marker
      
      const items = this.state.startMarkers.map(startMarker => {
        const downstreamStops = startMarker.downstreamStops;
        const lineColor = routeColor(startMarker.routeIndex % 10); 
        
        const polylines = [];
        
        // Add a base polyline connecting the stops.  One polyline between each stop gives better tooltips
        // when selecting a line.  Once a line is selected, looks better to have a monolithic polyline.
  
  
        // multi-polyline for line selection:
        
        if (!firstStopId) {  


          // this polyline is in line color
          
          // get wait rank
          const waitIndex = allWaits.findIndex(wait => wait.routeID === startMarker.routeID);
          
          // scale to 0, 1, or 2
          const waitScaled = Math.trunc(waitIndex/allWaits.length * 3);
 
          const computedWeight = waitScaled * 1.5 + 3;

               
        for (let i=0; i < downstreamStops.length-1; i++) {
          const latLngs = [[ downstreamStops[i].lat, downstreamStops[i].lon ],
                           [ downstreamStops[i+1].lat, downstreamStops[i+1].lon ]];
        
          

          polylines.push(
            <Polyline
              key={"poly-" + startMarker.routeID + "-" + downstreamStops[i].stopID} 
              positions = { latLngs }
              color = { lineColor }
              opacity = { 0.5 }
              weight = { computedWeight }
              onMouseOver = { e => {

                if (!firstStopId) { e.target.setStyle({opacity:1, weight: computedWeight+4}); }
                                
                /*this.setState({
                  //hoverMarker: startMarker,
                  infoValue: startMarker.routeTitle + " - " + startMarker.direction.title
                });*/

                return true;
                }
              }
              onMouseOut = { e => {
                  if (!firstStopId) { e.target.setStyle({opacity:0.5, weight:computedWeight}); }                
                  //this.setState({infoValue: null});
                  return true;                
                } 
              }

              onClick={e => { // when this segment is clicked, plot only the stops for this route/dir by setting the first stop
            
                e.originalEvent.view.L.DomEvent.stopPropagation(e);          
          
                this.setRouteId(startMarker.routeID);
                this.setDirectionId(startMarker.direction.id);
                this.onSelectFirstStop(startMarker.stopID, downstreamStops[i+1].stopID);
              }
            }

            
            >
              <Tooltip>
                 {startMarker.routeTitle}<br/>{startMarker.direction.title}
              </Tooltip>
            </Polyline>);
            
        } // end for

     // add a shield
     // TODO: make shield clickable            
     
     const lastMarker = downstreamStops[downstreamStops.length - 1];
     const position = [ lastMarker.lat, lastMarker.lon ];
     //console.log(startMarker.routeID + "-" + startMarker.direction.id);
     
     const icon = L.divIcon({
       className: 'custom-icon',
       html: MapShield({ waitScaled:waitScaled, color:lineColor, routeText:startMarker.routeID})
       
       
        //ReactDOMServer.renderToString(<MapShield
         //waitScaled={waitScaled} color={lineColor} routeText={startMarker.routeID}/>)
     });
     

     
     polylines.push(<Marker
       key={startMarker.routeID + "-" + startMarker.direction.id + "-Shield"} position={position}
       icon={icon}
       riseOnHover={true}
       >
     </Marker>);
            

        
        } else {
        
        // when plotting a single route, use a joined polyline as base (thicker line)

          let latLngs = [];
          for (let i=0; i < downstreamStops.length; i++) {
            latLngs.push([ downstreamStops[i].lat, downstreamStops[i].lon ]);
          }
        
          // base polyline is white for contrast
          
          polylines.push(
            <Polyline
              key={"poly-" + startMarker.routeID } 
              positions = { latLngs }
              color = { /*firstStopId ? this.fakeSpeedColor(this.fakeSpeed(i)) :*/ /*lineColor*/ "white" } // sawtooth wave from 0-10 for fake speed
              opacity = { firstStopId || this.state.hoverMarker === startMarker ? 1 : 1 } // if a first stop is selected use full opacity?
              weight = { firstStopId ? 12 : 4 } // if a first stop is selected use extra weight
            >
            </Polyline>);
        }
        
        for (let i=0; i < downstreamStops.length-1; i++) {
          const latLngs = [[ downstreamStops[i].lat, downstreamStops[i].lon ],
                           [ downstreamStops[i+1].lat, downstreamStops[i+1].lon ]];
            

          // inner line made of many polylines for showing speed            
            
          if (firstStopId) {  
          
            const speed = this.getSpeed(startMarker, i, this.props.tripTimes);
          polylines.push(
            <Polyline
              key={"poly-speed-" + startMarker.routeID + "-" + downstreamStops[i].stopID} 
              positions = { latLngs }
              color = { speed < 0 ? "white" : this.speedColor(speed) }
              opacity = { 1 }
              weight = { 5 }

              onClick={e => { // when this segment is clicked, plot only the stops for this route/dir by setting the first stop
            
                e.originalEvent.view.L.DomEvent.stopPropagation(e);          
          
                this.setRouteId(startMarker.routeID);
                this.setDirectionId(startMarker.direction.id);
                this.onSelectFirstStop(startMarker.stopID, downstreamStops[i+1].stopID);
              }
            }

            
            >
            {
              <Tooltip>
                 { speed < 0 ? "?" : speed.toFixed(1) } mph to { downstreamStops[i+1].title }
              </Tooltip>
            
            }
            </Polyline>);

            }          
            
        } // end for     
        return polylines;
      }
           
           
      );
      return <Fragment>{items}</Fragment>
    }
    

    // stops along the selected route from the first stop 
    // represented by clickable outlines of circles
    
    const RouteMarkers = () => {  

      if (!firstStopId) { return null; }

      const selectedRoute = this.getSelectedRouteInfo();

      const routeIndex = this.props.routes.indexOf(selectedRoute);
      const lineColor = routeColor(routeIndex % 10); 

      const items = this.state.routeMarkers.map(routeMarker => {
        const position = [ routeMarker.stop.lat, routeMarker.stop.lon ];
        return <CircleMarker key={routeMarker.stopID + "R"} center={position}
          stroke={ this.state.secondStopId === routeMarker.stopID ? true : false}
          color={ "black"}
          fillColor={ lineColor }
          fillOpacity={this.state.secondStopId === routeMarker.stopID ? 1 : 0}
          radius= { this.state.secondStopId === routeMarker.stopID ? 4 : 1 }
          onMouseOver = { e => { e.target.setStyle({fillOpacity:0.5}) }}
          onMouseOut = { e => { e.target.setStyle({fillOpacity: (this.state.secondStopId === routeMarker.stopID ? 1 : 0)}) }}
          onClick={e => {
              e.originalEvent.view.L.DomEvent.stopPropagation(e)          
              this.onSelectSecondStop(routeMarker.stopID);
            }
          }>
          <Tooltip>
          { routeMarker.stop.title }
          </Tooltip>          
        </CircleMarker>
      });
      
      return <Fragment>{items}</Fragment>
    }

 
    const FromButtons = () => {
    
    return null; // don't need these?  
/*
      const items = this.state.startMarkers.map(startMarker => {
        return <Button variant="secondary" key={startMarker.stopID}
          onClick={e => { // todo: after this button is clicked, plot only the stops for this route/dir
          
           this.setState({routeId: startMarker.routeID,
             directionId: startMarker.direction.id});
           this.onSelectFirstStop(startMarker.stopID);
             }
           }>
          {startMarker.routeTitle} - {startMarker.direction.title}
          </Button>
      });
      return <Fragment>{items}</Fragment>
      */
    }
    
    const SpeedLegend = () => {
    
      let items = [];
                
      const speedColorValues = [ 2.5, 6.25, 8.75, 12.5 ]; // representative values for quantizing
      // center of scale is 7.5 with quartile boundaries at 5 and 10.
      
      const speedColorLabels = [ " < 5", "5-7.5", "7.5-10", "10+" ];
      
      for (let speedColorValue of speedColorValues) {
        items.push(
        <div key={speedColorValue}>
          <i style={{
            backgroundColor: this.speedColor(speedColorValue),
            width: 18,
            float: "left"
            
            }} >&nbsp;</i> &nbsp;
          { speedColorLabels[speedColorValues.indexOf(speedColorValue)] } 
        </div>
        );
      }
      
      return <Control position="topright">
                  <div
                    style={{
                        backgroundColor: 'white',
                        padding: '5px',
                    }}
                > Speed (mph)
                { items }
                </div>
            </Control> 
    }
 
 
    const bounds =  null





    let selectedDirection =null;
    if (selectedRoute && selectedRoute.directions && directionId) {
      selectedDirection = selectedRoute.directions.find(dir => dir.id === directionId);
      this.sendRouteStopsToMap();
    }

    return (
      <div className={css`
          color: #fff;
          border-radius: 5px;
          padding: 10px;
          margin-right: 20px;
          grid-column: col1-start / col3-start;
          grid-row: row2-start ;
          font-family: 'Oswald', sans-serif;
      `
      }
      >
        <Card bg="light" style={{ color: 'black' }}>
          <Card.Header>Visualize Route</Card.Header>
          <DatePicker
            value={date}
            onChange={this.setDate}
            className={css`
           padding: 10px!important;
           display: block;
           width: 100%
         `}
          />
        <ListGroup.Item>
          <DropdownControl
            title="Time Range"
            name="time_range"
            variant="info"
            value={timeRange}
            onSelect={this.setTimeRange}
            options={
                [
                    {label:'All Day', key:''},
                    {label:'Daytime (7AM - 7PM)', key:'07:00-19:00'},
                    {label:'Early Morning (3AM - 7AM)', key:'03:00-07:00'},
                    {label:'AM Peak (7AM - 10AM)', key:'07:00-10:00'},
                    {label:'Midday (10AM - 4PM)', key:'10:00-16:00'},
                    {label:'PM Peak (4PM - 7PM)', key:'16:00-19:00'},
                    {label:'Late Evening (7PM - 3AM)', key:'19:00-03:00+1'},
                ]
        }
          />
        </ListGroup.Item>
          <ListGroup variant="flush">
            <div className="dropDownOverlay">
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
            </div>
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
                <div className="dropDownOverlay">
                  <ListGroup.Item>
                    <DropdownControl
                      title="From Stop"
                      name="stop"
                      variant="info"
                      value={firstStopId}
                      onSelect={(eventKey, name) => { return this.onSelectFirstStop(eventKey)}}
                      options={
                    (selectedDirection.stops || []).map(firstStopId => ({
                      label: (selectedRoute.stops[firstStopId] || { title: firstStopId }).title,
                      key: firstStopId,
                    }))
                  }
                    />
                  </ListGroup.Item>
                </div>
              ) : null
            }
            { (selectedDirection)
              ? (
                <div className="dropDownOverlay">
                  <ListGroup.Item>
                    <DropdownControl
                      title="To Stop"
                      name="stop"
                      variant="info"
                      value={secondStopId}
                      onSelect={(eventKey, name) => { return this.onSelectSecondStop(eventKey)}}
                      options={
                    (secondStopList || []).map(secondStopId => ({
                      label: (selectedRoute.stops[secondStopId] || { title: secondStopId }).title,
                      key: secondStopId,
                    }))
                  }
                    />
                  </ListGroup.Item>
                </div>
              ) : null
            }
          </ListGroup>
        </Card>




        <Card bg="light" style={{ color: 'black', width: '500px', height: '500px'}}>
          <Card.Header>Map <Button className="float-sm-right" onClick={this.handleGeoLocate}>Go to my location</Button></Card.Header>
          
      <Map
        style={{
          height:"500px" // was 40vh
        }}
        bounds={bounds}
        center={this.state.latLngOriginal}
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
          opacity={0.3}
        /> {/* see http://maps.stamen.com for details */}
        {/*marker*/}
        <DownstreamLine/>
        <RouteMarkers/>
        <StartMarkers/>
        { this.state.firstStopId ? <SpeedLegend/> : null }
       

      </Map>          
          
          <ListGroup variant="flush">
          <div className={css`max-height:300px; overflow:scroll;`}>
            <ListGroup.Item>
              <FromButtons/>
            </ListGroup.Item>
          </div>
          </ListGroup>
        </Card>
      </div>
    );
  }
}

ControlPanel.propTypes = {
  fetchGraphData: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => {
  return ({
    onRouteSelect: route => dispatch(handleRouteSelect(route))
  })
}
export default connect(null,mapDispatchToProps)(ControlPanel);
