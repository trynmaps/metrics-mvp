import React, { Component } from 'react';
import { Card, Container, Row, Col } from 'react-bootstrap';
import * as d3 from "d3";

import { XYPlot, HorizontalGridLines, VerticalGridLines,
  XAxis, YAxis,
  LineSeries, CustomSVGSeries, ChartLabel, Crosshair } from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import '../../node_modules/react-vis/dist/style.css';
import { filterRoutes, filterDirections, ignoreFirstStop, ignoreLastStop } from '../helpers/routeCalculations'
  
class RouteSummary extends Component {
  constructor(props) {
    super(props);
    this.state = { crosshairValues: [],
        waitCrosshairValues: []};
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
    let terminal = directionInfo.title.substr(directionInfo.name.length + " to ".length);
    
    // some terminals in our config don't match up with current gtfs data
    
    // TODO: move this to heuristics function.
    
    const remappingOfTerminal = {
        "17ST AND NOE": "Castro", // F outbound:  in trips.txt for 14358, which is not in routes.txt.  14359 is the F.  As of 6/11 this is no longer in route config, is Castro now.
        "Cow Palace": "Bayshore Boulevard" // 9 outbound: during the day, terminal is bayshore.  See sfmta route description for morning, evening, weekend terminals.          
    }
    
    if (remappingOfTerminal[terminal]) {
      terminal = remappingOfTerminal[terminal];
    }
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

    //console.log('Found distances of: ' + Object.values(distByShape).toString());

    // probably should be using Math.max here
    const maxDist = Object.values(distByShape).reduce((total, currentValue, currentIndex, arr) => {
      if (parseInt(currentValue) > parseInt(total)) { return currentValue} else {
        return total;
      }
    }, 0);
    //console.log('dist in meters is : ' + maxDist);
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

    const route = this.props.routes.find(route => route.id === routeID);
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
  getTripTime(routeID, directionID, routes, tripTimes) {
    
    const {tripTimesForFirstStop, directionInfo} = this.getTripTimesForFirstStop(routeID, directionID, routes, tripTimes);
    
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
  getTripData(routeID, directionID, routes, tripTimes) {
    const {tripTimesForFirstStop, directionInfo} = this.getTripTimesForFirstStop(routeID, directionID, routes, tripTimes);

    if (!tripTimesForFirstStop) { return []; } // no precomputed times

    const route = this.props.routes.find(route => route.id === routeID);
    
    // TODO; take into account possible skipping for first and last stop
    
    const dataSeries = directionInfo.stops.map((stop, index) => { return {
      x: index,
      y: tripTimesForFirstStop[stop] ? tripTimesForFirstStop[stop] : 0,
      title: route.stops[stop].title
    }});
    
    return dataSeries;
  } 

  getDummyScheduleData(routeID, directionID, routes, tripTimes) {
    const {tripTimesForFirstStop, directionInfo} = this.getTripTimesForFirstStop(routeID, directionID, routes, tripTimes);

    if (!tripTimesForFirstStop) { return []; } // no precomputed times

    const route = this.props.routes.find(route => route.id === routeID);
    
    const dataSeries = directionInfo.stops.map((stop, index) => { return {
      x: index,
      y: tripTimesForFirstStop[stop] ? tripTimesForFirstStop[stop] * 0.9 : 0,
      title: route.stops[stop].title
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
      const result = this.getWaitTimeForDir(direction.id, waitTimes[route.id]);
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
  getWaitTimeForDir(directionID, waitTimesForRoute) {
    if (!waitTimesForRoute) {
      return {wait:0, stops: 0};
    }
    
    const waitTimeForDir = waitTimesForRoute[directionID];

    if (!waitTimeForDir) {
      return {wait:0, stops: 0};
    }
    const totalWait = Object.values(waitTimeForDir).reduce((total, currentValue, currentIndex, arr) => {
      return total + currentValue;
    }, 0);

    return {wait: totalWait, stops: Object.values(waitTimeForDir).length};
  }

  
  /**
   * Get wait times along a route in one direction.
   */
  getWaitData(routeID, directionID, routes, waitTimes) {
    const waitTimeForRoute = waitTimes[routeID];
    
    if (!waitTimeForRoute) {
      return [];
    }
    
    const waitTimeForDir = waitTimeForRoute[directionID];

    if (!waitTimeForDir) {
      return [];
    }
    
    const route = this.props.routes.find(route => route.id === routeID);
    const directionInfo = route.directions.find(direction => direction.id === directionID);

    const dataSeries = directionInfo.stops.map((stop, index) => { return {
      x: index,
      y: waitTimeForDir[stop] ? waitTimeForDir[stop] : 0
    }});
    
    return dataSeries;
  }

  
  
  
  
  getAllWaits(routes, waitTimes) {  
  /**
   *  This is the temporary code used to generate the allWaits array below.
   *  
    
    const filteredRoutes = filterRoutes(routes);
    let allWaits = filteredRoutes.map(route => {
        return { routeID: route.id, wait: this.getWaitTime(route.id, waitTimes) }
    })  ;
    allWaits = allWaits.filter(waitObj => waitObj.wait > 0);
    allWaits.sort((a,b) => { return b.wait - a.wait});
    console.log(JSON.stringify(allWaits));
    
    /*/
  
    const allWaits = 
  [{"routeID":"E","wait":28.326666666666668},{"routeID":"81X","wait":24.725},
    {"routeID":"56","wait":22.653846153846157},{"routeID":"36","wait":20.90793650793651},
    {"routeID":"39","wait":17.743589743589745},{"routeID":"25","wait":17.014285714285712},
    {"routeID":"18","wait":16.104444444444447},{"routeID":"23","wait":15.914925373134327},
    {"routeID":"37","wait":15.226315789473684},{"routeID":"67","wait":13.329545454545455},
    {"routeID":"52","wait":13.252112676056337},{"routeID":"8","wait":13.12636363636364},
    {"routeID":"3","wait":12.594827586206897},{"routeID":"54","wait":12.390361445783133},
    {"routeID":"57","wait":11.845882352941175},{"routeID":"PH","wait":11.727536231884057},
    {"routeID":"PM","wait":11.706521739130435},{"routeID":"35","wait":11.609375},
    {"routeID":"38","wait":11.571856287425149},{"routeID":"55","wait":11.532142857142857},
    {"routeID":"82X","wait":10.934999999999999},{"routeID":"48","wait":10.510638297872338},
    {"routeID":"31","wait":10.395495495495492},{"routeID":"66","wait":10.242857142857142},
    {"routeID":"27","wait":9.819999999999999},{"routeID":"88","wait":9.773684210526316},
    {"routeID":"38AX","wait":9.65},{"routeID":"19","wait":9.631343283582085},
    {"routeID":"33","wait":9.55977011494253},{"routeID":"10","wait":9.322222222222223},
    {"routeID":"2","wait":9.153333333333334},{"routeID":"12","wait":9.022988505747126},
    {"routeID":"9R","wait":8.99655172413793},{"routeID":"C","wait":8.913513513513513},
    {"routeID":"24","wait":8.184873949579831},{"routeID":"31BX","wait":8.145454545454546},
    {"routeID":"1AX","wait":8.11176470588235},{"routeID":"7X","wait":7.935064935064935},
    {"routeID":"29","wait":7.920670391061454},{"routeID":"7","wait":7.878504672897196},
    {"routeID":"6","wait":7.86421052631579},{"routeID":"38BX","wait":7.428571428571429},
    {"routeID":"9","wait":7.338053097345133},{"routeID":"8BX","wait":7.310752688172044},
    {"routeID":"1BX","wait":7.017241379310343},{"routeID":"21","wait":6.994736842105262},
    {"routeID":"44","wait":6.956249999999999},{"routeID":"30X","wait":6.823076923076922},
    {"routeID":"31AX","wait":6.77560975609756},{"routeID":"J","wait":6.739473684210527},
    {"routeID":"45","wait":6.557627118644067},{"routeID":"22","wait":6.52391304347826},
    {"routeID":"43","wait":6.512000000000002},{"routeID":"KT","wait":6.472619047619048},
    {"routeID":"28","wait":6.432911392405063},{"routeID":"14X","wait":6.326785714285715},
    {"routeID":"28R","wait":6.284615384615384},{"routeID":"M","wait":6.13090909090909},
    {"routeID":"14R","wait":6.034782608695651},{"routeID":"14","wait":5.865217391304348},
    {"routeID":"F","wait":5.6474576271186425},{"routeID":"NX","wait":5.579166666666667},
    {"routeID":"30","wait":5.513235294117647},{"routeID":"49","wait":5.467948717948718},
    {"routeID":"5R","wait":5.307936507936509},{"routeID":"5","wait":5.058750000000001},
    {"routeID":"N","wait":5.040298507462687},{"routeID":"L","wait":5.037499999999999},
    {"routeID":"47","wait":4.882758620689656},{"routeID":"1","wait":4.815625},
    {"routeID":"8AX","wait":4.536734693877551},{"routeID":"41","wait":4.252727272727273},
    {"routeID":"38R","wait":3.170833333333334}];  

    return allWaits;
  }
  
  getSpeedForRoute(route_id, routes, trips, shapes, tripTimes) { // all directions
    const route = routes.find(route => route.id === route_id);
    
    const filteredDirections = filterDirections(route.directions, route_id);
    let speeds = filteredDirections.map(direction => {
      const dist = this.getRouteDistanceInMeters(route.id, direction.id, trips, shapes);
      const tripTime = this.getTripTime(route.id, direction.id, routes, tripTimes);
      
      if (dist <= 0 || isNaN(tripTime)) { return -1; } // something wrong with the data here

      const speed = Number.parseFloat(dist) / tripTime * 60.0 / 1609.344;  // initial units are meters per minute, final are mph
      return speed;
    });
    
    speeds = speeds.filter(speed => speed >= 0); // ignore negative speeds, as with oddball 9 direction
    
    if (speeds.length === 0) { return 0; };
    
    const sum = speeds.reduce((total, currentValue) => total + currentValue);
    return sum / speeds.length;
  }
  
  getAllSpeeds(routes, trips, shapes, tripTimes) {
    
    /* 
     * temporary code to compute all speeds
     *
    let allSpeeds = null;
    if (routes && trips && shapes && tripTimes) {
      const filteredRoutes = filterRoutes(routes);
      allSpeeds = filteredRoutes.map(route => {
        return { routeID: route.id, speed: this.getSpeedForRoute(route.id, routes, trips, shapes, tripTimes) }
      });
      allSpeeds = allSpeeds.filter(speedObj => speedObj.speed > 0); // not needed?
      allSpeeds.sort((a,b) => { return b.speed - a.speed});

      console.log(JSON.stringify(allSpeeds));
    }/*/
    
  
    // TODO: instead of picking longest shape, maybe go with the most prevalent in trips.txt?
    
    const allSpeeds =

    [{"routeID":"25","speed":23.53673528077509},{"routeID":"56","speed":18.89642338010723},{"routeID":"36","speed":13.97256755699729},{"routeID":"57","speed":13.083745412641946},{"routeID":"66","speed":12.939880120192345},{"routeID":"L","speed":12.806484295969913},{"routeID":"18","speed":12.755122106920357},{"routeID":"NX","speed":12.747474264539647},{"routeID":"23","speed":12.617453099531058},{"routeID":"28R","speed":12.58609046992892},{"routeID":"M","speed":12.433496116392975},{"routeID":"48","speed":12.22171750329319},{"routeID":"28","speed":12.125254554167583},{"routeID":"31AX","speed":11.562342850099334},{"routeID":"29","speed":11.51112282689134},{"routeID":"14X","speed":11.420420653251856},{"routeID":"39","speed":11.111151172787249},{"routeID":"54","speed":10.958561622719845},{"routeID":"38AX","speed":10.92080476284213},{"routeID":"67","speed":10.805301150867972},{"routeID":"1AX","speed":10.743814727525546},{"routeID":"35","speed":10.471121083622347},{"routeID":"5","speed":10.27119653083695},{"routeID":"8AX","speed":10.269796769509632},{"routeID":"J","speed":10.175561137544854},{"routeID":"38BX","speed":10.135743253376186},{"routeID":"31BX","speed":10.071039229503796},{"routeID":"14R","speed":9.576014982826607},{"routeID":"44","speed":9.537425224664688},{"routeID":"8BX","speed":9.51866032693622},{"routeID":"52","speed":9.469761030387193},{"routeID":"37","speed":9.434999769851835},{"routeID":"N","speed":9.39581339253376},{"routeID":"43","speed":9.287424605037632},{"routeID":"KT","speed":9.280457385907283},{"routeID":"7X","speed":9.215826142135091},{"routeID":"8","speed":8.951557581145465},{"routeID":"38R","speed":8.855247338938689},{"routeID":"82X","speed":8.626424266335725},{"routeID":"88","speed":8.547601887234283},{"routeID":"9R","speed":8.525804539584065},{"routeID":"1BX","speed":8.359532632084957},{"routeID":"5R","speed":8.30286402564446},{"routeID":"7","speed":8.091391500823503},{"routeID":"30X","speed":8.081677563870178},{"routeID":"19","speed":7.8515789040414745},{"routeID":"10","speed":7.738465876122821},{"routeID":"33","speed":7.573458175418235},{"routeID":"PH","speed":7.236549935317842},{"routeID":"6","speed":7.227969145214597},{"routeID":"31","speed":7.140272971757923},{"routeID":"E","speed":7.082045379100897},{"routeID":"24","speed":7.074954574522093},{"routeID":"38","speed":6.997423042784176},{"routeID":"14","speed":6.941802950963222},{"routeID":"1","speed":6.916475971783379},{"routeID":"41","speed":6.868005011207201},{"routeID":"2","speed":6.8341404345430945},{"routeID":"3","speed":6.731185729929051},{"routeID":"9","speed":6.693351533782119},{"routeID":"21","speed":6.646542020431805},{"routeID":"49","speed":6.61271423381964},{"routeID":"81X","speed":6.4926679256969075},{"routeID":"12","speed":6.458392830700827},{"routeID":"47","speed":6.362389701502757},{"routeID":"22","speed":6.2932392707639035},{"routeID":"30","speed":6.211207633218829},{"routeID":"27","speed":6.165550900165391},{"routeID":"45","speed":6.146126977949873},{"routeID":"55","speed":6.137546693508098},{"routeID":"F","speed":5.702729578812806},{"routeID":"C","speed":4.197389598026333},{"routeID":"PM","speed":4.034093952541647}]


    /*
     * test code to look for routes missing speeds 
     */
    
    /*
    if (routes && allSpeeds) {
      for (let route of routes) {
        const speedInfo = allSpeeds.find(speed => speed.routeID === route.id);
        if (!speedInfo) { console.log("No speed info for " + route.id); }
      }
    }*/
    return allSpeeds;
  }
  
  getAllScores(routes, waits, speeds) {
    
    /**
     * temporary code again
     *
    let allScores = [];
    const filteredRoutes = filterRoutes(routes);
    for (let route of filteredRoutes) {
      const waitObj = waits.find(wait => wait.routeID === route.id);
      const speedObj = speeds.find(speed => speed.routeID === route.id);
      if (waitObj && speedObj) {
        const grades = this.computeGrades(waitObj.wait, speedObj.speed);
        allScores.push({ routeID: route.id, totalScore: grades.totalScore });
      }
    }
    allScores.sort((a,b) => { return b.totalScore - a.totalScore});

    console.log(JSON.stringify(allScores));

    /*/
      
    const allScores = 
    
    [{"routeID":"8AX","totalScore":200},{"routeID":"L","totalScore":199},
    {"routeID":"5","totalScore":199},{"routeID":"NX","totalScore":188},
    {"routeID":"N","totalScore":187},{"routeID":"M","totalScore":177},
    {"routeID":"38R","totalScore":177},{"routeID":"28R","totalScore":174},
    {"routeID":"14X","totalScore":173},{"routeID":"14R","totalScore":171},
    {"routeID":"28","totalScore":171},{"routeID":"J","totalScore":165},
    {"routeID":"31AX","totalScore":164},{"routeID":"5R","totalScore":160},
    {"routeID":"KT","totalScore":157},{"routeID":"43","totalScore":156},
    {"routeID":"44","totalScore":152},{"routeID":"38BX","totalScore":151},
    {"routeID":"8BX","totalScore":144},{"routeID":"29","totalScore":142},
    {"routeID":"1","totalScore":138},{"routeID":"1AX","totalScore":138},
    {"routeID":"31BX","totalScore":137},{"routeID":"41","totalScore":137},
    {"routeID":"1BX","totalScore":127},{"routeID":"47","totalScore":127},
    {"routeID":"30X","totalScore":126},{"routeID":"7X","totalScore":125},
    {"routeID":"49","totalScore":123},{"routeID":"14","totalScore":122},
    {"routeID":"30","totalScore":114},{"routeID":"38AX","totalScore":107},
    {"routeID":"7","totalScore":104},{"routeID":"F","totalScore":101},
    {"routeID":"18","totalScore":100},{"routeID":"23","totalScore":100},
    {"routeID":"25","totalScore":100},{"routeID":"35","totalScore":100},
    {"routeID":"36","totalScore":100},{"routeID":"39","totalScore":100},
    {"routeID":"48","totalScore":100},{"routeID":"54","totalScore":100},
    {"routeID":"56","totalScore":100},{"routeID":"57","totalScore":100},
    {"routeID":"66","totalScore":100},{"routeID":"67","totalScore":100},
    {"routeID":"22","totalScore":96},{"routeID":"21","totalScore":93},
    {"routeID":"45","totalScore":92},{"routeID":"9R","totalScore":91},
    {"routeID":"37","totalScore":89},{"routeID":"52","totalScore":89},
    {"routeID":"6","totalScore":88},{"routeID":"9","totalScore":87},
    {"routeID":"8","totalScore":79},{"routeID":"24","totalScore":77},
    {"routeID":"88","totalScore":76},{"routeID":"82X","totalScore":73},
    {"routeID":"10","totalScore":69},{"routeID":"19","totalScore":64},
    {"routeID":"33","totalScore":60},{"routeID":"2","totalScore":54},
    {"routeID":"12","totalScore":49},{"routeID":"PH","totalScore":45},
    {"routeID":"31","totalScore":43},{"routeID":"E","totalScore":42},
    {"routeID":"38","totalScore":40},{"routeID":"3","totalScore":35},
    {"routeID":"81X","totalScore":30},{"routeID":"27","totalScore":27},
    {"routeID":"55","totalScore":23},{"routeID":"C","totalScore":22},
    {"routeID":"PM","totalScore":0}]
    
    /* end testing area */
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
  _onNearestTripX = (value, {index}) => {
    this.setState({crosshairValues: [ this.tripData[index], this.scheduleData[index]]});
  };  

  
  _onNearestWaitX = (value, {index}) => {
    this.setState({waitCrosshairValues: [ this.waitData[index]]});
  };  
  
  render() {
    const { graphData, graphParams, shapes, trips, routes, tripTimes, waitTimes } = this.props;

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
    let speedObj = null;
    let speedRanking = null;
    let grades = null;
    let scoreObj = null;
    let scoreRanking = null;
    let allSpeeds = null;
    let allWaits = null;
    let allScores = null;
    
    let quadrantData = null;
      
    if (graphData && graphParams && graphParams.route_id && graphParams.direction_id && tripTimes && waitTimes) {

      allWaits = this.getAllWaits(routes, waitTimes);
      allSpeeds = this.getAllSpeeds(routes, trips, shapes, tripTimes);
      allScores = this.getAllScores(routes, allWaits, allSpeeds);

      const route_id = graphParams.route_id;
      const direction_id = graphParams.direction_id;
      
      dist = this.getRouteDistanceInMeters(route_id, direction_id, trips, shapes);
      tripTime = this.getTripTime(route_id, direction_id, routes, tripTimes);

      if (dist <= 0 || isNaN(tripTime)) { speed = "?"; } // something wrong with the data here
      else {
        speed = Number.parseFloat(dist) / tripTime * 60.0 / 1609.344;  // initial units are meters per minute, final are mph
        console.log('speed: ' + speed + " tripTime: " + tripTime);
      }

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

      this.waitData = this.getWaitData(route_id, direction_id, routes, waitTimes);
      
      grades = this.computeGrades(waitTime, speed);
      
      // experimental quadrant data
      
      quadrantData = allSpeeds.map(speed => { return {
        x: allWaits.find(wait => wait.routeID === speed.routeID).wait,
        y: speed.speed,
        title: speed.routeID,
      }});
      
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

            
            
            
            {/* experimental quadrant chart */}
            
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

            
            
            { /* end experimental quadrant chart */ }
            
            
            
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
               onNearestX={this._onNearestTripX} />
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
                      <p>{this.state.crosshairValues[0].title}</p>
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

          <LineSeries data={ this.waitData }
             stroke="#aa82c5"
             strokeWidth="4"
             onNearestX={this._onNearestWaitX} />

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

          { this.state.waitCrosshairValues.length > 0 && (
           <Crosshair values={this.state.waitCrosshairValues}
             style={{line:{background: 'none'}}} >
                  <div className= 'rv-crosshair__inner__content'>
                    <p>Wait: { Math.round(this.state.waitCrosshairValues[0].y)} min</p>
                  </div>                 
          </Crosshair>)}

        </XYPlot>
          
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
