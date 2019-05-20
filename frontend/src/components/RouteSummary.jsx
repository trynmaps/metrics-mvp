import React, { Component } from 'react';
import { css } from 'emotion';
import { BarChart } from 'react-d3-components';
import { Card, Container, Row, Col } from 'react-bootstrap';
import * as d3 from "d3";

import { XYPlot, HorizontalGridLines, VerticalGridLines, XAxis, YAxis,
  LineSeries, ChartLabel, Crosshair } from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
  
class RouteSummary extends Component {
  constructor(props) {
    super(props);
    this.state = { crosshairValues: [] };
  }

  findGtfsRouteID(route_id) {
    // what we call "route_id" is the GTFS route_short_name

    // owl ids in gtfs are like N-OWL, in routes it's N_OWL
    const fixedRouteID = route_id.replace(/_/, "-");   
    const routeRecord = this.props.routeCSVs.find(routeCSV => routeCSV.route_short_name === fixedRouteID);
    
    if (!routeRecord) {
      return null;
    }
    return routeRecord.route_id;
  }

  findTerminal(route_id, direction_id) {
    const route = this.props.routes.find(route => route.id === route_id);
    console.log("looking for direction of " + direction_id);
    const directionInfo = route.directions.find(direction => direction.id === direction_id);
    const terminal = directionInfo.title.substr(directionInfo.name.length + " to ".length);
    return terminal;
  }

  /**
   * Gets the longest known distance for the selected route and direction.
   */
  getRouteDistanceInMeters(routeID, directionID, trips, shapes) {
    const gtfsRouteID = this.findGtfsRouteID(routeID);
    console.log('found gtfsRouteID of: ' + gtfsRouteID);
    
    if (gtfsRouteID == null) { return 0; }

    const terminal = this.findTerminal(routeID, directionID);
    console.log('found terminal of: ' + terminal);

    // find any shapes with the same route and terminal

    const shapeCandidates = trips.reduce((total, currentValue, currentIndex, arr) => {
      if (currentValue.route_id === gtfsRouteID && currentValue.trip_headsign === terminal) {
        total[currentValue.shape_id] = true;
        return total;
      } else {
        return total;
      }
    }, {});

    console.log('found shape candidates of: ' + Object.keys(shapeCandidates).toString());

    // find shapes that match this shape id, get largest (some shapes start at a yard in the middle of a route)
    const distByShape = shapes.reduce((total, currentValue, currentIndex, arr) => {
      if (shapeCandidates[currentValue.shape_id] && (!total[currentValue.shape_id] ||
          parseInt(currentValue.shape_dist_traveled) > total[currentValue.shape_id])) {
        total[currentValue.shape_id] = currentValue.shape_dist_traveled;
        return total;
      } else {
        return total;
      } 
    }, {});

    console.log('Found distances of: ' + Object.values(distByShape).toString());

    // probably should be using Math.max here
    const maxDist = Object.values(distByShape).reduce((total, currentValue, currentIndex, arr) => {
      if (parseInt(currentValue) > parseInt(total)) { return currentValue} else {
        return total;
      }
    }, 0);
    console.log('dist in meters is : ' + maxDist);
    return maxDist;
  }

  /**
   * Helper function to find the precomputed trip times for the first stop.  
   */
  getTripTimesForFirstStop(routeID, directionID, routes, tripTimes) {
    const tripTimesForRoute = tripTimes[routeID];
    
    if (!tripTimesForRoute) { // this route probably wasn't running during precompute window
      return {tripTimesForFirstStop: null, directionInfo: null};
    }
    
    const tripTimesForDir = tripTimesForRoute[directionID];
    console.log('trip times for dir: ' + Object.keys(tripTimesForDir).length + ' keys' );

    // need first and last stop on this dir
    //
    // note: some routes do not run their full length all day like the 5 Fulton, so they
    // don't go to all the stops.  Ideally should figure out which ones they do go to.
    // Metrics api just gives us network error when there's no data between two stops.

    const route = this.props.routes.find(route => route.id === routeID);
    const directionInfo = route.directions.find(direction => direction.id === directionID);

    const firstStop = directionInfo.stops[0];
    const lastStop = directionInfo.stops[directionInfo.stops.length - 1];

    const tripTimesForFirstStop = tripTimesForDir[firstStop];
    return {tripTimesForFirstStop, directionInfo};
  }

