import React, { Component, createRef, Fragment } from 'react';
import { css } from 'emotion';
import DatePicker from 'react-date-picker';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import PropTypes from 'prop-types';
//import { latLngBounds } from 'leaflet';
import * as d3 from "d3";

import DropdownControl from './DropdownControl';

import { Map, TileLayer, Popup, CircleMarker, Tooltip, Polyline } from 'react-leaflet'
import Control from 'react-leaflet-control'

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
      date: new Date('2019-04-08T03:50'),
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
      //if (!selectedRoute.directions) {
      
        // hack: if any route config is missing, get next config
        
        const { routes } = this.props;
        if (routes) {
          let i = 0;
          for (i = 0; i < routes.length; i++) { // optimize this on back end
            const route = routes[i];
            if (!route.directions) {
              this.props.fetchRouteConfig(route.id);
              break;
            }
          }
          
          if (i === routes.length) { // all routes loaded
            if (!this.state.directionId && selectedRoute.directions.length > 0) {
              this.setState({ directionId: selectedRoute.directions[0].id });
            }
          }
        }
      
        //original: this.props.fetchRouteConfig(this.state.routeId);
      //} else if (!this.state.directionId && selectedRoute.directions.length > 0) {
      //  this.setState({ directionId: selectedRoute.directions[0].id });
      //}
      
      
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
    const { directionId, secondStopId, startMarkers } = this.state;
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
    
    // if a starting stop is selected, hide mapping of other routes
    
    let newStartMarkers = [];
    if (startMarkers.length > 0) {
      const theSelectedStartMarker = startMarkers.find(startMarker => startMarker.routeID === selectedRoute.id &&
        startMarker.stopID === stopId);
      newStartMarkers = [ theSelectedStartMarker ];
    }
    
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
         const selectedRoute = this.props.routes.find(route => route.id === stop.routeID);
         
         const secondStopInfo = stop.direction;//this.getStopsInfoInGivenDirection(selectedRoute, stop.direction);
         const secondStopListIndex = secondStopInfo.stops.indexOf(stop.stopID);
         const secondStopList = secondStopInfo.stops.slice(secondStopListIndex /* + 1  include starting stop */);

        
         const downstreamStops = secondStopList.map(stopID => Object.assign(selectedRoute.stops[stopID], { stopID: stopID}));
         stop.downstreamStops = downstreamStops;
     }
    
    // to do: indicators for firstStop and secondStop 
     
     this.setState({ startMarkers: stops,
      });
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
      
      // no owls
      
      if ((route.title.indexOf("-Owl") > -1) ||
          (route.title.indexOf(" Owl") > -1)
          )
       { continue; }
      
      
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





  fakeSpeedColor(x) {
    return d3.interpolateRdGy(x);
  }
   
  fakeSpeed(i) {
    return Math.abs(i % 20 - 10)/10;
  }    

  fakeSpeedMax() {
    return 15;
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
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? selectedRoute.directions.find(dir => dir.id === directionId) : null;









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
               
        for (let i=0; i < downstreamStops.length-1; i++) {
          const latLngs = [[ downstreamStops[i].lat, downstreamStops[i].lon ],
                           [ downstreamStops[i+1].lat, downstreamStops[i+1].lon ]];
        
          // base polyline is in line color
          
          polylines.push(
            <Polyline
              key={"poly-" + startMarker.routeID + "-" + downstreamStops[i].stopID} 
              positions = { latLngs }
              color = { /*firstStopId ? this.fakeSpeedColor(this.fakeSpeed(i)) :*/ lineColor } // sawtooth wave from 0-10 for fake speed
              opacity = { firstStopId || this.state.hoverMarker === startMarker ? 0.5 : 0.5 } // if a first stop is selected use full opacity?
              weight = { firstStopId ? 12 : 4 } // if a first stop is selected use extra weight
              onMouseOver = { e => {

                if (!firstStopId) { e.target.setStyle({opacity:1, weight:6}); }
                                
                /*this.setState({
                  //hoverMarker: startMarker,
                  infoValue: startMarker.routeTitle + " - " + startMarker.direction.title
                });*/

                return true;
                }
              }
              onMouseOut = { e => {
                  if (!firstStopId) { e.target.setStyle({opacity:0.5, weight:4}); }                
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
            { firstStopId ? // if route was selected, show speed 
              <Tooltip>
                 { this.fakeSpeed(i) * this.fakeSpeedMax() } mph
              </Tooltip>
             :  // otherwise show route title
              <Tooltip>
                 {startMarker.routeTitle}<br/>{startMarker.direction.title}
              </Tooltip>
            }
            
            </Polyline>);

        } // end for
        } else {
        
        // joined polyline as base
        
          let latLngs = [];
          for (let i=0; i < downstreamStops.length; i++) {
            latLngs.push([ downstreamStops[i].lat, downstreamStops[i].lon ]);
          }
        
          // base polyline is in line color
          
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
            

          // inner line for showing speed            
            
          if (firstStopId) {  
          polylines.push(
            <Polyline
              key={"poly-speed-" + startMarker.routeID + "-" + downstreamStops[i].stopID} 
              positions = { latLngs }
              color = { this.fakeSpeedColor(this.fakeSpeed(i))  } // sawtooth wave from 0-10 for fake speed
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
                 { this.fakeSpeed(i) * this.fakeSpeedMax() } mph
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

      if (!this.state.firstStopId) { return null; }

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
          radius= { routeMarker === this.state.routeMarkers[this.state.routeMarkers.length-1] ? 4 : 4 } // last stop is bigger?
          onClick={e => {
              e.originalEvent.view.L.DomEvent.stopPropagation(e)          
              this.onSelectSecondStop(routeMarker.stopID);
            }
          }>
          
          { firstStopId ?  // show stop title if route is selected 
          <Tooltip>
          { routeMarker.stop.title
          }
          </Tooltip>          
          : null }
        </CircleMarker>
      });
      return <Fragment>{items}</Fragment>
    }

 
    const FromButtons = () => {
    
    return null; // don't need these?  

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
    }
    
    const FakeLegend = () => {
    
      let items = [];
                
      const fakeColorValues = [0, 0.25, 0.50, 0.75, 1.0];
      
      for (let fakeColorValue of fakeColorValues) {
        items.push(
        <div key={fakeColorValue}>
          <i style={{
            backgroundColor: this.fakeSpeedColor(fakeColorValue),
            width: 18,
            float: "left"
            
            }} >&nbsp;</i> &nbsp;
          { Math.round(fakeColorValue * this.fakeSpeedMax(), 1) }
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
    /*(this.state.startMarkers.length > 1 || this.state.routeMarkers.length > 1) ?
      latLngBounds([...this.state.startMarkers, ...this.state.routeMarkers].map(marker =>
        [marker.stop.lat, marker.stop.lon])).pad(0.1) : null;*/

 













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




        <Card bg="light" style={{ color: 'black' }}>
          <Card.Header>Map <Button className="float-sm-right" onClick={this.handleGeoLocate}>Go to my location</Button></Card.Header>
          
      <Map
        style={{
          height:"40vh"
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
        { this.state.firstStopId ? <FakeLegend/> : null }
       

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

export default ControlPanel;
