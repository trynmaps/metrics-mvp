import React, { Fragment } from 'react';
import { connect } from 'react-redux';
import { Box, Table, TableBody, TableCell, TableRow } from '@material-ui/core';
import InfoScoreCard from './InfoScoreCard';
import InfoScoreLegend from './InfoScoreLegend';
import { HighestPossibleScore } from '../helpers/routeCalculations';
import { NO_VALUE } from '../UIConstants';
/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
function RouteSummaryCards(props) {
  const { graphParams, statsByRouteId, statsByRouteId2 } = props;

  const { routeId, directionId } = graphParams;
  const routeStats = statsByRouteId[routeId] || { directions: [] };
  const routeStats2 =
    statsByRouteId2 && (statsByRouteId2[routeId] || { directions: [] });

  function filterRouteStatsByDirection(myRouteStats) {
    let stats = null;
    if (directionId) {
      stats =
        myRouteStats.directions.find(
          dirStats => dirStats.directionId === directionId,
        ) || {};
    } else {
      stats = myRouteStats;
    }
    return stats;
  }

  const stats = filterRouteStatsByDirection(routeStats);
  const stats2 = statsByRouteId2
    ? filterRouteStatsByDirection(routeStats2)
    : null;

  const popovers = {};
  popovers.contentTotalScore =
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

  popovers.contentWait =
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

  popovers.contentOnTimeRate =
    stats.onTimeRate != null ? (
      <Fragment>
        The on-time percentage is the percentage of scheduled departure times
        where a vehicle departed less than 5 minutes after the scheduled
        departure time or less than 1 minute before the scheduled departure
        time. The on-time percentage for the entire route is the median of the
        on-time percentage for each stop along the route. Probability of{' '}
        {(stats.onTimeRate * 100).toFixed(1) /* be more precise than card */}%
        gets a score of {stats.onTimeRateScore}.
      </Fragment>
    ) : null;

  popovers.contentSpeed =
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

  popovers.contentTravelVariability =
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

  const toFixedZero = stat => (stat != null ? stat.toFixed(0) : null);

  const rateToFixedZero = stat =>
    stat != null ? (stat * 100).toFixed(0) : null;

  const variabilityToFixedZero = stat =>
    stat != null ? (stat / 2).toFixed(0) : null;

  return (
    <Fragment>
      <InfoScoreCard
        score={stats.totalScore}
        hideRating
        preserveRatingSpace
        title="Route Score"
        firstValue={stats.totalScore}
        secondValue={statsByRouteId2 ? stats2.totalScore : NO_VALUE}
        valueSuffix={`/${HighestPossibleScore}`}
        bottomContent={
          stats.scoreRank != null
            ? `#${stats.scoreRank} of ${stats.scoreRankCount} routes`
            : ''
        }
        popoverContent={popovers.contentTotalScore}
      />
      <InfoScoreCard
        score={stats.medianWaitScore}
        title="Median Wait"
        firstValue={toFixedZero(stats.medianWaitTime)}
        secondValue={
          statsByRouteId2 ? toFixedZero(stats2.medianWaitTime) : NO_VALUE
        }
        valueSuffix="&nbsp;min"
        bottomContent={
          <Fragment>
            {stats.waitRank != null
              ? `#${stats.waitRank} of ${stats.waitRankCount} routes`
              : null}
          </Fragment>
        }
        popoverContent={popovers.contentWait}
      />

      <InfoScoreCard
        score={stats.onTimeRateScore}
        title="On-Time %"
        firstValue={rateToFixedZero(stats.onTimeRate)}
        secondValue={
          statsByRouteId2 ? rateToFixedZero(stats2.onTimeRate) : NO_VALUE
        }
        valueSuffix="%"
        popoverContent={popovers.contentOnTimeRate}
        bottomContent={
          stats.onTimeRank != null
            ? `#${stats.onTimeRank} of ${stats.onTimeRankCount} routes`
            : ''
        }
      />

      <InfoScoreCard
        score={stats.speedScore}
        title="Average Speed"
        firstValue={toFixedZero(stats.averageSpeed)}
        secondValue={
          statsByRouteId2 ? toFixedZero(stats.averageSpeed) : NO_VALUE
        }
        valueSuffix="&nbsp;mph"
        bottomContent={
          <Fragment>
            {stats.speedRank != null
              ? `#${stats.speedRank} of ${stats.speedRankCount} routes`
              : null}
          </Fragment>
        }
        popoverContent={popovers.contentSpeed}
      />

      <InfoScoreCard
        score={stats.travelVarianceScore}
        title="Travel Time Variability"
        firstValue={variabilityToFixedZero(stats.travelTimeVariability)}
        secondValue={
          statsByRouteId2
            ? variabilityToFixedZero(stats2.travelTimeVariability)
            : NO_VALUE
        }
        valuePrefix={`\u00b1`}
        valueSuffix="&nbsp;min"
        bottomContent={
          stats.variabilityRank != null
            ? `#${stats.variabilityRank} of ${stats.variabilityRankCount} routes`
            : ''
        }
        popoverContent={popovers.contentTravelVariability}
      />
    </Fragment>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  graphParams: state.graphParams,
  statsByRouteId: state.agencyMetrics.statsByRouteId,
  statsByRouteId2: state.agencyMetrics.statsByRouteId2,
});

export default connect(mapStateToProps)(RouteSummaryCards);
