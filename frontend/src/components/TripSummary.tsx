import React from 'react';
import { connect } from 'react-redux';
import { Table, TableBody, TableHead } from '@material-ui/core';
import { getDistanceInMiles, getTripStops, renderDateRange } from 'helpers';
import SummaryRow from './SummaryRow';
import SummaryHeaderRow from './SummaryHeaderRow';

/*
 * Renders the Summary tab on the RouteScreen when a route, direction, start stop, and end stop are selected.
 *
 * When a single date range is selected, displays a table comparing observed and scheduled metrics.
 * When two date ranges are selected, displays a table comparing observed metrics from both date ranges.
 */
function TripSummary(props) {
  const { tripMetrics, graphParams, routes } = props;

  const { startStopId, endStopId, directionId } = graphParams;

  const intervalMetrics = tripMetrics ? tripMetrics.interval : null;
  const intervalMetrics2 = tripMetrics ? tripMetrics.interval2 : null;

  const waitTimes = intervalMetrics ? intervalMetrics.waitTimes : null;
  const waitTimes2 = intervalMetrics2 ? intervalMetrics2.waitTimes : null;

  const scheduledWaitTimes = intervalMetrics
    ? intervalMetrics.scheduledWaitTimes
    : null;

  const tripTimes = intervalMetrics ? intervalMetrics.tripTimes : null;
  const tripTimes2 = intervalMetrics2 ? intervalMetrics2.tripTimes : null;

  const scheduledTripTimes = intervalMetrics
    ? intervalMetrics.scheduledTripTimes
    : null;

  const headways = intervalMetrics ? intervalMetrics.headways : null;
  const headways2 = intervalMetrics2 ? intervalMetrics2.headways : null;

  const scheduledHeadways = intervalMetrics
    ? intervalMetrics.scheduledHeadways
    : null;

  const departureScheduleAdherence = intervalMetrics
    ? intervalMetrics.departureScheduleAdherence
    : null;

  const departureScheduleAdherence2 = intervalMetrics2
    ? intervalMetrics2.departureScheduleAdherence
    : null;

  const arrivalScheduleAdherence = intervalMetrics
    ? intervalMetrics.arrivalScheduleAdherence
    : null;

  const arrivalScheduleAdherence2 = intervalMetrics2
    ? intervalMetrics2.arrivalScheduleAdherence
    : null;

  const routeId = graphParams.routeId;
  const route = routes
    ? routes.find(thisRoute => thisRoute.id === routeId)
    : null;
  const dirInfo = route
    ? route.directions.find(dir => dir.id === directionId)
    : null;

  const tripStops =
    route && dirInfo && endStopId
      ? getTripStops(route, dirInfo, startStopId, endStopId)
      : null;

  const distance =
    route && dirInfo && endStopId
      ? getDistanceInMiles(route, dirInfo, startStopId, endStopId)
      : null;

  const getAverageSpeed = tripTimeMetrics => {
    return tripTimeMetrics && tripTimeMetrics.count > 0 && distance
      ? distance / (tripTimeMetrics.median / 60.0)
      : null; // convert avg trip time to hours for mph
  };

  const getOnTimePercent = scheduleAdherence => {
    return scheduleAdherence && scheduleAdherence.scheduledCount > 0
      ? (100 * scheduleAdherence.onTimeCount) / scheduleAdherence.scheduledCount
      : null;
  };

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
      <div>
        <Table aria-labelledby="tableTitle">
          <TableHead>
            <SummaryHeaderRow headers={headers} />
          </TableHead>
          <TableBody>
            <SummaryRow
              label="Median Service Frequency"
              columns={columns}
              baseColumn={baseColumn}
              observed={headways ? headways.median : null}
              observed2={headways2 ? headways2.median : null}
              scheduled={scheduledHeadways ? scheduledHeadways.median : null}
              units="min"
              precision={0}
              positiveDiffDesc="longer"
              negativeDiffDesc="shorter"
              goodDiffDirection={-1}
              infoContent={
                <>
                  This is the median (50th percentile) time between vehicles
                  during the service period.
                </>
              }
            />
            <SummaryRow
              label="Median Wait Time"
              columns={columns}
              baseColumn={baseColumn}
              observed={waitTimes ? waitTimes.median : null}
              observed2={waitTimes2 ? waitTimes2.median : null}
              scheduled={scheduledWaitTimes ? scheduledWaitTimes.median : null}
              units="min"
              precision={0}
              positiveDiffDesc="longer"
              negativeDiffDesc="shorter"
              goodDiffDirection={-1}
              infoContent={
                <>
                  This is the median time you would expect to wait at the origin
                  stop for the next vehicle to depart, assuming you arrived at a
                  random time during the service period without using timetables
                  or predictions.
                </>
              }
            />
            <SummaryRow
              label="Median Travel Time"
              columns={columns}
              baseColumn={baseColumn}
              observed={tripTimes ? tripTimes.median : null}
              observed2={tripTimes2 ? tripTimes2.median : null}
              scheduled={scheduledTripTimes ? scheduledTripTimes.median : null}
              units="min"
              precision={0}
              positiveDiffDesc="longer"
              negativeDiffDesc="shorter"
              goodDiffDirection={-1}
              infoContent={
                <>
                  This is the median (50th percentile) travel time between the
                  origin stop and the destination stop.
                </>
              }
            />
            <SummaryRow
              label="Average Speed"
              columns={columns}
              baseColumn={baseColumn}
              observed={getAverageSpeed(tripTimes)}
              observed2={getAverageSpeed(tripTimes2)}
              scheduled={getAverageSpeed(scheduledTripTimes)}
              units="mph"
              precision={0}
              positiveDiffDesc="faster"
              negativeDiffDesc="slower"
              goodDiffDirection={1}
              infoContent={
                <>
                  This is the average speed corresponding to the median travel
                  time (not counting wait time).
                </>
              }
            />
            <SummaryRow
              label="Completed Trips"
              columns={columns}
              baseColumn={baseColumn}
              observed={tripTimes ? tripTimes.count : null}
              observed2={tripTimes2 ? tripTimes2.count : null}
              scheduled={scheduledTripTimes ? scheduledTripTimes.count : null}
              positiveDiffDesc="more"
              negativeDiffDesc="fewer"
              goodDiffDirection={1}
            />
            {/* <SummaryRow
              label="Total Departures"
              observed={intervalMetrics ? intervalMetrics.departures : null}
              scheduled={
                intervalMetrics ? intervalMetrics.scheduledDepartures : null
              }
              positiveDiffDesc="more"
              negativeDiffDesc="fewer"
              goodDiffDirection={1}
            />
            <SummaryRow
              label="Total Arrivals"
              observed={intervalMetrics ? intervalMetrics.arrivals : null}
              scheduled={
                intervalMetrics ? intervalMetrics.scheduledArrivals : null
              }
              positiveDiffDesc="more"
              negativeDiffDesc="fewer"
              goodDiffDirection={1}
            /> */}
            <SummaryRow
              label="On-Time Departure Rate"
              columns={columns}
              baseColumn={baseColumn}
              observed={getOnTimePercent(departureScheduleAdherence)}
              observed2={getOnTimePercent(departureScheduleAdherence2)}
              units="%"
              precision={0}
              infoContent={
                <>
                  This is the percentage of scheduled departure times where a
                  vehicle departed less than 5 minutes after the scheduled
                  departure time or less than 1 minute before the scheduled
                  departure time.
                </>
              }
            />
            <SummaryRow
              label="On-Time Arrival Rate"
              columns={columns}
              baseColumn={baseColumn}
              observed={getOnTimePercent(arrivalScheduleAdherence)}
              observed2={getOnTimePercent(arrivalScheduleAdherence2)}
              units="%"
              precision={0}
            />
            {!graphParams.secondDateRange ? (
              <>
                <SummaryRow
                  columns={columns}
                  label="Travel Distance"
                  scheduled={distance}
                  units="mi"
                  precision={1}
                />
                <SummaryRow
                  label="Stops"
                  columns={columns}
                  scheduled={tripStops ? tripStops.length - 1 : null}
                />
              </>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  graphParams: state.graphParams,
  tripMetrics: state.tripMetrics.data,
});

export default connect(mapStateToProps)(TripSummary);
