import React, { Fragment, useEffect } from 'react';

import { connect } from 'react-redux';

import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Rating from '@material-ui/lab/Rating';
import Box from '@material-ui/core/Box';
import TravelTimeChart from './TravelTimeChart';
import MareyChart from './MareyChart';
import { fetchPrecomputedWaitAndTripData } from '../actions';
import {
  filterRoutes,
  getAllWaits,
  getAllSpeeds,
  getAllScores,
  computeGrades,
  quartileBackgroundColor,
  quartileForegroundColor,
  metersToMiles,
} from '../helpers/routeCalculations';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
function RouteSummary(props) {
  
  const { graphParams, fetchPrecomputedWaitAndTripData } = props;

  useEffect(() => {
    fetchPrecomputedWaitAndTripData(graphParams);
  }, [graphParams, fetchPrecomputedWaitAndTripData]); // like componentDidMount, this runs only on first render

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

  if (graphParams.routeId) {
    routes = props.routes ? filterRoutes(props.routes) : [];

    allWaits = getAllWaits(props.waitTimesCache, graphParams, routes);
    allSpeeds = getAllSpeeds(props.tripTimesCache, graphParams, routes);
    allScores = getAllScores(routes, allWaits, allSpeeds);

    const routeId = graphParams.routeId;
    const route = routes.find(thisRoute => thisRoute.id === routeId);
    if (route) {
      const sumOfDistances = route.directions.reduce(
        (total, value) => total + value.distance,
        0,
      );
      dist = sumOfDistances / route.directions.length;
    }

    waitObj = allWaits ? allWaits.find(obj => obj.routeId === routeId) : null;
    waitRanking = waitObj ? allWaits.length - allWaits.indexOf(waitObj) : null; // invert wait ranking to for shortest wait time
    wait = waitObj ? waitObj.wait : null;

    speedObj = allSpeeds
      ? allSpeeds.find(obj => obj.routeId === routeId)
      : null;
    speedRanking = speedObj ? allSpeeds.indexOf(speedObj) + 1 : null;
    speed = speedObj ? speedObj.speed : null;

    scoreObj = allScores
      ? allScores.find(obj => obj.routeId === routeId)
      : null;
    scoreRanking = scoreObj ? allScores.indexOf(scoreObj) + 1 : null;

    grades = computeGrades(wait, speed);
  }

  const useStyles = makeStyles(theme => ({
    grade: {
      background:
        wait && speed
          ? quartileBackgroundColor(
              grades.totalScore / grades.highestPossibleScore,
            )
          : 'gray',
      color:
        wait && speed
          ? quartileForegroundColor(
              grades.totalScore / grades.highestPossibleScore,
            )
          : 'black',
      padding: theme.spacing(2),
      margin: theme.spacing(1),
    },
    wait: {
      background:
        wait && grades
          ? quartileBackgroundColor(grades.medianWaitScore / 100.0)
          : 'gray',
      color:
        wait && grades
          ? quartileForegroundColor(grades.medianWaitScore / 100.0)
          : 'black',
      padding: theme.spacing(2),
      margin: theme.spacing(1),
    },
    trip: {
      background:
        speed && grades
          ? quartileBackgroundColor(grades.speedScore / 100.0)
          : 'gray',
      color:
        speed && grades
          ? quartileForegroundColor(grades.speedScore / 100.0)
          : 'black',
      padding: theme.spacing(2),
      margin: theme.spacing(1),
    },
  }));

  const classes = useStyles();

  return (
    <Fragment>
      <div style={{ padding: 8 }}>
        <Grid container>
          <Grid item xs component={Paper} className={classes.grade}>
            <Typography variant="overline">Route score</Typography>
            <br />

            <Typography variant="h3" display="inline">
              {wait && speed ? grades.totalScore : '--'}
            </Typography>
            <Typography variant="h5" display="inline">
              /{grades ? grades.highestPossibleScore : '--'}
            </Typography>

            <Box pt={2}>
              <Typography variant="body1">
                {scoreRanking
                  ? `#${scoreRanking} out of ${allScores.length} routes`
                  : 'No data'}
              </Typography>
            </Box>
          </Grid>

          <Tooltip
            title={wait ? `Subscore: ${grades.medianWaitScore}/100` : ''}
          >
            <Grid item xs component={Paper} className={classes.wait}>
              <Typography variant="overline">Median wait</Typography>
              <br />
              <Typography variant="h3" display="inline">
                {wait === null ? '--' : wait.toFixed(0)}
              </Typography>
              <Typography variant="h5" display="inline">
                &nbsp;minutes
              </Typography>

              <Rating
                readOnly
                size="small"
                value={
                  grades ? Math.round(grades.medianWaitScore / 10.0) / 2.0 : 0
                }
                precision={0.5}
              />

              <Box pt={2}>
                {waitRanking
                  ? `#${waitRanking} of ${allWaits.length} for shortest wait`
                  : null}
              </Box>
            </Grid>
          </Tooltip>

          <Tooltip title={speed ? `Subscore: ${grades.speedScore}/100` : ''}>
            <Grid item xs component={Paper} className={classes.trip}>
              <Typography variant="overline">Median speed</Typography>
              <br />
              <Typography variant="h3" display="inline">
                {speed === null || Number.isNaN(speed)
                  ? '--'
                  : speed.toFixed(1)}
              </Typography>
              <Typography variant="h5" display="inline">
                &nbsp;mph
              </Typography>
              <Rating
                readOnly
                size="small"
                value={grades ? Math.round(grades.speedScore / 10.0) / 2.0 : 0}
                precision={0.5}
              />
              <Box pt={2}>
                {speedRanking
                  ? `#${speedRanking} of ${allSpeeds.length} for fastest`
                  : null}
              </Box>
              Length: {metersToMiles(dist).toFixed(1)} miles
            </Grid>
          </Tooltip>

          <TravelTimeChart />
          <MareyChart />
        </Grid>
      </div>
    </Fragment>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
  graphParams: state.routes.graphParams,
  waitTimesCache: state.routes.waitTimesCache,
  tripTimesCache: state.routes.tripTimesCache,
});

const mapDispatchToProps = dispatch => {
  return {
    fetchPrecomputedWaitAndTripData: params =>
      dispatch(fetchPrecomputedWaitAndTripData(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteSummary);
