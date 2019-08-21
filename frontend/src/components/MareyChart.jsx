import React, { useState, useEffect } from 'react';

import { XYPlot, HorizontalGridLines, VerticalGridLines,
  XAxis, YAxis, LineMarkSeries, ChartLabel, Hint } from 'react-vis';
import '../../node_modules/react-vis/dist/style.css';
import { metersToMiles } from '../helpers/routeCalculations'

import { connect } from 'react-redux';

import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { Card, CardContent } from '@material-ui/core';

import { fetchArrivals } from '../actions';

import * as d3 from "d3";

/**
 * Within state.route.arrivals, the data is organized as follows:
 * 
 * Top level dictionary with version, agency, route_id, start_time/end_time timestamps
 * Stops dictionary by stop id -> arrivals -> direction id (usually just one) -> array of data points
 * Each data point is time in (t), time of exit (e), vehicle id (v), trip id (i), distance (d)
 * 
 * Ideally, each trip (and vehicle) would already be its own data series.  For now, we can rebucket
 * the data on the client side.  Goal is to create the following structure:
 * 
 * Dictionary of objects keyed by trip id
 *   - tripID
 *   - vehicleID (for coloring)
 *   - series: array of objects (eventually sorted by distance along route) containing:
 *     - stopID: the stop ID for this arrival (also can add any other desired stop metadata like title) 
 *     - x: distance along route (currently x-axis value, could be flipped)
 *     - y: arrival times in hours since midnight (currently the y-axis value, could be flipped)
 * 
 * Note: In our travel time chart, x axis is distance along route, y axis is time taken, so this is
 * consistent.
 * 
 * @param {Object} props
 */
