import React, { Fragment } from 'react';

import { connect } from 'react-redux';

import { Table, TableBody, TableHead } from '@material-ui/core';

import SummaryRow from './SummaryRow';
import SummaryHeaderRow from './SummaryHeaderRow';
import { metersToMiles } from '../helpers/routeCalculations';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
function RouteSummary(props) {
  const { graphParams, statsByRouteId, routeMetrics, routes } = props;

  const routeIntervalMetrics = routeMetrics ? routeMetrics.interval : null;

  const { routeId, directionId } = graphParams;
  const routeStats = statsByRouteId[routeId] || { directions: [] };

  const route = routes
    ? routes.find(thisRoute => thisRoute.id === routeId)
    : null;

  let stats = null;
  let dirInfo = null;
  let intervalMetrics = null;
  if (directionId) {
    stats =
      routeStats.directions.find(
        dirStats => dirStats.directionId === directionId,
      ) || {};

    intervalMetrics = routeIntervalMetrics
      ? routeIntervalMetrics.directions.find(
          dirStats => dirStats.directionId === directionId,
        )
      : null;
    dirInfo = route
      ? route.directions.find(dir => dir.id === directionId)
      : null;
  } else {
    stats = routeStats;
    intervalMetrics = routeIntervalMetrics;
  }

  return (
    <>
      <Table>
        <TableHead>
          <SummaryHeaderRow />
        </TableHead>
        <TableBody>
          <SummaryRow
            label="Median Service Frequency"
            actual={stats.medianHeadway}
            scheduled={
              intervalMetrics ? intervalMetrics.scheduledMedianHeadway : null
            }
            positiveDiffDesc="longer"
            negativeDiffDesc="shorter"
            goodDiffDirection={-1}
            precision={0}
            units="min"
            infoContent={
              <Fragment>
                This is the median (50th percentile) time between vehicles
                during the service period. The median service frequency for the
                entire route is the median of the median service frequency for
                each stop along the route.
              </Fragment>
            }
          />
          <SummaryRow
            label="Median Wait Time"
            actual={stats.medianWaitTime}
            scheduled={
              intervalMetrics ? intervalMetrics.scheduledMedianWaitTime : null
            }
            units="min"
            precision={0}
            positiveDiffDesc="longer"
            negativeDiffDesc="shorter"
            goodDiffDirection={-1}
            infoContent={
              <Fragment>
                This is the median (50th percentile) time you would expect to
                wait for the next vehicle to depart, assuming you arrived at a
                random time during the service period without using timetables
                or predictions. The median wait time for the entire route is the
                median of the median wait times for each stop along the route.
              </Fragment>
            }
          />
          <SummaryRow
            label="Average Speed"
            actual={stats.averageSpeed}
            scheduled={
              intervalMetrics ? intervalMetrics.scheduledAverageSpeed : null
            }
            units="mph"
            precision={0}
            positiveDiffDesc="faster"
            negativeDiffDesc="slower"
            goodDiffDirection={1}
            infoContent={
              <Fragment>
                This is the average speed from end to end for the median
                completed trip (50th percentile travel time)
                {directionId ? '' : ', averaged over all directions'}.
              </Fragment>
            }
          />
          <SummaryRow
            label="On-Time %"
            actual={stats.onTimeRate != null ? stats.onTimeRate * 100 : null}
            scheduled=""
            units="%"
            precision={0}
            infoContent={
              <Fragment>
                This is the percentage of scheduled departure times where a
                vehicle departed less than 5 minutes after the scheduled
                departure time or less than 1 minute before the scheduled
                departure time. The on-time percentage for the entire route is
                the median of the on-time percentage for each stop along the
                route.
              </Fragment>
            }
          />
          {directionId ? (
            <Fragment>
              <SummaryRow
                label="Completed Trips"
                actual={intervalMetrics ? intervalMetrics.completedTrips : null}
                scheduled={
                  intervalMetrics
                    ? intervalMetrics.scheduledCompletedTrips
                    : null
                }
                positiveDiffDesc="more"
                negativeDiffDesc="fewer"
                goodDiffDirection={1}
              />
              <SummaryRow
                label="Travel Distance"
                scheduled={dirInfo ? metersToMiles(dirInfo.distance) : null}
                units="mi"
                precision={1}
              />
              <SummaryRow
                label="Stops"
                scheduled={dirInfo ? dirInfo.stops.length : null}
              />
            </Fragment>
          ) : null}
        </TableBody>
      </Table>
    </>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  graphParams: state.graphParams,
  statsByRouteId: state.agencyMetrics.statsByRouteId,
  routeMetrics: state.routeMetrics.data,
});

export default connect(mapStateToProps)(RouteSummary);
