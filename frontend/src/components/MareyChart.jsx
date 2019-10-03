/* eslint no-unused-vars: ["warn", { "varsIgnorePattern": "MomentTZ" }] */

/* Note: Importing MomentTZ adds new methods to Moment.  MomentTZ is not meant to be used directly. */

import React, { useState, useEffect } from 'react';

import {
  XYPlot,
  HorizontalGridLines,
  VerticalGridLines,
  XAxis,
  YAxis,
  LineMarkSeries,
  ChartLabel,
  Hint,
  Borders,
} from 'react-vis';
import '../../node_modules/react-vis/dist/style.css';

import { connect } from 'react-redux';

import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import {
  Card,
  CardContent,
  Radio,
  FormControl,
  FormControlLabel,
} from '@material-ui/core';

import Moment from 'moment';
import MomentTZ from 'moment-timezone/builds/moment-timezone-with-data-10-year-range'; // this augments Moment

import * as d3 from 'd3';
import { fetchArrivals } from '../actions';
import { TIME_ZONE_NAME, DWELL_THRESHOLD_SECS } from '../UIConstants';

import { metersToMiles } from '../helpers/routeCalculations';

/**
 * Within state.route.arrivals, the data is organized as follows:
 *
 * Top level dictionary with version, agency, route_id, start_time/end_time timestamps
 * Stops dictionary by stop id -> arrivals -> direction id (usually just one) -> array of data points
 * Each data point is time in (t), time of exit (e), vehicle id (v), trip id (i), distance (d)
 *
 * Ideally, each trip (and vehicle) would already be its own data series.  For now, we can rebucket
 * the data on the client side.  Goal is to create the following structure:
 *
 * Dictionary of objects keyed by trip id
 *   - tripId
 *   - vehicleId (for coloring)
 *   - series: array of objects (eventually sorted by distance along route) containing:
 *     - stopId: the stop ID for this arrival (also can add any other desired stop metadata like title)
 *     - x: distance along route (currently x-axis value, could be flipped)
 *     - y: arrival times in hours since midnight (currently the y-axis value, could be flipped)
 *
 * Note: In our travel time chart, x axis is distance along route, y axis is time taken, so this is
 * consistent.
 *
 * TODO: Respects stop picker? (but then how do you see it?)
 *
 * @param {Object} props
 */
