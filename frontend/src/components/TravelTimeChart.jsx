import React, { useState } from 'react';

import { XYPlot, HorizontalGridLines, VerticalGridLines,
  XAxis, YAxis, LineSeries, ChartLabel, Crosshair } from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import '../../node_modules/react-vis/dist/style.css';
import { getEndToEndTripTime, getTripDataSeries } from '../helpers/routeCalculations'

import { connect } from 'react-redux';

import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { Card } from '@material-ui/core';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 * 
 * @param {any} props
 */
function TravelTimeChart(props) {
  
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
  
  const { graphParams } = props;

  let tripData = null;
  let direction_id = null;
  let tripTimeForDirection = null;
  
  if (graphParams.route_id) {
    
    const route_id = graphParams.route_id;
    direction_id = graphParams.direction_id;
    
    if (direction_id) {
      tripTimeForDirection = getEndToEndTripTime(props, route_id, direction_id);
    
    /* this is the end-to-end speed in the selected direction, not currently used
    if (dist <= 0 || isNaN(tripTime)) { speed = "?"; } // something wrong with the data here
    else {
      speed = metersToMiles(Number.parseFloat(dist)) / tripTime * 60.0;  // initial units are meters per minute, final are mph
      //console.log('speed: ' + speed + " tripTime: " + tripTime);
    }*/
    }

    tripData = getTripDataSeries(props, route_id, direction_id);
    
  }

  
  const legendItems = [
    //{ title: 'Scheduled', color: "#a4a6a9", strokeWidth: 10 },  
    { title: 'Actual',   color: "#aa82c5", strokeWidth: 10 }
  ];
  
  
  return direction_id ? 
  <Grid item xs={12}>
    <Card>
      <CardContent>
        <Typography variant="h5">Travel time across stops</Typography>

        Full travel time: { tripTimeForDirection } minutes<br/>
        
        {/* set the y domain to start at zero and end at highest value (which is not always
          the end to end travel time due to spikes in the data) */}
        
        <XYPlot height={300} width={400} yDomain={[0, tripData.reduce((max, coord) => coord.y > max ? coord.y : max, 0)]}
          onMouseLeave={_onMouseLeave}>
        <HorizontalGridLines />
        <VerticalGridLines />
        <XAxis tickPadding={4} />
        <YAxis hideLine={true} tickPadding={4} />

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
          text="Minutes"
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
        text="Stop Number"
        className="alt-x-label"
        includeMargin={true}
        xPercent={0.6}
        yPercent={0.86}
        style={{
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
      </CardContent>
    </Card>
  </Grid>
  : null
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
  graphParams: state.routes.graphParams,
  waitTimesCache: state.routes.waitTimesCache,
  tripTimesCache: state.routes.tripTimesCache,
});

export default connect(
  mapStateToProps
)(TravelTimeChart);