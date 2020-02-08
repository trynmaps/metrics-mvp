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
import { HighestPossibleScore } from '../helpers/routeCalculations';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
function RouteSummary(props) {
  const { graphParams, statsByRouteId } = props;
  const [tabValue, setTabValue] = React.useState(0);

  const { routeId, directionId } = graphParams;
  const routeStats = statsByRouteId[routeId] || { directions: [] };

  let stats = null;
  if (directionId) {
    stats =
      routeStats.directions.find(
        dirStats => dirStats.directionId === directionId,
      ) || {};
  } else {
    stats = routeStats;
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
                <TableCell>On-Time rate</TableCell>
                <TableCell align="right">{stats.onTimeRateScore}</TableCell>
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
    stats.medianWaitTime != null ? (
      <Fragment>
        Median wait of {stats.medianWaitTime.toFixed(1)} min gets a score of{' '}
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

  const popoverContentOnTimeRate =
    stats.onTimeRate != null ? (
      <Fragment>
        The on-time percentage is the percentage of scheduled departure times
        where a vehicle departed less than 5 minutes after the scheduled
        departure time or less than 1 minute before the scheduled departure
        time. Probability of{' '}
        {(stats.onTimeRate * 100).toFixed(1) /* be more precise than card */}%
        gets a score of {stats.onTimeRateScore}.
      </Fragment>
    ) : null;

  const popoverContentSpeed =
    stats.averageSpeed != null ? (
      <Fragment>
        This is the average of the speeds for median end to end trips, in all
        directions. Average speed of {stats.averageSpeed.toFixed(1)} mph gets a
        score of {stats.speedScore}.
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
    stats.travelTimeVariability != null ? (
      <Fragment>
        Travel time variability is difference between the 90th percentile end to
        end travel time and the 10th percentile travel time. This measures how
        much extra travel time is needed for some trips. Variability of
        {' \u00b1'}
        {(stats.travelTimeVariability / 2).toFixed(1)} min gets a score of{' '}
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
                  ? `#${stats.scoreRank} of ${stats.scoreRankCount} routes`
                  : ''
              }
              popoverContent={popoverContentTotalScore}
            />
            <InfoScoreCard
              score={stats.medianWaitScore}
              title="Median Wait"
              largeValue={
                stats.medianWaitTime != null
                  ? stats.medianWaitTime.toFixed(0)
                  : '--'
              }
              smallValue="&nbsp;min"
              bottomContent={
                <Fragment>
                  {stats.waitRank != null
                    ? `#${stats.waitRank} of ${stats.waitRankCount} routes`
                    : null}
                </Fragment>
              }
              popoverContent={popoverContentWait}
            />

            <InfoScoreCard
              score={stats.onTimeRateScore}
              title="On-Time %"
              largeValue={
                stats.onTimeRate != null
                  ? (stats.onTimeRate * 100).toFixed(0)
                  : '--'
              }
              smallValue="%"
              popoverContent={popoverContentOnTimeRate}
              bottomContent={
                stats.onTimeRank != null
                  ? `#${stats.onTimeRank} of ${stats.onTimeRankCount} routes`
                  : ''
              }
            />

            <InfoScoreCard
              score={stats.speedScore}
              title="Average Speed"
              largeValue={
                stats.averageSpeed != null
                  ? stats.averageSpeed.toFixed(0)
                  : '--'
              }
              smallValue="&nbsp;mph"
              bottomContent={
                <Fragment>
                  {stats.speedRank != null
                    ? `#${stats.speedRank} of ${stats.speedRankCount} routes`
                    : null}
                </Fragment>
              }
              popoverContent={popoverContentSpeed}
            />

            <InfoScoreCard
              score={stats.travelVarianceScore}
              title="Travel Time Variability"
              largeValue={
                stats.travelTimeVariability != null
                  ? `\u00b1${(stats.travelTimeVariability / 2).toFixed(0)}`
                  : '--'
              }
              smallValue="&nbsp;min"
              bottomContent={
                stats.variabilityRank != null
                  ? `#${stats.variabilityRank} of ${stats.variabilityRankCount} routes`
                  : ''
              }
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
  statsByRouteId: state.agencyMetrics.statsByRouteId,
});

export default connect(mapStateToProps)(RouteSummary);
