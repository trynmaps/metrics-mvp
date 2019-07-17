import React, { useState, useEffect } from 'react';
import { Card, Container, Row, Col } from 'react-bootstrap';

import { XYPlot, HorizontalGridLines, VerticalGridLines,
  XAxis, YAxis, LineSeries, ChartLabel, Crosshair } from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import '../../node_modules/react-vis/dist/style.css';
import { filterRoutes, filterDirections, ignoreFirstStop, ignoreLastStop,
  getAllDistances, getAllSpeeds, getAllScores, getEndToEndTripTime,
  getTripDataSeries, computeGrades } from '../helpers/routeCalculations'

import { getTripTimesForDirection, getAverageOfMedianWait } from '../helpers/precomputed';
import { connect } from 'react-redux';

import { fetchPrecomputedWaitAndTripData } from '../actions';


/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 * 
 * @param {any} props
 */
function RouteSummary(props) {
  
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
  
  const [crosshairValues, setCrosshairValues] = useState([]);
  
  useEffect(() => {
    props.fetchPrecomputedWaitAndTripData(props.graphParams);
    //props.fetchAllTheThings();
  }, []);  // like componentDidMount, this runs only on first render    
  
  const { graphParams, routes } = props;
  
  let speed = null;
  let dist = null;
  let tripTime = null;
  let waitRanking = null;
  let speedObj = null;
  let speedRanking = null;
  let grades = null;
  let scoreObj = null;
  let scoreRanking = null;
  let allSpeeds = null;
  let allScores = null;
  let tripData = null;
  
  let route = null;
  
  if (graphParams.route_id && graphParams.direction_id) {
    
    let routes = props.routes ? filterRoutes(props.routes) : [];
    
    routes = routes.map(route => {
      route.wait = getAverageOfMedianWait(props.waitTimesCache, props.graphParams, route);     
      return route;
    });      
    
    const allDistances = getAllDistances();
    allSpeeds = getAllSpeeds(props, allDistances);
    allScores = getAllScores(routes, allSpeeds);
    
    const route_id = graphParams.route_id;
    const direction_id = graphParams.direction_id;
    
    const distObj = allDistances.find(distObj => distObj.routeID === route_id);
    dist = distObj ? distObj.distance : null;

    tripTime = getEndToEndTripTime(props, route_id, direction_id);
    
    if (dist <= 0 || isNaN(tripTime)) { speed = "?"; } // something wrong with the data here
    else {
      speed = Number.parseFloat(dist) / tripTime * 60.0 / 1609.344;  // initial units are meters per minute, final are mph
      //console.log('speed: ' + speed + " tripTime: " + tripTime);
    }
    
    route = routes.find(route => route.id === route_id);
    
    routes.sort((a,b) => { return b.wait - a.wait});
    waitRanking = routes.length - routes.indexOf(route); // invert wait ranking to rank for shortest wait time
    
    speedObj = allSpeeds.find(obj => obj.routeID === route_id);
    speedRanking = speedObj ? allSpeeds.indexOf(speedObj) + 1 : null;
    
    scoreObj = allScores.find(obj => obj.routeID === route_id);
    scoreRanking = scoreObj ? allScores.indexOf(scoreObj) + 1 : null;
    
    
    tripData = getTripDataSeries(props, route_id, direction_id);
    
    grades = computeGrades(route.wait, speed);
  }
  
  const legendItems = [
                       //{ title: 'Scheduled', color: "#a4a6a9", strokeWidth: 10 },  
                       { title: 'Actual',   color: "#aa82c5", strokeWidth: 10 }
                       ];
  
  // TODO: change from Bootstrap components to Material UI
  
  return (grades ? <Card><Card.Body>
            
      <span className="h4">Route Summary: </span>
      <span className="h1">{grades.totalGrade}</span>
     
        { scoreRanking ? ` (#${scoreRanking} of ${allScores.length} for best score)` : null }
        { scoreRanking ? <small>&nbsp;({grades.totalScore}/{grades.highestPossibleScore})</small>
            : " ranking not available"}
            
      <br/>
            
        <Container>
        <Row>
        <Col>
            
            <Card bg="info" text="white">
            <Card.Body>
            <Card.Title>Median wait</Card.Title>
            <span className="h1">{ route.wait < 0 ? "?" : route.wait.toFixed(0) } minutes</span>
            
            <br/>
            
            { waitRanking ? ` (#${waitRanking} of ${routes.length} for shortest wait)` : null }
            { waitRanking ? <small>&nbsp;({ grades.medianWaitScore }/100)</small>
                : " ranking not available"}

            
            

            </Card.Body>
            </Card>
            
            <Card bg="info" text="white" className="mt-2">
            <Card.Body>
            <Card.Title>Median speed</Card.Title>
            <span className="h1">{ isNaN(speed) ? speed : speed.toFixed(1) } mph</span>
            
            <br/>
            
            { speedRanking ? ` (#${speedRanking} of ${allSpeeds.length} for fastest)` : null }
            { speedRanking ? <small>&nbsp;({ grades.speedScore }/100)</small> : " ranking not available"}
            

            
            <br/>

            Length: { (dist / 1609.344).toFixed(1) } miles
            
            <br/>
            Travel time: { tripTime } minutes<br/>
            </Card.Body>
            </Card>
        </Col>

        <Col xs>


            <Card>
            <Card.Body>
            <Card.Title>Travel time across stops</Card.Title>
            
            
            
            <XYPlot height={300} width={400} onMouseLeave={_onMouseLeave}>
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
                      <p>{ Math.round(crosshairValues[0].y)} min</p>
                      {/*<p>Scheduled: { Math.round(crosshairValues[1].y)} min</p>*/}
                      <p>{crosshairValues[0].title}</p>
                    </div>                 
            </Crosshair>)}

          </XYPlot>
          <DiscreteColorLegend orientation="horizontal" width={300} items={legendItems}/>
            
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
)(RouteSummary);