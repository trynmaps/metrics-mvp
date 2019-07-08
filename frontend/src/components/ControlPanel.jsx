import React, { Component, createRef, Fragment } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import DatePicker from 'react-date-picker';
import Button from 'react-bootstrap/Button';
//import { latLngBounds } from 'leaflet';
import { filterRoutes, milesBetween } from '../helpers/routeCalculations';

import * as d3 from "d3";
import {handleRouteSelect} from '../actions';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import PropTypes from 'prop-types';
import { handleGraphParams } from '../actions';

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

  setDate = date => this.props.onGraphParams({ date: date });

  setTimeRange = timeRange => {
    if (!timeRange) {
      this.props.onGraphParams({ start_time: null, end_time: null });
    } else {
      var timeRangeParts = timeRange.split('-');
      this.props.onGraphParams({ start_time: timeRangeParts[0], end_time: timeRangeParts[1] });
    }
  }

  setRouteId = routeId => {
    this.selectedRouteChanged(routeId);
  };

  setDirectionId = directionId => this.props.onGraphParams({
    direction_id: directionId,
    start_stop_id: null,
    end_stop_id: null,
  });

  generateSecondStopList(selectedRoute, directionId, stopId) {
    const secondStopInfo = this.getStopsInfoInGivenDirection(selectedRoute, directionId);
    const secondStopListIndex = stopId ? secondStopInfo.stops.indexOf(stopId) : 0;
    return secondStopInfo.stops.slice(secondStopListIndex + 1);
  }
  
  onSelectFirstStop = (stopId, optionalSecondStopId) => {
    const directionId = this.props.graphParams.direction_id;
    const secondStopId = this.props.graphParams.end_stop_id;
    const selectedRoute = { ...this.getSelectedRouteInfo() };
    const secondStopList = this.generateSecondStopList(selectedRoute, directionId, stopId);

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
    this.props.onGraphParams({ start_stop_id: stopId, end_stop_id: newSecondStopId});
  }

  onSelectSecondStop = (stopId) => {
    this.props.onGraphParams({ end_stop_id: stopId });
  }

  selectedRouteChanged = (routeId) => {
      
    const selectedRoute = this.props.routes ? this.props.routes.find(route => route.id === routeId) : null;

    if (!selectedRoute) {
      return;
    }

    const directionId = selectedRoute.directions.length > 0 ? selectedRoute.directions[0].id : null;
    //console.log('sRC: ' + selectedRoute + ' dirid: ' + directionId);
    
    this.props.onGraphParams({ route_id: routeId, direction_id: directionId, start_stop_id: null, end_stop_id: null });
  }

  getStopsInfoInGivenDirection = (selectedRoute, directionId) => {
    return selectedRoute.directions.find(dir => dir.id === directionId);
  }

 
  /* this code attempts to preserve the from stop if the direction changes 
  
   * the from stop is in the new stop list.  It doesn't check the to stop, so
   * either it needs to do that, or we bypass this and just always clear both
   * stops on a direction change.

  selectedDirectionChanged = () => {
    const firstStopId = this.props.graphParams.start_stop_id;
    const directionId = this.props.graphParams.direction_id;
    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? this.getStopsInfoInGivenDirection(selectedRoute, directionId) : null;
      
    const startMarkerArray = this.createStartMarkerForOneRoute(this.state.routeId, directionId);
    
    // there's logic here to preserve the first stop when changing directions, not sure how often
    // that is actually the case.  Keeping for now.
    
    if (firstStopId) {
      if (!selectedDirection || selectedDirection.stops.indexOf(firstStopId) === -1) {
        this.props.onGraphParams({ start_stop_id: null, end_stop_id: null });
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
     */

  getSelectedRouteInfo() {
    const { routes } = this.props;
    const routeId = this.props.graphParams.route_id;
    return routes ? routes.find(route => route.id === routeId) : null;
  }




  speedColor(mph) {
  return d3.scaleQuantize().domain([2.5,12.5]).range(["#9e1313", "#e60000", "#f07d02", "#84ca50"])(mph);
//  return d3.scaleQuantize().domain([0, 4]).range(d3.schemeSpectral[5])(mph/this.speedMax()*5);
//    return d3.interpolateRdGy(mph/this.speedMax() /* scale to 0-1 */);
  }
   
  speedMax() {
    return 15;
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
    
    const distance = milesBetween(firstStop, nextStop);
    
    return distance/time * 60; // mph 
  }


  render() {
    const { routes, graphParams } = this.props;

    const timeRange = (graphParams.start_time || graphParams.end_time) ? (graphParams.start_time + '-' + graphParams.end_time) : '';

    const selectedRoute = this.getSelectedRouteInfo();
    
    const firstStopId = graphParams.start_stop_id;

    // now defined further down const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
    //  ? selectedRoute.directions.find(dir => dir.id === directionId) : null;









    // possible first stops near click or current location
    
    const StartMarkers = () => {  

        
      let items = null;
        
      if (this.props.spiderSelection) {
        items = this.props.spiderSelection.map((startMarker, index) => {        

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
      }
      return <Fragment>{items}</Fragment>
    }
    
    const routeColor = d3.scaleQuantize([0,9], d3.schemeCategory10);
    
    const DownstreamLine = () => {  

      // for each start marker

        
      let items = null;
       
      if (this.props.spiderSelection) {
        items = this.props.spiderSelection.map(startMarker => {        
        const downstreamStops = startMarker.downstreamStops;
        const lineColor = routeColor(startMarker.routeIndex % 10); 
        
        const polylines = [];
        
        // Add a base polyline connecting the stops.  One polyline between each stop gives better tooltips
        // when selecting a line.  Once a line is selected, looks better to have a monolithic polyline.
  
  
        if (!firstStopId) {  

        
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
    }
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





    let selectedDirection = null;
    if (selectedRoute && selectedRoute.directions && graphParams.direction_id) {
      selectedDirection = selectedRoute.directions.find(dir => dir.id === graphParams.direction_id);
    }
    
    let secondStopList = null;
    if (selectedDirection) {
      secondStopList = this.generateSecondStopList(selectedRoute, graphParams.direction_id, graphParams.start_stop_id);
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
            { /* The date picker is broken because we're no longer passing in a date in the format
                 it expects.  To be replaced with a new Material UI component.
          <DatePicker
            value={graphParams.date}
            onChange={this.setDate}
            className={css`
           padding: 10px!important;
           display: block;
           width: 100%
         `}
          />  */ }
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
                  value={graphParams.route_id}
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
                    value={graphParams.direction_id}
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
                      value={graphParams.start_stop_id}
                      onSelect={this.onSelectFirstStop}
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
                      value={graphParams.end_stop_id}
                      onSelect={this.onSelectSecondStop}
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
        center={ {lat : 37.7793, lng: -122.4193} }
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
        {/*<RouteMarkers/>*/}
        <StartMarkers/>
        { this.props.graphParams.start_stop_id ? <SpeedLegend/> : null }
       

      </Map>          
          
        </Card>
      </div>
    );
  }
}

ControlPanel.propTypes = {
  fetchGraphData: PropTypes.func.isRequired,
};

// for this entire component, now using graphParams values in Redux instead of local state.
const mapStateToProps = state => ({
  graphParams: state.routes.graphParams
});

const mapDispatchToProps = dispatch => {
  return ({
    onGraphParams: params => dispatch(handleGraphParams(params)),
  })
}

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanel);
