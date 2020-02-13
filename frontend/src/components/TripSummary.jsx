/**
 * Stop to stop trip summary component.
 */

import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import { Table, TableBody, TableHead } from '@material-ui/core';

import { getDistanceInMiles, getTripStops } from '../helpers/mapGeometry';
import SummaryRow from './SummaryRow';
import SummaryHeaderRow from './SummaryHeaderRow';

function TripSummary(props) {
  const { tripMetrics, graphParams, routes } = props;

  const { startStopId, endStopId, directionId } = graphParams;

  const intervalMetrics = tripMetrics ? tripMetrics.interval : null;

  const waitTimes = intervalMetrics ? intervalMetrics.waitTimes : null;
  const scheduledWaitTimes = intervalMetrics
    ? intervalMetrics.scheduledWaitTimes
    : null;
  const tripTimes = intervalMetrics ? intervalMetrics.tripTimes : null;
  const scheduledTripTimes = intervalMetrics
    ? intervalMetrics.scheduledTripTimes
    : null;
  const headways = intervalMetrics ? intervalMetrics.headways : null;
  const scheduledHeadways = intervalMetrics
    ? intervalMetrics.scheduledHeadways
    : null;

  const departureScheduleAdherence = intervalMetrics
    ? intervalMetrics.departureScheduleAdherence
    : null;
  const arrivalScheduleAdherence = intervalMetrics
    ? intervalMetrics.arrivalScheduleAdherence
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

  const averageSpeed = getAverageSpeed(tripTimes);
  const scheduledAverageSpeed = getAverageSpeed(scheduledTripTimes);

  const getOnTimePercent = scheduleAdherence => {
    return scheduleAdherence && scheduleAdherence.scheduledCount > 0
      ? (100 * scheduleAdherence.onTimeCount) / scheduleAdherence.scheduledCount
      : null;
  };

  return (
    <Fragment>
      <div>
        <Table aria-labelledby="tableTitle">
          <TableHead>
            <SummaryHeaderRow />
          </TableHead>
          <TableBody>
            <SummaryRow
              label="Median Service Frequency"
              actual={headways ? headways.median : null}
              scheduled={scheduledHeadways ? scheduledHeadways.median : null}
              units="min"
              precision={0}
              positiveDiffDesc="longer"
              negativeDiffDesc="shorter"
              goodDiffDirection={-1}
              infoContent={
                <Fragment>
                  This is the median (50th percentile) time between vehicles
                  during the service period.
                </Fragment>
              }
            />
            <SummaryRow
              label="Median Wait Time"
              actual={waitTimes ? waitTimes.median : null}
              scheduled={scheduledWaitTimes ? scheduledWaitTimes.median : null}
              units="min"
              precision={0}
              positiveDiffDesc="longer"
              negativeDiffDesc="shorter"
              goodDiffDirection={-1}
              infoContent={
                <Fragment>
                  This is the median time you would expect to wait at the origin
                  stop for the next vehicle to depart, assuming you arrived at a
                  random time during the service period without using timetables
                  or predictions.
                </Fragment>
              }
            />
            <SummaryRow
              label="Median Travel Time"
              actual={tripTimes ? tripTimes.median : null}
              scheduled={scheduledTripTimes ? scheduledTripTimes.median : null}
              units="min"
              precision={0}
              positiveDiffDesc="longer"
              negativeDiffDesc="shorter"
              goodDiffDirection={-1}
              infoContent={
                <Fragment>
                  This is the median (50th percentile) travel time between the
                  origin stop and the destination stop.
                </Fragment>
              }
            />
            <SummaryRow
              label="Average Speed"
              actual={averageSpeed}
              scheduled={scheduledAverageSpeed}
              units="mph"
              precision={0}
              positiveDiffDesc="faster"
              negativeDiffDesc="slower"
              goodDiffDirection={1}
              infoContent={
                <Fragment>
                  This is the average speed corresponding to the median travel
                  time (not counting wait time).
                </Fragment>
              }
            />
            <SummaryRow
              label="Completed Trips"
              actual={tripTimes ? tripTimes.count : null}
              scheduled={scheduledTripTimes ? scheduledTripTimes.count : null}
              positiveDiffDesc="more"
              negativeDiffDesc="fewer"
              goodDiffDirection={1}
            />
            {/* <SummaryRow
              label="Total Departures"
              actual={intervalMetrics ? intervalMetrics.departures : null}
              scheduled={
                intervalMetrics ? intervalMetrics.scheduledDepartures : null
              }
              positiveDiffDesc="more"
              negativeDiffDesc="fewer"
              goodDiffDirection={1}
            />
            <SummaryRow
              label="Total Arrivals"
              actual={intervalMetrics ? intervalMetrics.arrivals : null}
              scheduled={
                intervalMetrics ? intervalMetrics.scheduledArrivals : null
              }
              positiveDiffDesc="more"
              negativeDiffDesc="fewer"
              goodDiffDirection={1}
            /> */}
            <SummaryRow
              label="On-Time Departure %"
              actual={getOnTimePercent(departureScheduleAdherence)}
              units="%"
              precision={0}
              infoContent={
                <Fragment>
                  This is the percentage of scheduled departure times where a
                  vehicle departed less than 5 minutes after the scheduled
                  departure time or less than 1 minute before the scheduled
                  departure time.
                </Fragment>
              }
            />
            <SummaryRow
              label="On-Time Arrival %"
              actual={getOnTimePercent(arrivalScheduleAdherence)}
              units="%"
              precision={0}
            />
            <SummaryRow
              label="Travel Distance"
              scheduled={distance}
              units="mi"
              precision={1}
            />
            <SummaryRow
              label="Stops"
              scheduled={tripStops ? tripStops.length - 1 : null}
            />
          </TableBody>
        </Table>
      </div>
    </Fragment>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  graphParams: state.graphParams,
  tripMetrics: state.tripMetrics.data,
});

export default connect(mapStateToProps)(TripSummary);