  /**
   * Returns trip time across the full route.
   */
  getTripTime(routeID, directionID, routes, tripTimes) {
    
    const {tripTimesForFirstStop, directionInfo} = this.getTripTimesForFirstStop(routeID, directionID, routes, tripTimes);
    
    if (!tripTimesForFirstStop) { return -1; } // no precomputed times
    
    const lastStop = directionInfo.stops[directionInfo.stops.length - 1];

    console.log('found ' + Object.keys(tripTimesForFirstStop).length + ' keys' );

    const tripTime = tripTimesForFirstStop[lastStop];

    console.log('trip time in minutes is ' + tripTime);
    return tripTime;
  }

  /**
   * Similar to previous function, but returns an array of {x: stop index, y: time} objects for
   * plotting on a chart.
   */
  getTripData(routeID, directionID, routes, tripTimes) {
    const {tripTimesForFirstStop, directionInfo} = this.getTripTimesForFirstStop(routeID, directionID, routes, tripTimes);

    const dataSeries = directionInfo.stops.map((stop, index) => { return {
      x: index,
      y: tripTimesForFirstStop[stop] ? tripTimesForFirstStop[stop] : 0
    }});
    
    return dataSeries;
  } 

  getDummyScheduleData(routeID, directionID, routes, tripTimes) {
    const {tripTimesForFirstStop, directionInfo} = this.getTripTimesForFirstStop(routeID, directionID, routes, tripTimes);

    const dataSeries = directionInfo.stops.map((stop, index) => { return {
      x: index,
      y: tripTimesForFirstStop[stop] ? tripTimesForFirstStop[stop] * 0.9 : 0
    }});
    
    return dataSeries;
  } 

  
  /**
   * Returns wait times for all directions
   */
  getWaitTime(routeID, waitTimes) {

    const route = this.props.routes.find(route => route.id === routeID);
    let totalWait = 0;
    let totalStops = 0;
    for (let direction of route.directions) {
      const result = this.getWaitTimeForDir(direction.id, waitTimes);
      totalWait += result.wait;
      totalStops += result.stops;
    }
    if (totalStops > 0) {
      return totalWait/totalStops;
    } else {
      return -1;
    }
  }

  /**
   * Summarizes waits in one direction.
   */
  getWaitTimeForDir(directionID, waitTimes) {
    const waitTimeForDir = waitTimes[directionID];

    if (!waitTimeForDir) {
      return {wait:0 ,stops: 0};
    }
    const totalWait = Object.values(waitTimeForDir).reduce((total, currentValue, currentIndex, arr) => {
      return total + currentValue;
    }, 0);

    return {wait: totalWait, stops: Object.values(waitTimeForDir).length};
  }

  
  
  
  