function MareyChart(props) {

  // On first load, get the raw arrival history corresponding to graphParams.
  
  useEffect(() => {
    props.fetchArrivals(props.graphParams);
  }, [props.graphParams]);
  
  // When both the raw arrival history and route configs have loaded, first
  // rebucket the data by trip ID.  Then create react-vis Series objects for
  // each bucket, and store the Series in the state to trigger the final render.
  
  useEffect(() => {
    if (props.arrivals && props.routes) {
      //console.log("Processing arrival data.");
      const tripData = processArrivals(props.arrivals, props.routes);
      setProcessedArrivals(createSeries(tripData));
    }
  }, [props.arrivals, props.routes]);
  
   const [hintValue, setHintValue] = useState(); /* not working */
  const [processedArrivals, setProcessedArrivals] = useState();
  
  /**
   * This method traverses the arrival history (by stop, then by direction, then the contained array).
   * 
   * Each arrival is bucketed by trip ID.
   * 
   * @param {any} arrivals
   * @param {any} routes
   */
  const processArrivals = (arrivals, routes) => {
    
    const tripData = {}; // The dictionary by trip ID where arrivals are bucketed.
    
    const stops = arrivals.stops;
    const start_time = arrivals.start_time;
    const routeID = arrivals.route_id;
    const route = routes.find(route => route.id === routeID);
    
    for (let stopID in stops) {
      //console.log("Starting " + stopID);
      const stopsByDirection = stops[stopID].arrivals;
      for (let directionID in stopsByDirection) {
        
        const directionInfo = route.directions.find(direction => direction.id === directionID);
        
        const dataArray = stopsByDirection[directionID];
        for (let index in dataArray) {
          const arrival = dataArray[index];
          
          addArrival(tripData, arrival, stopID, route, directionInfo, start_time);
        }
      }
    }
    
    return tripData;
  }

  /**
   * Helper method to take a single arrival and add it to the right per-trip bucket
   * (creating it if needed).
   * 
   * We also convert the stop ID to a distance along the route, and convert the
   * arrival timestamp to hours since 3am.
   *  
   * @param {Object} tripData
   * @param {Object} arrival
   * @param {String} stopID
   * @param {Object} directionInfo
   * @param {Number} start_time
   */
  const addArrival = (tripData, arrival, stopID, route, directionInfo, start_time) => {
    const tripID = arrival.i;
    const vehicleID = arrival.v;
    if (tripData[tripID] === undefined) {
      tripData[tripID] = {
        tripID: tripID,
        vehicleID: vehicleID,
        series: [],
      };
    }
    
    if (directionInfo.stop_geometry[stopID]) {
      let distance = directionInfo.stop_geometry[stopID].distance;
    
      // This is a little clunky -- for all outbound routes, we restate the distance
      // as distance in the inbound direction by subtracting the stop's distance from
      // the length of the outbound direction.  This does not line up exactly with the
      // inbound direction length.
      
      if (directionInfo.name === 'Outbound') {
        distance = directionInfo.distance - distance;
      }
      distance = metersToMiles(distance);
      tripData[tripID].series.push({
        stopID: stopID,
        title: route.stops[stopID].title,
        minutes: (arrival.t - start_time)/60,
        vehicleID: vehicleID,
        x: distance,
        y: (arrival.t - start_time)/60/60 + 3.0, // convert to number of hours since midnight, assume 3am start time for now
      });
    }
  }
  
  /**
   * Generates per trip react-vis Series objects from the reorganized tripData.
   * We sort each bucket by "x" value (distance along route) to get plots pointed in the
   * correct order.
   * 
   * Series are colored by vehicle ID modulo 9 (the last digit of the vehicle ID tends to
   * repeat, so using 9 instead of 10).
   * 
   * @param {object} tripData
   */
  const createSeries = (tripData) => {
    const routeColor = d3.scaleQuantize([0,9], d3.schemeCategory10);
  
    let tripSeriesArray = [];
    for (let tripDataKey in tripData) {
      const dataSeries = tripData[tripDataKey].series.sort((a, b) => {
        return b.x - a.x;
      });
      tripSeriesArray.push(<LineMarkSeries
        key={ tripDataKey }
        data={ dataSeries }
        stroke={ routeColor(tripData[tripDataKey].vehicleID % 9) }
        style={{
          strokeWidth: '1px'
        }}              
        size="1"
        onValueMouseOver={ value => setHintValue(value) /* bug with onNearestXY requires use of onValue */ }          
        />);
    }
    return tripSeriesArray;
  }

  return processedArrivals ? 
  <Grid item xs={12}>
    <Card>
      <CardContent>
      
        <Typography variant="h5">Marey chart</Typography>

        Vehicle runs: { processedArrivals.length } <br/>

        <XYPlot height={2500} width={600}
          yDomain={[27, 3] /* 3am the next day at the bottom, 3am for this day at the top */}
          margin={{left:80}}
        >
        <HorizontalGridLines />
        <VerticalGridLines />
        <XAxis tickPadding={4} />
        <YAxis hideLine={true} tickPadding={4} tickFormat={v => v > 24 ? `${v-24}:00+1` : `${v}:00`} />
        
        { processedArrivals }

        <ChartLabel 
          text="Time (24h)"
          className="alt-y-label"
          includeMargin={true}
          xPercent={0.02}
          yPercent={0.2}
          style={{
            transform: 'rotate(-90)',
            textAnchor: 'end'
          }}       
        />       

        <ChartLabel 
          text="Inbound Distance Along Route (miles)"
          className="alt-x-label"
          includeMargin={true}
          xPercent={0.7}
          yPercent={0.965}
          style={{
            textAnchor: 'end'
          }}       
        />
        {hintValue ?
          <Hint
            value={hintValue}
            format={ hintValue => [{title: 'Stop', value: hintValue.title },
                                   {title: 'Time', value: `${(Math.floor(hintValue.minutes / 60) + 3)}:${Math.round(hintValue.minutes % 60).toString().padStart(2, '0')}`},
                                   {title: 'Vehicle ID', value: hintValue.vehicleID }
            ] }
          />
         : 
         null }

      </XYPlot>
      </CardContent>
    </Card>
  </Grid>
  : null
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
  graphParams: state.routes.graphParams,
  arrivals: state.routes.arrivals,
});

const mapDispatchToProps = dispatch => {
  return ({
    fetchArrivals: params => dispatch(fetchArrivals(params)),
  })
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(MareyChart);