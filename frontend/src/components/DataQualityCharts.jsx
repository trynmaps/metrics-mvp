import React, { useState, useEffect } from 'react';
import { Card, Container, Row, Col } from 'react-bootstrap';
import * as d3 from "d3";

import { XYPlot, HorizontalGridLines, VerticalGridLines,
  XAxis, YAxis,
  LineSeries, CustomSVGSeries, ChartLabel, Crosshair } from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import '../../node_modules/react-vis/dist/style.css';
import { filterRoutes, filterDirections, ignoreFirstStop, ignoreLastStop } from '../helpers/routeCalculations'

import { getWaitTimeForDirection, getTripTimesForDirection, getAverageOfMedianWait } from '../helpers/precomputed';
import { connect } from 'react-redux';

import { fetchPrecomputedWaitAndTripData } from '../actions';


  /**
   * Helper function to find the precomputed trip times for the first stop.  
   */
function getTripTimesForFirstStop(tripTimesCache, graphParams, routes, routeID, directionID) {
      
      
    const tripTimesForDir = getTripTimesForDirection(tripTimesCache, graphParams, routeID, directionID);
      
    if (!tripTimesForDir) {
      console.log("No trip times found for " + directionID); // happens for T inbound as it was temporarily shortened
      // not sure if we should remap to normal terminal
      return {tripTimesForFirstStop: null, directionInfo: null};
    }
    //console.log('trip times for dir: ' + Object.keys(tripTimesForDir).length + ' keys' );

    // need first and last stop on this dir
    //
    // note: some routes do not run their full length all day like the 5 Fulton, so they
    // don't go to all the stops.  Ideally should figure out which ones they do go to.
    // Metrics api just gives us network error when there's no data between two stops.

    const route = routes.find(route => route.id === routeID);
    const directionInfo = route.directions.find(direction => direction.id === directionID);

    const ignoreFirst = ignoreFirstStop(routeID, directionID);
    let firstStop = null;
    
    if (Number.isInteger(ignoreFirst)) {
      firstStop = ignoreFirst; // see note where ignoreLastStop is used
    } else {
      firstStop = directionInfo.stops[ ignoreFirst ? 1 : 0];
    }

    let tripTimesForFirstStop = tripTimesForDir[firstStop];
    
    // if this stop doesn't have trip times (like the oddball J direction going to the yard, which we currently ignore)
    // then find the stop with the most trip time entries
    
    if (!tripTimesForFirstStop) {
      console.log("No trip times found for " + firstStop + ".  Using stop with most entries.");
      tripTimesForFirstStop = Object.values(tripTimesForDir).reduce((accumulator, currentValue) =>
         Object.values(currentValue).length > Object.values(accumulator).length ? currentValue : accumulator, {});
    }
    
    return {tripTimesForFirstStop, directionInfo};
  }

  /**
   * Returns trip time across the full route.
   */
  function getTripTime(props, routeID, directionID) {
    
    const {tripTimesForFirstStop, directionInfo} = getTripTimesForFirstStop(props.tripTimesCache, props.graphParams, props.routes, routeID, directionID);
    
    if (!tripTimesForFirstStop) { // no precomputed times
      console.log("No precomputed trip time for " + routeID + " " + directionID);
      return "?";
    }
    
    const ignoreLast = ignoreLastStop(routeID, directionID);
    
    let lastStop = null;
    
    /*
     * For determining end to end trip time, but doesn't currently affect computation of route length, 
     * which is based on best guess as to the right GTFS shape. And the shape is not linked to the stops,
     * it's just coordinates and distance along route, so more logic would be needed to "trim" the shape
     * if stops are ignored.
     */
    if (Number.isInteger(ignoreLast)) {
      lastStop = ignoreLast;
    } else {
      lastStop = directionInfo.stops[directionInfo.stops.length - (ignoreLast ? 2 : 1)];
    }

    //console.log('found ' + Object.keys(tripTimesForFirstStop).length + ' keys' );

    let tripTime = tripTimesForFirstStop[lastStop];
    
    // again, if we can't find the last stop, then use the highest trip time actually observed
    
    if (!tripTime) {
      console.log("No trip time found for " + routeID + " " + directionID + " " + lastStop);
      debugger;
      tripTime = Math.max(...Object.values(tripTimesForFirstStop))
    }

    //console.log('trip time in minutes is ' + tripTime);
    return tripTime;
  }

  /**
   * Similar to previous function, but returns an array of {x: stop index, y: time} objects for
   * plotting on a chart.
   */
  function getTripData(props, routeID, directionID) {
    const {tripTimesForFirstStop, directionInfo} = getTripTimesForFirstStop(props.tripTimesCache, props.graphParams, props.routes, routeID, directionID);

    if (!tripTimesForFirstStop) { return []; } // no precomputed times

    const route = props.routes.find(route => route.id === routeID);
    
    // TODO; take into account possible skipping for first and last stop
    
    const dataSeries = directionInfo.stops.map((stop, index) => { return {
      x: index,
      y: tripTimesForFirstStop[stop] ? tripTimesForFirstStop[stop] : 0,
      title: route.stops[stop].title
    }});
    
    return dataSeries;
  } 

  /**
   * Get wait times along a route in one direction.
   * todo: replace with use of precomputed
   */
