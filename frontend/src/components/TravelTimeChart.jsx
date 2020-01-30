import React, { Fragment, useState } from 'react';

import {
  XYPlot,
  HorizontalGridLines,
  VerticalGridLines,
  XAxis,
  YAxis,
  LineMarkSeries,
  ChartLabel,
  Crosshair,
} from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import '../../node_modules/react-vis/dist/style.css';

import { connect } from 'react-redux';

import Typography from '@material-ui/core/Typography';
import { metersToMiles } from '../helpers/routeCalculations';

/**
 * Returns an array of {x: stop index, y: time} objects for
 * plotting on a chart.
 */
export function getTripDataSeries(routeMetrics, route, directionId) {
  const dirMetrics = routeMetrics
    ? routeMetrics.interval.directions.find(
        dirMetrics => dirMetrics.directionId === directionId,
      )
    : null;

  let firstStopId = null;
  const segmentsMap = {};
  if (dirMetrics) {
    dirMetrics.cumulativeSegments.forEach(function(segment) {
      segmentsMap[segment.toStopId] = segment;
      firstStopId = segment.fromStopId;
    });
  }

  const dataSeries = [];

  const directionInfo = route
    ? route.directions.find(direction => direction.id === directionId)
    : null;
  if (directionInfo) {
    const firstStopGeometry = directionInfo.stop_geometry[firstStopId];
    const firstStopDistance = firstStopGeometry
      ? firstStopGeometry.distance
      : 0;

    directionInfo.stops.forEach((stop, index) => {
      const stopGeometry = directionInfo.stop_geometry[stop];
      const title = route.stops[stop].title;
      const segment = segmentsMap[stop];
      if (stop === firstStopId) {
        dataSeries.push({
          x: 0,
          y: 0,
          title,
          stopIndex: index,
        });
      } else if (segment && segment.medianTripTime != null && stopGeometry) {
        // Drop trip data points with no data.
        dataSeries.push({
          x: metersToMiles(stopGeometry.distance - firstStopDistance),
          y: segment.medianTripTime,
          title,
          stopIndex: index,
          numTrips: segment.numTrips,
        });
      }
    });
  }

  return dataSeries;
}

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
function TravelTimeChart(props) {
  const [crosshairValues, setCrosshairValues] = useState([]);
  const { graphParams, routeMetrics, routes } = props;

  /**
   * Event handler for onMouseLeave.
   * @private
   */
  const onMouseLeave = () => {
    setCrosshairValues([]);
  };

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  const onNearestTripX = value => {
    // , { index })
    setCrosshairValues([value /* future:  how to add scheduleData[index] ? */]);
  };

  let tripData = [];
  let tripTimeForDirection = null;
  let distanceForDirection = null;
  let numStops = null;
  let numTrips = null;

  const { routeId, directionId } = graphParams;

  if (routes && routeId) {
    const route = routes.find(thisRoute => thisRoute.id === routeId);

    tripData = getTripDataSeries(routeMetrics, route, directionId);

    numStops = tripData.length;
    tripTimeForDirection = numStops > 0 ? tripData[numStops - 1].y : null;
    distanceForDirection = numStops > 0 ? tripData[numStops - 1].x : null;
    numTrips = numStops > 0 ? tripData[numStops - 1].numTrips : null;
  }

  const legendItems = [
    // { title: 'Scheduled', color: "#a4a6a9", strokeWidth: 10 },
    { title: 'Actual', color: '#aa82c5', strokeWidth: 10 },
  ];

  return directionId ? (
    <Fragment>
      <Typography variant="h5">Travel time along route</Typography>
      Median travel time:{' '}
      {tripTimeForDirection > 0 ? tripTimeForDirection.toFixed(1) : '?'} min
      &nbsp;&nbsp; Average speed:{' '}
      {tripTimeForDirection > 0
        ? ((60 * distanceForDirection) / tripTimeForDirection).toFixed(1)
        : '?'}{' '}
      mph
      <br />
      Distance:{' '}
      {distanceForDirection != null ? distanceForDirection.toFixed(1) : '?'} mi
      &nbsp;&nbsp; Stops: {numStops > 0 ? numStops : '?'} &nbsp;&nbsp; Completed
      trips: {numTrips != null ? numTrips : '0'}
      <br />
      {/* set the y domain to start at zero and end at highest value (which is not always
         the end to end travel time due to spikes in the data) */}
      <XYPlot
        height={300}
        width={400}
        xDomain={[
          0,
          tripData.reduce((max, coord) => (coord.x > max ? coord.x : max), 0),
        ]}
        yDomain={[
          0,
          tripData.reduce((max, coord) => (coord.y > max ? coord.y : max), 0),
        ]}
        onMouseLeave={onMouseLeave}
      >
        <HorizontalGridLines />
        <VerticalGridLines />
        <XAxis tickPadding={4} />
        <YAxis hideLine tickPadding={4} />

        <LineMarkSeries
          data={tripData}
          stroke="#aa82c5"
          color="aa82c5"
          style={{
            strokeWidth: '3px',
          }}
          size="1"
          onNearestX={onNearestTripX}
        />
        {/* <LineSeries data={ scheduleData }
              stroke="#a4a6a9"
              strokeWidth="4"
              style={{
                strokeDasharray: '2 2'
              }}
            /> */}

        <ChartLabel
          text="Minutes"
          className="alt-y-label"
          includeMargin
          xPercent={0.02}
          yPercent={0.2}
          style={{
            transform: 'rotate(-90)',
            textAnchor: 'end',
          }}
        />

        <ChartLabel
          text="Distance Along Route (miles)"
          className="alt-x-label"
          includeMargin
          xPercent={0.7}
          yPercent={0.86}
          style={{
            textAnchor: 'end',
          }}
        />

        {crosshairValues.length > 0 && (
          <Crosshair
            values={crosshairValues}
            style={{ line: { background: 'none' } }}
          >
            <div className="rv-crosshair__inner__content">
              <p>{Math.round(crosshairValues[0].y)} min</p>
              {/* <p>Scheduled: { Math.round(crosshairValues[1].y)} min</p> */}
              <p>{crosshairValues[0].title}</p>
              <p>(Stop #{crosshairValues[0].stopIndex + 1})</p>
            </div>
          </Crosshair>
        )}
      </XYPlot>
      <DiscreteColorLegend
        orientation="horizontal"
        width={300}
        items={legendItems}
      />
    </Fragment>
  ) : (
    <Fragment>Select a direction to see the travel time chart.</Fragment>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  routeMetrics: state.routeMetrics.data,
  graphParams: state.graphParams,
});

export default connect(mapStateToProps)(TravelTimeChart);