  getAllWaits() {  
  /**
   *  This is the temporary code used to generate the allWaits array below.
   *  
   
  if (graphData) {
    let allWaits = routes.map(route => {
      return { routeID: route.id, wait: this.getWaitTime(route.id, waitTimes) }
    });
    allWaits = allWaits.filter(waitObj => waitObj.wait > 0);
    allWaits.sort((a,b) => { return b.wait - a.wait});
    console.log(JSON.stringify(allWaits));
  }*/
  
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
  
  getSpeedForRoute(route_id, routes, trips, shapes, tripTimes) { // all directions
    const route = routes.find(route => route.id === route_id);
    
    const speeds = route.directions.map(direction => {
      const dist = this.getRouteDistanceInMeters(route.id, direction.id, trips, shapes);
      const tripTime = this.getTripTime(route.id, direction.id, routes, tripTimes);

      const speed = Number.parseFloat(dist) / tripTime * 60.0 / 1609.344;  // initial units are meters per minute, final are mph
      return speed;
    });
    
    const sum = speeds.reduce((total, currentValue) => total + currentValue);
    return sum / speeds.length;
  }
  
  getAllSpeeds(routes, trips, shapes, tripTimes) {
    
    /* 
     * temporary code to compute all speeds
     *
    let allSpeeds = routes.map(route => {
      return { routeID: route.id, speed: this.getSpeedForRoute(route.id, routes, trips, shapes, tripTimes) }
    });
    allSpeeds = allSpeeds.filter(speedObj => speedObj.speed > 0);
    allSpeeds.sort((a,b) => { return b.speed - a.speed});
  
    console.log(JSON.stringify(allSpeeds));
    
    */
  
    const allSpeeds =
      [{"routeID":"25","speed":21.88180505967474},{"routeID":"56","speed":17.967263381102484},
      {"routeID":"36","speed":14.591832194964685},{"routeID":"28R","speed":13.401101907945577},
      {"routeID":"57","speed":13.237010144335347},{"routeID":"28","speed":12.921714862227383},
      {"routeID":"66","speed":12.499606464911583},{"routeID":"39","speed":12.431568478024762},
      {"routeID":"18","speed":12.38384753629753},{"routeID":"67","speed":12.366435101370392},
      {"routeID":"23","speed":12.246234093732935},{"routeID":"NX","speed":12.211866897437611},
      {"routeID":"14X","speed":12.158861636587222},{"routeID":"48","speed":11.695485182500958},
      {"routeID":"L","speed":11.485168402500745},{"routeID":"54","speed":11.45955645346963},
      {"routeID":"29","speed":11.273682267549354},{"routeID":"8AX","speed":10.937315443481708},
      {"routeID":"35","speed":10.878958514151813},{"routeID":"38AX","speed":10.864142742482851},
      {"routeID":"37","speed":10.835803303611367},{"routeID":"M","speed":10.572728102510284},
      {"routeID":"31AX","speed":10.466797186575116},{"routeID":"14R","speed":9.87950792797499},
      {"routeID":"52","speed":9.654859038491768},{"routeID":"9R","speed":9.397910080959393},
      {"routeID":"44","speed":9.393679062721477},{"routeID":"7X","speed":9.197485622538018},
      {"routeID":"43","speed":9.174924508593438},{"routeID":"8","speed":9.17225706401365},
      {"routeID":"55","speed":9.004798341323038},{"routeID":"38BX","speed":8.845344785599222},
      {"routeID":"1AX","speed":8.642213974998622},{"routeID":"38R","speed":8.597711772417352},
      {"routeID":"5R","speed":8.570760157807591},{"routeID":"1BX","speed":8.568569971976034},
      {"routeID":"KT","speed":8.44033274203191},{"routeID":"31BX","speed":8.336418841572577},
      {"routeID":"N","speed":8.186878202967765},{"routeID":"30X","speed":8.1750377637687},
      {"routeID":"88","speed":8.143835269132298},{"routeID":"7","speed":8.020094044661953},
      {"routeID":"19","speed":7.839368204216173},{"routeID":"33","speed":7.7815775793949165},
      {"routeID":"1","speed":7.559416211169557},{"routeID":"6","speed":7.313535770060364},
      {"routeID":"31","speed":7.184332203025409},{"routeID":"12","speed":7.172470572185153},
      {"routeID":"14","speed":7.0958669024343175},{"routeID":"21","speed":7.049528206391989},
      {"routeID":"10","speed":7.0099080019303805},{"routeID":"49","speed":6.985820454377681},
      {"routeID":"3","speed":6.9026440647672285},{"routeID":"PH","speed":6.733517603568379},
      {"routeID":"2","speed":6.65504391162705},{"routeID":"82X","speed":6.582960083007707},
      {"routeID":"27","speed":6.38450281150451},{"routeID":"22","speed":6.358232657939327},
      {"routeID":"47","speed":6.19790710056837},{"routeID":"30","speed":6.12741382929436},
      {"routeID":"45","speed":5.768411843675301},{"routeID":"8BX","speed":5.754748408782319},
      {"routeID":"41","speed":5.616974987846005},{"routeID":"81X","speed":4.749500272494237},
      {"routeID":"C","speed":3.697334585762861},{"routeID":"PM","speed":3.423848943276791}]
    return allSpeeds;
  }
  
  getAllScores(routes, waits, speeds) {
    
    /**
     * temporary code again
     *
    let scores = [];
    for (let route of routes) {
      const waitObj = waits.find(wait => wait.routeID === route.id);
      const speedObj = speeds.find(speed => speed.routeID === route.id);
      if (waitObj && speedObj) {
        const grades = this.computeGrades(waitObj.wait, speedObj.speed);
        scores.push({ routeID: route.id, totalScore: grades.totalScore });
      }
    }
    scores.sort((a,b) => { return b.totalScore - a.totalScore});

    console.log(JSON.stringify(scores));
*/
    const allScores = [{"routeID":"14R","totalScore":198},{"routeID":"NX","totalScore":181},
      {"routeID":"L","totalScore":174},{"routeID":"38R","totalScore":172},
      {"routeID":"28","totalScore":168},{"routeID":"28R","totalScore":160},
      {"routeID":"5R","totalScore":159},{"routeID":"1","totalScore":151},
      {"routeID":"44","totalScore":151},{"routeID":"29","totalScore":150},
      {"routeID":"N","totalScore":148},{"routeID":"43","totalScore":144},
      {"routeID":"49","totalScore":139},{"routeID":"14","totalScore":134},
      {"routeID":"55","totalScore":121},{"routeID":"7","totalScore":120},
      {"routeID":"47","totalScore":115},{"routeID":"22","totalScore":105},
      {"routeID":"KT","totalScore":101},{"routeID":"M","totalScore":100},
      {"routeID":"8AX","totalScore":100},{"routeID":"14X","totalScore":100},
      {"routeID":"18","totalScore":100},{"routeID":"23","totalScore":100},
      {"routeID":"25","totalScore":100},{"routeID":"31AX","totalScore":100},
      {"routeID":"35","totalScore":100},{"routeID":"36","totalScore":100},
      {"routeID":"37","totalScore":100},{"routeID":"38AX","totalScore":100},
      {"routeID":"39","totalScore":100},{"routeID":"48","totalScore":100},
      {"routeID":"54","totalScore":100},{"routeID":"56","totalScore":100},
      {"routeID":"57","totalScore":100},{"routeID":"66","totalScore":100},
      {"routeID":"67","totalScore":100},{"routeID":"21","totalScore":99},
      {"routeID":"52","totalScore":93},{"routeID":"9R","totalScore":88},
      {"routeID":"45","totalScore":88},{"routeID":"7X","totalScore":84},
      {"routeID":"30","totalScore":84},{"routeID":"8","totalScore":83},
      {"routeID":"6","totalScore":82},{"routeID":"38BX","totalScore":77},
      {"routeID":"1AX","totalScore":73},{"routeID":"1BX","totalScore":71},
      {"routeID":"31BX","totalScore":67},{"routeID":"30X","totalScore":64},
      {"routeID":"33","totalScore":64},{"routeID":"88","totalScore":63},
      {"routeID":"19","totalScore":57},{"routeID":"27","totalScore":54},
      {"routeID":"2","totalScore":50},{"routeID":"31","totalScore":44},
      {"routeID":"12","totalScore":43},{"routeID":"10","totalScore":41},
      {"routeID":"3","totalScore":38},{"routeID":"PH","totalScore":35},
      {"routeID":"82X","totalScore":32},{"routeID":"8BX","totalScore":15},
      {"routeID":"41","totalScore":12},{"routeID":"81X","totalScore":0},
      {"routeID":"PM","totalScore":0},{"routeID":"C","totalScore":0}]    
    
    return allScores;

  }

  
  
  /**
   * grading copy/paste, refactor if we're going to actually use it
   */
  
  computeGrades(averageWait, speed) {
    
    //
    // grade and score for average wait
    //
    
    const averageWaitScoreScale = d3.scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);
    
    const averageWaitGradeScale = d3.scaleThreshold()
    .domain([5, 7.5, 10])
    .range(["A", "B", "C", "D"]);
    
       // grade and score for travel speed
    
    const speedScoreScale = d3.scaleLinear()
    .domain([5, 10])
    .rangeRound([0, 100])
    .clamp(true);
    
    const speedGradeScale = d3.scaleThreshold()
    .domain([5, 7.5, 10])
    .range(["D", "C", "B", "A"]);
        
       const totalGradeScale = d3.scaleThreshold()
    .domain([50, 100, 150])
    .range(["D", "C", "B", "A"]);

    let averageWaitScore = 0, averageWaitGrade = "";
    let speedScore = 0, speedGrade = "";
    let totalScore = 0, totalGrade = "";
    
    
    averageWaitScore = averageWaitScoreScale(averageWait); 
    averageWaitGrade = averageWaitGradeScale(averageWait)

    speedScore = speedScoreScale(speed);
    speedGrade = speedGradeScale(speed);
                     
    totalScore = averageWaitScore + speedScore;
    totalGrade = totalGradeScale(totalScore);
    
    return {
      averageWaitScore,
      averageWaitGrade,
      speedScore,
      speedGrade,
      totalScore,
      totalGrade,
      highestPossibleScore: 200
    }
  
  }  
  
