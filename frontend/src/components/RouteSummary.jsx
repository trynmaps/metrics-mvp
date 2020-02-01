import React, { Fragment } from 'react';

import { connect } from 'react-redux';

import Grid from '@material-ui/core/Grid';

import {
  AppBar,
  Box,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@material-ui/core';

import InfoScoreCard from './InfoScoreCard';
import InfoScoreLegend from './InfoScoreLegend';
import TravelTimeChart from './TravelTimeChart';
import MareyChart from './MareyChart';
import {
  metersToMiles,
  HighestPossibleScore,
} from '../helpers/routeCalculations';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
function RouteSummary(props) {
  const { graphParams, routeStats } = props;
  const [tabValue, setTabValue] = React.useState(0);

  const stats = routeStats[graphParams.routeId] || {};

  let dist = null;
  const routeId = graphParams.routeId;
  if (routeId) {
    const route = (props.routes || []).find(myRoute => myRoute.id === routeId);
    if (route) {
      const sumOfDistances = route.directions.reduce(
        (total, value) => total + value.distance,
        0,
      );
      dist = sumOfDistances / route.directions.length;
    }
  }

  const popoverContentTotalScore =
    stats.totalScore != null ? (
      <Fragment>
        Route score of {stats.totalScore} is the average of the following
        subscores:
        <Box pt={2}>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Median wait</TableCell>
                <TableCell align="right">{stats.medianWaitScore}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Long wait probability</TableCell>
                <TableCell align="right">{stats.longWaitScore}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Average speed</TableCell>
                <TableCell align="right"> {stats.speedScore}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Travel time variability</TableCell>
                <TableCell align="right">
                  {' '}
                  {stats.travelVarianceScore}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Fragment>
    ) : null;

  const popoverContentWait =
    stats.wait != null ? (
      <Fragment>
        Median wait of {stats.wait.toFixed(1)} min gets a score of{' '}
        {stats.medianWaitScore}.
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

  const popoverContentLongWait =
    stats.longWait != null ? (
      <Fragment>
        Long wait probability is the chance a rider has of a wait of twenty
        minutes or longer after arriving randomly at a stop. Probability of{' '}
        {(stats.longWait * 100).toFixed(1) /* be more precise than card */}%
        gets a score of {stats.longWaitScore}.
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

  const popoverContentSpeed =
    stats.speed != null ? (
      <Fragment>
        This is the average of the speeds for median end to end trips, in all
        directions. Average speed of {stats.speed.toFixed(1)} mph gets a score
        of {stats.speedScore}.
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

  const popoverContentTravelVariability =
    stats.variability != null ? (
      <Fragment>
        Travel time variability is the 90th percentile end to end travel time
        minus the 10th percentile travel time. This measures how much extra
        travel time is needed for some trips. Variability of{' '}
        {stats.variability.toFixed(1)} min gets a score of{' '}
        {stats.travelVarianceScore}.
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
              score={stats.totalScore}
              hideRating
              title="Route Score"
              largeValue={stats.totalScore != null ? stats.totalScore : '--'}
              smallValue={`/${HighestPossibleScore}`}
              bottomContent={
                stats.scoreRank != null
                  ? `#${stats.scoreRank} out of ${stats.scoreRankCount} routes`
                  : ''
              }
              popoverContent={popoverContentTotalScore}
            />

            <InfoScoreCard
              score={stats.medianWaitScore}
              title="Median Wait"
              largeValue={stats.wait != null ? stats.wait.toFixed(0) : '--'}
              smallValue="&nbsp;min"
              bottomContent={
                <Fragment>
                  {stats.waitRank != null
                    ? `#${stats.waitRank} of ${stats.waitRankCount} for shortest wait`
                    : null}
                </Fragment>
              }
              popoverContent={popoverContentWait}
            />

            <InfoScoreCard
              score={stats.longWaitScore}
              title="Long Wait %"
              largeValue={
                stats.longWait != null
                  ? (stats.longWait * 100).toFixed(0)
                  : '--'
              }
              smallValue="%"
              bottomContent={
                <Fragment>
                  {stats.longWait > 0
                    ? `1 time out of ${Math.round(1 / stats.longWait)}`
                    : ''}
                </Fragment>
              }
              popoverContent={popoverContentLongWait}
            />

            <InfoScoreCard
              score={stats.speedScore}
              title="Average Speed"
              largeValue={stats.speed != null ? stats.speed.toFixed(0) : '--'}
              smallValue="&nbsp;mph"
              bottomContent={
                <Fragment>
                  {stats.speedRank != null
                    ? `#${stats.speedRank} of ${stats.speedRankCount} for fastest`
                    : null}
                  <br />
                  {metersToMiles(dist).toFixed(1)} miles
                </Fragment>
              }
              popoverContent={popoverContentSpeed}
            />

            <InfoScoreCard
              score={stats.travelVarianceScore}
              title="Travel Time Variability"
              largeValue={
                stats.variability != null
                  ? `\u00b1${stats.variability.toFixed(0)}`
                  : '--'
              }
              smallValue="&nbsp;min"
              bottomContent="&nbsp;"
              popoverContent={popoverContentTravelVariability}
            />
          </Grid>
        </div>
      </Box>
      <Box
        p={2}
        hidden={tabValue !== TRAVEL_TIME}
        style={{ overflowX: 'auto' }}
      >
        <TravelTimeChart />
      </Box>
      <Box
        p={2}
        hidden={tabValue !== MAREY_CHART}
        style={{ overflowX: 'auto' }}
      >
        <MareyChart hidden={tabValue !== MAREY_CHART} />
      </Box>
    </Fragment>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  graphParams: state.graphParams,
  routeStats: state.routeStats,
});

const mapDispatchToProps = dispatch => {
  return {};
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteSummary);