function MareyChart(props) {
  const INBOUND_AND_OUTBOUND = 'Inbound_and_outbound';
  const INBOUND = 'Inbound'; // same as directionInfo name
  const OUTBOUND = 'Outbound'; // same as directionInfo name

  const { graphParams, thisFetchArrivals, arrivals, routes } = props;

  // On first load, get the raw arrival history corresponding to graphParams.

  useEffect(() => {
    if (graphParams.routeId) {
      fetchArrivals(graphParams);
    }
  }, [graphParams, thisFetchArrivals]);

  // When both the raw arrival history and route configs have loaded, first
  // rebucket the data by trip ID.  Then create react-vis Series objects for
  // each bucket, and store the Series in the state to trigger the final render.

  useEffect(() => {
    /**
     * Helper method to take a single arrival and add it to the right per-trip bucket
     * (creating it if needed).
     *
     * We also convert the stop ID to a distance along the route, and convert the
     * arrival timestamp to hours since 3am.
     *
     * @param {Object} tripData
     * @param {Object} arrival
     * @param {String} stopId
     * @param {Object} directionInfo
     * @param {Number} startTime
     * @param {Number} startHourOfDay Offset to add for arrival in fractional hours (time of day)
     */
    const addArrival = (
      tripData,
      arrival,
      stopId,
      route,
      directionInfo,
      startTime,
      startHourOfDay,
    ) => {
      const tripId = arrival.i;
      const vehicleId = arrival.v;
      if (tripData.byTripId[tripId] === undefined) {
        tripData.byTripId[tripId] = {
          tripId,
          vehicleId,
          series: [],
          directionInfo,
        };
      }

      if (directionInfo && directionInfo.stop_geometry[stopId]) {
        let distance = directionInfo.stop_geometry[stopId].distance;

        // This is a little clunky -- for all outbound routes, we restate the distance
        // as distance in the inbound direction by subtracting the stop's distance from
        // the length of the outbound direction.  This does not line up exactly with the
        // inbound direction length.

        if (directionInfo.name === 'Outbound') {
          distance = directionInfo.distance - distance;
        }
        distance = metersToMiles(distance);

        const arrivalMoment = Moment.unix(arrival.t).tz(TIME_ZONE_NAME);
        const yValue = (arrival.t - startTime) / 60 / 60 + startHourOfDay; // time of arrival in fractional hours

        tripData.byTripId[tripId].series.push({
          stopId,
          title: route.stops[stopId].title,
          arrivalTimeString: arrivalMoment.format('h:mm a'),
          vehicleId,
          x: distance,
          y: yValue,
        });

        if (
          tripData.earliestArrivalTime === null ||
          yValue < tripData.earliestArrivalTime
        ) {
          tripData.earliestArrivalTime = yValue;
        }

        if (
          tripData.latestArrivalTime === null ||
          yValue > tripData.latestArrivalTime
        ) {
          tripData.latestArrivalTime = yValue;
        }

        // If the exit time arrival.e is more than a certain amount of time, add a data point
        // so we can see the vehicle's exit in the data series.

        if (arrival.e - arrival.t > DWELL_THRESHOLD_SECS) {
          const exitMoment = Moment.unix(arrival.e).tz(TIME_ZONE_NAME);
          const exitYValue = (arrival.e - startTime) / 60 / 60 + startHourOfDay; // time of arrival in fractional hours

          tripData.byTripId[tripId].series.push({
            stopId,
            title: route.stops[stopId].title,
            arrivalTimeString: exitMoment.format('h:mm a'),
            vehicleId,
            x: distance,
            y: exitYValue,
          });
        }
      }
    };

    /**
     * This method is called when we get arrival data via Redux.  The method traverses the arrival
     * history (by stop, then by direction, then the contained array).
     *
     * Each arrival is bucketed by trip ID.
     *
     * @param {any} myArrivals
     * @param {any} myRoutes
     */
    const processArrivals = (myArrivals, myRoutes) => {
      const tripData = {
        byTripId: {}, // The dictionary by trip ID where arrivals are bucketed.
        earliestArrivalTime: null, // time in fractional hours
        latestArrivalTime: null, // time in fractional hours
      };

      const stops = myArrivals.stops;
      const startTime = myArrivals.start_time;
      const startHourOfDay = Moment.unix(startTime)
        .tz(TIME_ZONE_NAME)
        .hour();

      const routeId = myArrivals.route_id;
      const route = myRoutes.find(myRoute => myRoute.id === routeId);

      Object.keys(stops).forEach(stopId => {
        // console.log("Starting " + stopId);
        const stopsByDirection = stops[stopId].arrivals;
        Object.keys(stopsByDirection).forEach(directionId => {
          const directionInfo = route.directions.find(
            direction => direction.id === directionId,
          );

          const dataArray = stopsByDirection[directionId];
          dataArray.forEach(arrival => {
            addArrival(
              tripData,
              arrival,
              stopId,
              route,
              directionInfo,
              startTime,
              startHourOfDay,
            );
          });
        });
      });

      return tripData;
    };

    if (arrivals && routes) {
      // console.log("Processing arrival data.");
      const tripData = processArrivals(arrivals, routes);
      setProcessedArrivals(tripData);
    }
  }, [arrivals, routes]);

  const [hintValue, setHintValue] = useState();
  const [tripHighlight, setTripHighlight] = useState();
  const [processedArrivals, setProcessedArrivals] = useState(); // where the tripData gets stored
  const [selectedOption, setSelectedOption] = useState(INBOUND_AND_OUTBOUND);

  /**
   * This is a render-time helper function.
   *
   * Generates per trip react-vis Series objects from the reorganized tripData.
   * We sort each bucket by "y" value (then by distance) to get plots pointed in the correct order.
   *
   * Series are colored by vehicle ID modulo 9 (the last digit of the vehicle ID tends to
   * repeat, so using 9 instead of 10).
   *
   * @param {object} tripData
   * @return {Array} Series objects for plotting
   */
  const createSeries = tripData => {
    const routeColor = d3.scaleQuantize([0, 9], d3.schemeCategory10);

    const tripSeriesArray = [];
    Object.keys(tripData.byTripId).forEach(tripDataKey => {
      const trip = tripData.byTripId[tripDataKey];

      if (
        selectedOption === INBOUND_AND_OUTBOUND ||
        (trip.directionInfo && trip.directionInfo.name === selectedOption)
      ) {
        const dataSeries = trip.series.sort((a, b) => {
          const deltaY = b.y - a.y;
          return deltaY !== 0 ? deltaY : b.x - a.x;
        });

        tripSeriesArray.push(
          <LineMarkSeries
            key={tripDataKey}
            data={dataSeries}
            stroke={routeColor(trip.vehicleId % 9)}
            style={{
              strokeWidth: tripHighlight === tripDataKey ? '3px' : '1px', // draw a thicker line for the series being moused over
            }}
            size="1"
            onValueMouseOver={
              value =>
                setHintValue(
                  value,
                ) /* onNearestXY seems buggy, so next best is onValue */
            }
            onSeriesMouseOver={() => {
              setTripHighlight(tripDataKey);
            }}
          />,
        );
      }
    });
    return tripSeriesArray;
  };

  let series = null;
  let startHour = 0; // arbitrary value when no data and no time range
  let endHour = 12; // arbitrary value when no data and no time range

  // if we have data, generate the series and initial domain of hours
  if (processedArrivals) {
    series = createSeries(processedArrivals);
    startHour = Math.floor(processedArrivals.earliestArrivalTime);
    endHour = Math.ceil(processedArrivals.latestArrivalTime);
  }

  // if there's a time range, that takes priority over the automatic domain
  if (graphParams.startTime) {
    startHour = parseInt(graphParams.startTime, 10);
  }

  if (graphParams.endTime) {
    endHour = parseInt(graphParams.endTime, 10);
    if (graphParams.endTime.endsWith('+1')) {
      endHour += 24;
    }
  }

  /**
   * Formats fractional hours into time of day.
   *
   * @param {any} v Time of day as fractional hours
   */
  const hourFormatter = v => {
    let suffix = '';
    let hour = v;
    if (hour >= 24) {
      hour -= 24;
      suffix = '+1';
    }

    let amPm = 'am';

    if (hour >= 12) {
      amPm = 'pm';
    }

    if (hour >= 13) {
      hour -= 12;
    }

    if (hour === 0) {
      hour = 12;
    }
    const time = `${parseInt(hour, 10)}:${((hour - parseInt(hour, 10)) * 60)
      .toString()
      .padStart(2, '0')}`;
    return `${time} ${amPm}${suffix}`;
  };

  return processedArrivals ? (
    <Grid item xs={12}>
      <Card>
        <CardContent>
          <Typography variant="h5">Marey chart</Typography>
          Vehicle runs: {series.length} <br />
          <FormControl>
            <div className="controls">
              <FormControlLabel
                control={
                  <Radio
                    id="inbound_and_outbound"
                    type="radio"
                    value={INBOUND_AND_OUTBOUND}
                    checked={selectedOption === INBOUND_AND_OUTBOUND}
                    onChange={changeEvent =>
                      setSelectedOption(changeEvent.target.value)
                    }
                  />
                }
                label="Inbound and Outbound"
              />

              <FormControlLabel
                control={
                  <Radio
                    id="inbound"
                    type="radio"
                    value={INBOUND}
                    checked={selectedOption === INBOUND}
                    onChange={changeEvent =>
                      setSelectedOption(changeEvent.target.value)
                    }
                  />
                }
                label="Inbound only"
              />

              <FormControlLabel
                control={
                  <Radio
                    id="outbound"
                    type="radio"
                    value={OUTBOUND}
                    checked={selectedOption === OUTBOUND}
                    onChange={changeEvent =>
                      setSelectedOption(changeEvent.target.value)
                    }
                  />
                }
                label="Outbound only"
              />
            </div>
          </FormControl>
          <XYPlot
            height={(endHour - startHour) * 100}
            width={600}
            yDomain={
              [
                endHour,
                startHour,
              ] /* 3am the next day at the bottom, 3am for this day at the top */
            }
            margin={{ left: 80 }}
          >
            {series}
            <Borders
              style={{
                bottom: { fill: '#fff' },
                left: { fill: '#fff' },
                right: { fill: '#fff' },
                top: { fill: '#fff' },
              }}
            />

            <HorizontalGridLines />
            <VerticalGridLines />
            <XAxis tickPadding={4} />
            <YAxis hideLine tickPadding={4} tickFormat={hourFormatter} />

            <ChartLabel
              text="Time"
              className="alt-y-label"
              includeMargin
              xPercent={0.02}
              yPercent={0.3}
              style={{
                transform: 'rotate(-90)',
              }}
            />

            <ChartLabel
              text="Inbound Distance Along Route (miles)"
              className="alt-x-label"
              includeMargin
              xPercent={0.7}
              yPercent={1.0 - 85.0 / ((endHour - startHour) * 100.0)}
              style={{
                textAnchor: 'end',
              }}
            />
            {hintValue ? (
              <Hint
                value={hintValue}
                format={hintValue => [
                  { title: 'Stop', value: hintValue.title },
                  { title: 'Time', value: hintValue.arrivalTimeString },
                  { title: 'Vehicle ID', value: hintValue.vehicleId },
                ]}
              />
            ) : null}
          </XYPlot>
        </CardContent>
      </Card>
    </Grid>
  ) : null;
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
  graphParams: state.routes.graphParams,
  arrivals: state.routes.arrivals,
});

const mapDispatchToProps = dispatch => {
  return {
    fetchArrivals: params => dispatch(fetchArrivals(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(MareyChart);