  /**
   * Event handler for onMouseLeave.
   * @private
   */
  _onMouseLeave = () => {
    this.setState({crosshairValues: []});
  };

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  _onNearestX = (value, {index}) => {
    this.setState({crosshairValues: [ this.tripData[index], this.scheduleData[index]]});
  };  

  render() {
    const { graphData, graphParams, routeCSVs, shapes, trips, routes, tripTimes, waitTimes } = this.props;

    // if we have a route, try to find its shape
    // to do this, convert route id to gtfs route id, and parse the direction to get just the terminal
    // then find a corresponding row in trips.  There are 30k trips so these should be indexed or deduped.
    // any valid trip will give us a shape id (although there can be multiple shapes, like when a route
    // starts out of a yard).
    // finally, search the shapes to get distance along route (use longest shape)
    
    let speed = null;
    let dist = null;
    let tripTime = null;
    let waitTime = null;
    let waitRanking = null;
    let waitObj = null;
    const allWaits = this.getAllWaits();
    const allSpeeds = this.getAllSpeeds(routes, trips, shapes, tripTimes);
    const allScores = this.getAllScores(routes, allWaits, allSpeeds);
    let speedObj = null;
    let speedRanking = null;
    let tripData = null;
    let grades = null;
    let scoreObj = null;
    let scoreRanking = null
      
    if (graphData && graphParams && graphParams.route_id && graphParams.direction_id && tripTimes && waitTimes) {
      
      const route_id = graphParams.route_id;
      const direction_id = graphParams.direction_id;
      
      dist = this.getRouteDistanceInMeters(route_id, direction_id, trips, shapes);
      tripTime = this.getTripTime(route_id, direction_id, routes, tripTimes);

      speed = Number.parseFloat(dist) / tripTime * 60.0 / 1609.344;  // initial units are meters per minute, final are mph
      console.log('speed: ' + speed);

      waitTime = this.getWaitTime(route_id, waitTimes);

    
      // invert wait ranking to rank for shortest average wait time
      waitObj = allWaits.find(obj => obj.routeID === route_id);
      waitRanking = waitObj ? (allWaits.length - allWaits.indexOf(waitObj)) : null;

      speedObj = allSpeeds.find(obj => obj.routeID === route_id);
      speedRanking = speedObj ? allSpeeds.indexOf(speedObj) + 1 : null;

      scoreObj = allScores.find(obj => obj.routeID === route_id);
      scoreRanking = scoreObj ? allScores.indexOf(scoreObj) + 1 : null;

      
      this.tripData = this.getTripData(route_id, direction_id, routes, tripTimes);
      this.scheduleData = this.getDummyScheduleData(route_id, direction_id, routes, tripTimes);

      grades = this.computeGrades(waitTime, speed);
      
      
    }

    const legendItems = [
      { title: 'Scheduled', color: "#a4a6a9", strokeWidth: 10 },  
      { title: 'Actual',   color: "#aa82c5", strokeWidth: 10 }
    ];
    
    return (graphData ? <Card><Card.Body>
            
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
            <Card.Title>Average wait</Card.Title>
            <span className="h1">{ waitTime < 0 ? "?" : waitTime.toFixed(0) } minutes</span>
            
            <br/>
            
            { waitRanking ? ` (#${waitRanking} of ${allWaits.length} for shortest wait)` : null }
            { waitRanking ? <small>&nbsp;({ grades.averageWaitScore }/100)</small>
                : " ranking not available"}

            
            

            </Card.Body>
            </Card>
            
            <Card bg="info" text="white" className="mt-2">
            <Card.Body>
            <Card.Title>Average speed</Card.Title>
            <span className="h1">{ speed.toFixed(1) } mph</span>
            
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
            
            
            
            <XYPlot height={300} width={400} >
            <HorizontalGridLines />
            <VerticalGridLines />
            <XAxis />
            <YAxis hideLine />

            <LineSeries data={ this.tripData }
               stroke="#aa82c5"
               strokeWidth="4"
               onNearestX={this._onNearestX} />
            <LineSeries data={ this.scheduleData }
               stroke="#a4a6a9"
               strokeWidth="4"
               style={{
                 strokeDasharray: '2 2'
               }}             
            />

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

            { this.state.crosshairValues.length > 0 && (
             <Crosshair values={this.state.crosshairValues}
               style={{line:{background: 'none'}}} >
                    <div className= 'rv-crosshair__inner__content'>
                      <p>Actual: { Math.round(this.state.crosshairValues[0].y)} min</p>
                      <p>Scheduled: { Math.round(this.state.crosshairValues[1].y)} min</p>
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

            :
                null
    );
  }
}

export default RouteSummary;
