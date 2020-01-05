import React, { Fragment, useEffect } from 'react';

import { connect } from 'react-redux';

import Grid from '@material-ui/core/Grid';

import { AppBar, Box, Tab, Tabs, Table, TableBody, TableCell, TableRow } from '@material-ui/core';

import InfoScoreCard from './InfoScoreCard';
import InfoScoreLegend from './InfoScoreLegend';
import TravelTimeChart from './TravelTimeChart';
import MareyChart from './MareyChart';
import { fetchPrecomputedStats } from '../actions';
import {
  filterRoutes,
  getAllWaits,
  getAllSpeeds,
  getAllScores,
  computeGrades,
  metersToMiles,
} from '../helpers/routeCalculations';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
function RouteSummary(props) {
  const { graphParams, precomputedStats, fetchPrecomputedStats } = props;
  const [tabValue, setTabValue] = React.useState(0);

  useEffect(() => {
    fetchPrecomputedStats(graphParams);
  }, [graphParams, fetchPrecomputedStats]); // like componentDidMount, this runs only on first render

  let wait = null;
  let speed = null;
  let dist = null;
  let waitObj = null;
  let waitRanking = null;
  let longWait = null;
  let speedObj = null;
  let speedRanking = null;
  let variability = null;
  let grades = null;
  let scoreObj = null;
  let scoreRanking = null;
  let allWaits = null;
  let allSpeeds = null;
  let allScores = null;

  let routes = null;

  if (graphParams.routeId) {
    routes = props.routes ? filterRoutes(props.routes) : [];

    allWaits = getAllWaits(precomputedStats.waitTimes, routes);
    allSpeeds = getAllSpeeds(precomputedStats.tripTimes, routes);
    allScores = getAllScores(routes, allWaits, allSpeeds);

    const routeId = graphParams.routeId;
    const route = routes.find(myRoute => myRoute.id === routeId);
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
    longWait = waitObj ? waitObj.longWait : null;

    speedObj = allSpeeds
      ? allSpeeds.find(obj => obj.routeId === routeId)
      : null;
    speedRanking = speedObj ? allSpeeds.indexOf(speedObj) + 1 : null;
    speed = speedObj ? speedObj.speed : null;
    variability = speedObj ? speedObj.variability : null;

    scoreObj = allScores
      ? allScores.find(obj => obj.routeId === routeId)
      : null;
    scoreRanking = scoreObj ? allScores.indexOf(scoreObj) + 1 : null;

    grades = computeGrades(wait, longWait, speed, variability);
  }

  const popoverContentTotalScore = grades ? (
    <Fragment>
      Route score of {grades.totalScore} is the average of the following
      subscores:
      <Box pt={2}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Median wait</TableCell>
              <TableCell align="right">{grades.medianWaitScore}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Long wait probability</TableCell>
              <TableCell align="right">{grades.longWaitScore}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Average speed</TableCell>
              <TableCell align="right"> {grades.speedScore}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Travel time variability</TableCell>
              <TableCell align="right"> {grades.travelVarianceScore}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </Fragment>
  ) : null;

  const popoverContentWait = grades ? (
    <Fragment>
      Median wait of {wait === null ? '--' : wait.toFixed(1)} min gets a score
      of {grades.medianWaitScore}.
      <Box pt={2}>
        <InfoScoreLegend
          rows={[
            { label: '5 min or less', value: 100 },
            { label: '6.25 min', value: 75 },
            { label: '7.5 min', value: 50 },
            { label: '8.75', value: 25 },
            { label: '10 min or more', value: 0 },
          ]}
        />
      </Box>
    </Fragment>
  ) : null;

  const popoverContentLongWait = grades ? (
    <Fragment>
      Long wait probability is the chance a rider has of a wait of twenty minutes or
      longer after arriving randomly at a stop.
      Probability of{' '}
      {(longWait * 100).toFixed(1) /* be more precise than card */}% gets a
      score of {grades.longWaitScore}.
      <Box pt={2}>
        <InfoScoreLegend
          rows={[
            { label: '10% or less', value: 100 },
            { label: '15.75%', value: 75 },
            { label: '21.5%', value: 50 },
            { label: '27.25%', value: 25 },
            { label: '33% or more', value: 0 },
          ]}
        />
      </Box>
    </Fragment>
  ) : null;

  const popoverContentSpeed = grades ? (
    <Fragment>
      This is the average of the speeds for median end to end trips, in all directions.
      Average speed of{' '}
      {speed === null || Number.isNaN(speed) ? '--' : speed.toFixed(1)} mph gets
      a score of {grades.speedScore}.
      <Box pt={2}>
        <InfoScoreLegend
          rows={[
            { label: '10 mph or more', value: 100 },
            { label: '8.75 mph', value: 75 },
            { label: '7.5 mph', value: 50 },
            { label: '6.25 mph', value: 25 },
            { label: '5 mph or less', value: 0 },
          ]}
        />
      </Box>
    </Fragment>
  ) : null;

  const popoverContentTravelVariability = grades ? (
    <Fragment>
      Travel time variability is the 90th percentile end to end travel time minus the 10th percentile
      travel time.  This measures how much extra travel time is needed for some trips.
      Variability of{' '}
      {variability === null ? '--' : '\u00b1' + variability.toFixed(1)} min gets a score of{' '}
      {grades.travelVarianceScore}.
      <Box pt={2}>
        <InfoScoreLegend
          rows={[
            { label: '5 min or less', value: 100 },
            { label: '6.25 min', value: 75 },
            { label: '7.5 min', value: 50 },
            { label: '8.75 min', value: 25 },
            { label: '10 min or more', value: 0 },
          ]}
        />
      </Box>
    </Fragment>
  ) : null;

  function handleTabChange(event, newValue) {
    setTabValue(newValue);
  }

  function a11yProps(index) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }

  const SUMMARY = 0;
  const TRAVEL_TIME = 1;
  const MAREY_CHART = 2;

  return (
    <Fragment>

      <br />
      <AppBar position="static" color="default">
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="tab bar"
          variant="scrollable"
          scrollButtons="on"
        >
          <Tab
            style={{ minWidth: 72 }}
            label="Summary"
            {...a11yProps(SUMMARY)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Travel Time"
            {...a11yProps(TRAVEL_TIME)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Marey Chart"
            {...a11yProps(MAREY_CHART)}
          />
        </Tabs>
      </AppBar>


      <Box p={2} hidden={tabValue !== SUMMARY}>
        <div style={{ padding: 8 }}>
        <Grid container spacing={4}>
          <InfoScoreCard
            grades={wait && speed && grades ? grades : null}
            gradeName="totalScore"
            hideRating
            title="Route Score"
            largeValue={wait && speed ? grades.totalScore : '--'}
            smallValue={`/${grades ? grades.highestPossibleScore : '--'}`}
            bottomContent={
              scoreRanking
                ? `#${scoreRanking} out of ${allScores.length} routes`
                : 'No data'
            }
            popoverContent={popoverContentTotalScore}
          />

          <InfoScoreCard
            grades={wait && grades ? grades : null}
            gradeName="medianWaitScore"
            title="Median Wait"
            largeValue={wait === null ? '--' : wait.toFixed(0)}
            smallValue="&nbsp;min"
            bottomContent={
              <Fragment>
                {waitRanking
                  ? `#${waitRanking} of ${allWaits.length} for shortest wait`
                  : null}
              </Fragment>
            }
            popoverContent={popoverContentWait}
          />

          <InfoScoreCard
            grades={wait && grades ? grades : null}
            gradeName="longWaitScore"
            title="Long Wait %"
            largeValue={(longWait * 100).toFixed(0)}
            smallValue="%"
            bottomContent={
              <Fragment>
                {longWait > 0
                  ? `1 time out of ${Math.round(1 / longWait)}`
                  : ''}
              </Fragment>
            }
            popoverContent={popoverContentLongWait}
          />

          <InfoScoreCard
            grades={speed && grades ? grades : null}
            gradeName="speedScore"
            title="Average Speed"
            largeValue={
              speed === null || Number.isNaN(speed) ? '--' : speed.toFixed(0)
            }
            smallValue="&nbsp;mph"
            bottomContent={
              <Fragment>
                {speedRanking
                  ? `#${speedRanking} of ${allSpeeds.length} for fastest`
                  : null}
                <br />
                {metersToMiles(dist).toFixed(1)} miles
              </Fragment>
            }
            popoverContent={popoverContentSpeed}
          />

          <InfoScoreCard
            grades={speed && grades ? grades : null}
            gradeName="travelVarianceScore"
            title="Travel Time Variability"
            largeValue={variability === null ? '--' : '\u00b1' + variability.toFixed(0)}
            smallValue="&nbsp;min"
            bottomContent="&nbsp;"
            popoverContent={popoverContentTravelVariability}
          />

        </Grid>
        </div>
        </Box>
      <Box p={2} hidden={tabValue !== TRAVEL_TIME} style={{overflowX: 'auto'}}>
        <TravelTimeChart />
      </Box>
      <Box p={2} hidden={tabValue !== MAREY_CHART} style={{overflowX: 'auto'}}>
        <MareyChart hidden={tabValue !== MAREY_CHART}/>
      </Box>
    </Fragment>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  graphParams: state.graphParams,
  precomputedStats: state.precomputedStats,
});

const mapDispatchToProps = dispatch => {
  return {
    fetchPrecomputedStats: params => dispatch(fetchPrecomputedStats(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteSummary);