function getWaitData(waitTimesCache, graphParams, routes, routeID, directionID) {
    
    const waitTimeForDir = getWaitTimeForDirection(waitTimesCache, graphParams, routeID, directionID);

    if (!waitTimeForDir) {
      return [];
    }
    
    const route = routes.find(route => route.id === routeID);
    const directionInfo = route.directions.find(direction => direction.id === directionID);

    const dataSeries = directionInfo.stops.map((stop, index) => { return {
      x: index,
      y: waitTimeForDir[stop] ? waitTimeForDir[stop] : 0
    }});
    
    return dataSeries;
  }

  
  function DataQualityCharts(props) {
      
      /**
       * Event handler for onMouseLeave.
       * @private
       */
     const _onMouseLeave = () => {
        setCrosshairValues([]);
      };

      /**
       * Event handler for onNearestX.
       * @param {Object} value Selected value.
       * @param {index} index Index of the value in the data array.
       * @private
       */
      const _onNearestTripX = (value, {index}) => {
        setCrosshairValues([ value /* future:  how to add scheduleData[index] ? */]);
      };  

      
      const _onNearestWaitX = (value, {index}) => {
        setWaitCrosshairValues([ value ]);
      };  
      
    const [crosshairValues, setCrosshairValues] = useState([]);
    const [waitCrosshairValues, setWaitCrosshairValues] = useState([]);

    useEffect(() => {
        props.fetchPrecomputedWaitAndTripData(props.graphParams);
      }, []);  // like componentDidMount, this runs only on first render    
    
    const { graphParams, shapes, trips, routes } = props;

    // if we have a route, try to find its shape
    // to do this, convert route id to gtfs route id, and parse the direction to get just the terminal
    // then find a corresponding row in trips.  There are 30k trips so these should be indexed or deduped.
    // any valid trip will give us a shape id (although there can be multiple shapes, like when a route
    // starts out of a yard).
    // finally, search the shapes to get distance along route (use longest shape)
    
    let tripTime = null;
    let tripData = null;
    let waitData = null;
    
    let quadrantData = null;
    let route = null;
      
    if (graphParams.route_id && graphParams.direction_id) {

      let routes = props.routes ? filterRoutes(props.routes) : [];
      
      routes = routes.map(route => {
          route.wait = getAverageOfMedianWait(props.waitTimesCache, props.graphParams, route);     
          return route;
        });      
        
      const route_id = graphParams.route_id;
      const direction_id = graphParams.direction_id;
      
      tripTime = getTripTime(props, route_id, direction_id);

      route = routes.find(route => route.id === route_id);
    
      tripData = getTripData(props, route_id, direction_id);
      //const scheduleData = getDummyScheduleData(route_id, direction_id, routes, tripTimes);

      waitData = getWaitData(props.waitTimesCache, graphParams, routes, route_id, direction_id);
      
      // experimental quadrant data

      /*
      quadrantData = allSpeeds.map(speed => { return {
        x: routes.find(route => route.id === speed.routeID).wait,
        y: speed.speed,
        title: speed.routeID,
      }});
      */
    }

    const legendItems = [
      //{ title: 'Scheduled', color: "#a4a6a9", strokeWidth: 10 },  
      { title: 'Actual',   color: "#aa82c5", strokeWidth: 10 }
    ];
    
    
    return (grades ? <Card><Card.Body>
            
              <span className="h4">Route Summary: </span>
    
            
            <br/>
            
            <Container>
            <Row>
            <Col>
            
            <Card bg="info" text="white">
            <Card.Body>
            <Card.Title>Average wait</Card.Title>
            <span className="h1">{ route.wait < 0 ? "?" : route.wait.toFixed(0) } minutes</span>
            
            <br/>
            
            </Card.Body>
            </Card>
            
            <Card bg="info" text="white" className="mt-2">
            <Card.Body>
            
            <br/>
            Travel time: { tripTime } minutes<br/>
            </Card.Body>
            </Card>
            </Col>

            <Col xs>

            
            
            
            {/* experimental quadrant chart */}
{/*            
            <XYPlot height={800} width={1200} xDomain={[30, 0]} yDomain={[0, 15]}>
            <HorizontalGridLines />
            <VerticalGridLines />
            <XAxis top={400} style={{ text: {stroke: 'none', fill: '#cccccc'}}} />
            <YAxis left={600} style={{ text: {stroke: 'none', fill: '#cccccc'}}} />

            
            <CustomSVGSeries
            className="custom-marking"
            customComponent={(row, positionInPixels) => {
              return (
                <g className="inner-inner-component">
                  <circle cx="0" cy="0" r={row.size || 3} fill="#aa82c5" />
                  <text x={parseInt(Math.random()*10.0)} y={parseInt(Math.random()*10.0)} fontSize="75%" fill="#450042">
                    <tspan x="5" y={parseInt(Math.random()*15.0)-3}>{`${row.title}`}</tspan>
                  </text>
                </g>
              );
    }}
     data={quadrantData}
  />


            <ChartLabel 
              text="speed (mph)"
              className="alt-y-label"
              includeMargin={false}
              xPercent={0.54}
              yPercent={0.06}
              style={{
                transform: 'rotate(-90)',
                textAnchor: 'end'
              }}       
            />
            
            <ChartLabel 
            text="avg wait (min)"
            className="alt-x-label"
            includeMargin={false}
            xPercent={0.94}
            yPercent={0.50}
            />       
            

          </XYPlot>

            
*/}            
            { /* end experimental quadrant chart */ }
            
            
            
            <Card>
            <Card.Body>
            <Card.Title>Travel time across stops</Card.Title>
            
            
            
            <XYPlot height={300} width={400} >
            <HorizontalGridLines />
            <VerticalGridLines />
            <XAxis />
            <YAxis hideLine />

            <LineSeries data={ tripData }
               stroke="#aa82c5"
               strokeWidth="4"
               onNearestX={_onNearestTripX} />
            {/*<LineSeries data={ scheduleData }
               stroke="#a4a6a9"
               strokeWidth="4"
               style={{
                 strokeDasharray: '2 2'
               }}             
            />*/}

            <ChartLabel 
              text="minutes"
              className="alt-y-label"
              includeMargin={false}
              xPercent={0.06}
              yPercent={0.06}
              style={{
                transform: 'rotate(-90)',
                textAnchor: 'end'
              }}       
            />       

            { crosshairValues.length > 0 && (
             <Crosshair values={crosshairValues}
               style={{line:{background: 'none'}}} >
                    <div className= 'rv-crosshair__inner__content'>
                      <p>Actual: { Math.round(crosshairValues[0].y)} min</p>
                      {/*<p>Scheduled: { Math.round(crosshairValues[1].y)} min</p>*/}
                      <p>{crosshairValues[0].title}</p>
                    </div>                 
            </Crosshair>)}

          </XYPlot>
          <DiscreteColorLegend orientation="horizontal" width={300} items={legendItems}/>
            
          </Card.Body>
          </Card>

            
            

          <Card>
          <Card.Body>
          <Card.Title>Wait time across stops</Card.Title>
          
          
          
          <XYPlot height={300} width={400} yDomain={[0, 30]}>
          <HorizontalGridLines />
          <VerticalGridLines />
          <XAxis />
          <YAxis hideLine />

          <LineSeries data={ waitData }
             stroke="#aa82c5"
             strokeWidth="4"
             onNearestX={_onNearestWaitX} />

          <ChartLabel 
            text="minutes"
            className="alt-y-label"
            includeMargin={false}
            xPercent={0.06}
            yPercent={0.06}
            style={{
              transform: 'rotate(-90)',
              textAnchor: 'end'
            }}       
          />       

          { waitCrosshairValues.length > 0 && (
           <Crosshair values={ waitCrosshairValues}
             style={{line:{background: 'none'}}} >
                  <div className= 'rv-crosshair__inner__content'>
                    <p>Wait: { Math.round(waitCrosshairValues[0].y)} min</p>
                  </div>                 
          </Crosshair>)}

        </XYPlot>
          
        </Card.Body>
        </Card>
            
            
            
          </Col>
            
          </Row>  
          </Container>

            
          </Card.Body></Card>            

    : null);
  }

const mapStateToProps = state => ({
  graphParams: state.routes.graphParams,
  waitTimesCache: state.routes.waitTimesCache,
  tripTimesCache: state.routes.tripTimesCache,
});

const mapDispatchToProps = dispatch => {
  return ({
    fetchPrecomputedWaitAndTripData: params => dispatch(fetchPrecomputedWaitAndTripData(params)),
  })
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DataQualityCharts);