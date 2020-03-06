import React from 'react';

import { connect } from 'react-redux';

import { Table, TableBody, TableHead } from '@material-ui/core';

import SummaryRow from './SummaryRow';
import SummaryHeaderRow from './SummaryHeaderRow';
import { metersToMiles } from '../helpers/routeCalculations';
import { renderDateRange } from '../helpers/dateTime';

function RouteSummary(props) {
  const { graphParams, routeMetrics, routes } = props;

  const routeIntervalMetrics = routeMetrics ? routeMetrics.interval : null;
  const routeIntervalMetrics2 = routeMetrics ? routeMetrics.interval2 : null;

  const { routeId, directionId } = graphParams;

  const route = routes
    ? routes.find(thisRoute => thisRoute.id === routeId)
    : null;

  let dirInfo = null;
  let intervalMetrics = null;
  let intervalMetrics2 = null;

  if (directionId) {
    const directionIdFilter = d => d.directionId === directionId;

    intervalMetrics = routeIntervalMetrics
      ? routeIntervalMetrics.directions.find(directionIdFilter)
      : null;
    intervalMetrics2 = routeIntervalMetrics2
      ? routeIntervalMetrics2.directions.find(directionIdFilter)
      : null;

    dirInfo = route ? route.directions.find(directionIdFilter) : null;
  } else {
    intervalMetrics = routeIntervalMetrics;
    intervalMetrics2 = routeIntervalMetrics2;
  }

  let columns;
  let baseColumn;
  let headers;
  if (graphParams.secondDateRange) {
    columns = ['observed', 'observed2'];
    headers = [
      `${renderDateRange(graphParams.firstDateRange)} (Observed)`,
      `${renderDateRange(graphParams.secondDateRange)} (Observed)`,
    ];
    baseColumn = 'observed';
  } else {
    columns = ['observed', 'scheduled'];
    headers = ['Observed', 'Scheduled'];
    baseColumn = 'scheduled';
  }

  return (
    <>
      <Table>
        <TableHead>
          <SummaryHeaderRow headers={headers} />
        </TableHead>
        <TableBody>
          <SummaryRow
            label="Median Service Frequency"
            columns={columns}
            baseColumn={baseColumn}
            observed={intervalMetrics ? intervalMetrics.medianHeadway : null}
            observed2={intervalMetrics2 ? intervalMetrics2.medianHeadway : null}
            scheduled={
              intervalMetrics ? intervalMetrics.scheduledMedianHeadway : null
            }
            positiveDiffDesc="longer"
            negativeDiffDesc="shorter"
            goodDiffDirection={-1}
            precision={0}
            units="min"
            infoContent={
              <>
                This is the median (50th percentile) time between vehicles
                during the service period. The median service frequency for the
                entire route is the median of the median service frequency for
                each stop along the route.
              </>
            }
          />
          <SummaryRow
            label="Median Wait Time"
            columns={columns}
            baseColumn={baseColumn}
            observed={intervalMetrics ? intervalMetrics.medianWaitTime : null}
            observed2={
              intervalMetrics2 ? intervalMetrics2.medianWaitTime : null
            }
            scheduled={
              intervalMetrics ? intervalMetrics.scheduledMedianWaitTime : null
            }
            units="min"
            precision={0}
            positiveDiffDesc="longer"
            negativeDiffDesc="shorter"
            goodDiffDirection={-1}
            infoContent={
              <>
                This is the median (50th percentile) time you would expect to
                wait for the next vehicle to depart, assuming you arrived at a
                random time during the service period without using timetables
                or predictions. The median wait time for the entire route is the
                median of the median wait times for each stop along the route.
              </>
            }
          />
          <SummaryRow
            label="Average Speed"
            columns={columns}
            baseColumn={baseColumn}
            observed={intervalMetrics ? intervalMetrics.averageSpeed : null}
            observed2={intervalMetrics2 ? intervalMetrics2.averageSpeed : null}
            scheduled={
              intervalMetrics ? intervalMetrics.scheduledAverageSpeed : null
            }
            units="mph"
            precision={0}
            positiveDiffDesc="faster"
            negativeDiffDesc="slower"
            goodDiffDirection={1}
            infoContent={
              <>
                This is the average speed from end to end for the median
                completed trip (50th percentile travel time)
                {directionId ? '' : ', averaged over all directions'}.
              </>
            }
          />
          <SummaryRow
            label="On-Time Rate"
            columns={columns}
            baseColumn={baseColumn}
            observed={intervalMetrics ? intervalMetrics.onTimeRate * 100 : null}
            observed2={
              intervalMetrics2 ? intervalMetrics2.onTimeRate * 100 : null
            }
            scheduled=""
            units="%"
            precision={0}
            infoContent={
              <>
                This is the percentage of scheduled departure times where a
                vehicle departed less than 5 minutes after the scheduled
                departure time or less than 1 minute before the scheduled
                departure time. The on-time percentage for the entire route is
                the median of the on-time percentage for each stop along the
                route.
              </>
            }
          />
          {directionId ? (
            <>
              <SummaryRow
                label="Completed Trips"
                columns={columns}
                baseColumn={baseColumn}
                observed={
                  intervalMetrics ? intervalMetrics.completedTrips : null
                }
                observed2={
                  intervalMetrics2 ? intervalMetrics2.completedTrips : null
                }
                scheduled={
                  intervalMetrics
                    ? intervalMetrics.scheduledCompletedTrips
                    : null
                }
                positiveDiffDesc="more"
                negativeDiffDesc="fewer"
                goodDiffDirection={1}
              />
              {!graphParams.secondDateRange ? (
                <>
                  <SummaryRow
                    label="Travel Distance"
                    columns={columns}
                    scheduled={dirInfo ? metersToMiles(dirInfo.distance) : null}
                    units="mi"
                    precision={1}
                  />
                  <SummaryRow
                    label="Stops"
                    columns={columns}
                    scheduled={dirInfo ? dirInfo.stops.length : null}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </TableBody>
      </Table>
    </>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  graphParams: state.graphParams,
  routeMetrics: state.routeMetrics.data,
});

export default connect(mapStateToProps)(RouteSummary);
