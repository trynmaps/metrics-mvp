import React, { Fragment, useEffect } from 'react';

import { filterRoutes, getAllWaits, getAllDistances, getAllSpeeds, getAllScores,
  computeGrades, quartileBackgroundColor, quartileForegroundColor,
  metersToMiles } from '../helpers/routeCalculations'

import { connect } from 'react-redux';

import { fetchPrecomputedWaitAndTripData } from '../actions';

import TravelTimeChart from './TravelTimeChart';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Rating from '@material-ui/lab/Rating';
import Box from '@material-ui/core/Box';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 * 
 * @param {any} props
 */
function RouteSummary(props) {
  
  useEffect(() => {
    props.fetchPrecomputedWaitAndTripData(props.graphParams);
  }, []);  // like componentDidMount, this runs only on first render    
  
  const { graphParams } = props;

  let wait = null;
  let speed = null;
  let dist = null;
  let waitObj = null;
  let waitRanking = null;
  let speedObj = null;
  let speedRanking = null;
  let grades = null;
  let scoreObj = null;
  let scoreRanking = null;
  let allWaits = null;
  let allSpeeds = null;
  let allScores = null;

  let routes = null;

  if (graphParams.route_id) {
    
    routes = props.routes ? filterRoutes(props.routes) : [];

    allWaits = getAllWaits(props);
    
    const allDistances = getAllDistances(props);
    allSpeeds = getAllSpeeds(props, allDistances);
    allScores = getAllScores(routes, allWaits, allSpeeds);
    
    const route_id = graphParams.route_id;
    const distObj = allDistances ? allDistances.find(distObj => distObj.routeID === route_id) : null;
    dist = distObj ? distObj.distance : null;

    waitObj = allWaits ? allWaits.find(obj => obj.routeID === route_id) : null;
    waitRanking = waitObj ? allWaits.length - allWaits.indexOf(waitObj) : null; // invert wait ranking to for shortest wait time
    wait = waitObj ? waitObj.wait : null;
    
    speedObj = allSpeeds ? allSpeeds.find(obj => obj.routeID === route_id) : null;
    speedRanking = speedObj ? allSpeeds.indexOf(speedObj) + 1 : null;
    speed = speedObj ? speedObj.speed : null;
    
    scoreObj = allScores ? allScores.find(obj => obj.routeID === route_id) : null;
    scoreRanking = scoreObj ? allScores.indexOf(scoreObj) + 1 : null;
    
    grades = computeGrades(wait, speed);
  }
  
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
      color: grades ? quartileForegroundColor(grades.speedScore/100.0) : null,
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

          <Typography variant="h3" display="inline">{grades.totalScore}</Typography>
          <Typography variant="h5" display="inline">/{grades.highestPossibleScore}</Typography>

          <Box pt={2}>
            <Typography variant="body1">
              { scoreRanking ?  '#' + scoreRanking + ' out of ' + allScores.length + ' routes' : 'No data' }
            </Typography>
          </Box>

          </Paper>
        </Grid>

        <Grid item xs>            
          <Tooltip title={ waitRanking ? 'Subscore: ' + grades.medianWaitScore + '/100' : ''}>
          <Paper className={classes.wait}>

            <Typography variant="overline">Median wait</Typography>
            <br/>
            <Typography variant="h3" display="inline">{ wait === null ? "--" : wait.toFixed(0) }</Typography>
            <Typography variant="h5" display="inline">&nbsp;minutes</Typography>

            <Rating
              readOnly
              size="small"
              value={ Math.round( grades.medianWaitScore / 10.0 ) / 2.0 }
              precision={0.5} />

            <Box pt={2}>
              { waitRanking ? `#${waitRanking} of ${allWaits.length} for shortest wait` : null }
            </Box>

          </Paper>            
          </Tooltip>
        </Grid>            
            
        <Grid item xs>            

          <Tooltip title={ speedRanking ? 'Subscore: ' + grades.speedScore + '/100' : ''}>
          <Paper className={classes.trip}>

            <Typography variant="overline">Median speed</Typography>
            <br/>
            <Typography variant="h3" display="inline">{ speed === null || isNaN(speed) ? "--" : speed.toFixed(1) }</Typography>
            <Typography variant="h5" display="inline">&nbsp;mph</Typography>
            
            <Rating
            readOnly
            size="small"
            value={ Math.round( grades.speedScore / 10.0 ) / 2.0 }
            precision={0.5} />

            <Box pt={2}>
              { speedRanking ? `#${speedRanking} of ${allSpeeds.length} for fastest` : null }
            </Box>
            
            Length: { metersToMiles(dist).toFixed(1) } miles
            
          </Paper>
          </Tooltip>
        </Grid>


        <TravelTimeChart/>

      </Grid>
      </div>
      </Fragment>

     ) : null;
  }

const mapStateToProps = state => ({
  routes: state.routes.routes,
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