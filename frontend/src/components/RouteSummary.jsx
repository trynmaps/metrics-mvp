import React, { Fragment, useState, useEffect } from 'react';

import { XYPlot, HorizontalGridLines, VerticalGridLines,
  XAxis, YAxis, LineSeries, ChartLabel, Crosshair } from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import '../../node_modules/react-vis/dist/style.css';
import { filterRoutes, getAllDistances, getAllSpeeds, getAllScores, getEndToEndTripTime,
  getTripDataSeries, computeGrades, quartileBackgroundColor, quartileForegroundColor,
  metersToMiles } from '../helpers/routeCalculations'

import { getAverageOfMedianWait } from '../helpers/precomputed';
import { connect } from 'react-redux';

import { fetchPrecomputedWaitAndTripData } from '../actions';

import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
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
  
  const { graphParams } = props;
  
  let speed = null;
  let dist = null;
  let waitRanking = null;
  let speedObj = null;
  let speedRanking = null;
  let grades = null;
  let scoreObj = null;
  let scoreRanking = null;
  let allSpeeds = null;
  let allScores = null;
  let tripData = null;

  let routes = null;
  let route = null;
  let direction_id = null;

  let tripTimeForDirection = null;
  
  if (graphParams.route_id) {
    
    routes = props.routes ? filterRoutes(props.routes) : [];
    
    routes = routes.map(route => {
      route.wait = getAverageOfMedianWait(props.waitTimesCache, props.graphParams, route);     
      return route;
    });      
    
    const allDistances = getAllDistances();
    allSpeeds = getAllSpeeds(props, allDistances);
    allScores = getAllScores(routes, allSpeeds);
    
    const route_id = graphParams.route_id;
    direction_id = graphParams.direction_id;
    
    const distObj = allDistances.find(distObj => distObj.routeID === route_id);
    dist = distObj ? distObj.distance : null;

    if (direction_id) {
      tripTimeForDirection = getEndToEndTripTime(props, route_id, direction_id);
    
    /* this is the end-to-end speed in the selected direction, not currently used
    if (dist <= 0 || isNaN(tripTime)) { speed = "?"; } // something wrong with the data here
    else {
      speed = metersToMiles(Number.parseFloat(dist)) / tripTime * 60.0;  // initial units are meters per minute, final are mph
      //console.log('speed: ' + speed + " tripTime: " + tripTime);
    }*/
    }
    
    route = routes.find(route => route.id === route_id);
    
    routes.sort((a,b) => { return b.wait - a.wait});
    waitRanking = routes.length - routes.indexOf(route); // invert wait ranking to rank for shortest wait time
    
    speedObj = allSpeeds.find(obj => obj.routeID === route_id);
    speedRanking = speedObj ? allSpeeds.indexOf(speedObj) + 1 : null;
    speed = speedObj ? speedObj.speed : null;
    
    scoreObj = allScores.find(obj => obj.routeID === route_id);
    scoreRanking = scoreObj ? allScores.indexOf(scoreObj) + 1 : null;
    
    tripData = getTripDataSeries(props, route_id, direction_id);

    if (route) {
      grades = computeGrades(route.wait, speed);
    }
  }
  
  const legendItems = [
                       //{ title: 'Scheduled', color: "#a4a6a9", strokeWidth: 10 },  
                       { title: 'Actual',   color: "#aa82c5", strokeWidth: 10 }
                       ];
  
  const useStyles = makeStyles(theme => ({
    grade: {
      background: grades ? quartileBackgroundColor(grades.totalScore/grades.highestPossibleScore) : null,
      color: grades ? quartileForegroundColor(grades.totalScore/grades.highestPossibleScore) : null,
      padding: theme.spacing(2)
    },
    wait: {
      background: grades ? quartileBackgroundColor(grades.medianWaitScore/100.0) : null,
      color: grades ? quartileForegroundColor(grades.medianWaitScore/100.0) : null,
      padding: theme.spacing(2)
    },
    trip: { 
      background: grades ? quartileBackgroundColor(grades.speedScore/100.0) : null,
      color: grades ? quartileForegroundColor(grades.speedScore/100.0) : null, // xxx not working
      padding: theme.spacing(2)
    },
  }));
  
  const classes = useStyles();
  
  return grades ? (<Fragment>
      
      <div style={{ padding: 12 }}>
      <Grid container spacing={3}>

        <Grid item xs>            
          <Paper className={classes.grade}>
          <Typography variant="overline">Route score</Typography><br/>
          <Grid container justify="space-between">
          <Grid item>
          <Typography variant="h3" display="inline">{grades.totalScore}</Typography>
          <Typography variant="h5" display="inline">/{grades.highestPossibleScore}</Typography>
          </Grid>
     
          <Grid item>
          <Typography variant="body1" align="right" display="inline">
            { scoreRanking ?  '#' + scoreRanking + ' out of ' + allScores.length + ' routes' : 'Rank not available' }
          </Typography>
          </Grid>
          </Grid>

          </Paper>
          </Grid>

        <Grid item xs>            
          <Paper className={classes.wait}>

            <Typography variant="overline">Median wait</Typography>
            <Typography variant="h3">{ route.wait < 0 ? "?" : route.wait.toFixed(0) } minutes</Typography>
            
            { waitRanking ? `#${waitRanking} of ${routes.length} for shortest wait` : null }
            { waitRanking ? <small>&nbsp;({ grades.medianWaitScore }/100)</small>
                : " ranking not available"}

          </Paper>            
        </Grid>            
            
        <Grid item xs>            

            
          <Paper className={classes.trip}>

            <Typography variant="overline">Median speed</Typography>
            <Typography variant="h3">{ isNaN(speed) ? speed : speed.toFixed(1) } mph</Typography>
            
            { speedRanking ? `#${speedRanking} of ${allSpeeds.length} for fastest` : null }
            { speedRanking ? <small>&nbsp;({ grades.speedScore }/100)</small> : " ranking not available"}
            

            
            <br/>

            Length: { metersToMiles(dist).toFixed(1) } miles
            
          </Paper>
        </Grid>


        { direction_id ? <Grid item xs={12}>

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
          </Grid>
            
            : null }

      </Grid>
      </div>
      </Fragment>

     ) : null;
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