import React, { Fragment, useState } from 'react';

import {
  XYPlot,
  HorizontalGridLines,
  VerticalGridLines,
  XAxis,
  YAxis,
  LineMarkSeries,
  LineSeries,
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
export function getTripDataSeries(
  dirMetrics,
  directionInfo,
  route,
  cumulativeSegmentTimeProperty,
  cumulativeSegmentTripsProperty,
) {
  let firstStopId = null;
  const segmentsMap = {};
  dirMetrics.cumulativeSegments.forEach(function(segment) {
    segmentsMap[segment.toStopId] = segment;
    firstStopId = segment.fromStopId;
  });
  const dataSeries = [];

  const firstStopGeometry = directionInfo.stop_geometry[firstStopId];
  const firstStopDistance = firstStopGeometry ? firstStopGeometry.distance : 0;

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
    } else if (
      segment &&
      segment[cumulativeSegmentTimeProperty] != null &&
      stopGeometry
    ) {
      // Drop trip data points with no data.
      dataSeries.push({
        x: metersToMiles(stopGeometry.distance - firstStopDistance),
        y: segment[cumulativeSegmentTimeProperty],
        title,
        stopIndex: index,
        numTrips: segment[cumulativeSegmentTripsProperty],
      });
    }
  });

  if (directionInfo.loop && firstStopId) {
    const segment = segmentsMap[firstStopId];
    if (segment && segment.medianTripTime != null) {
      dataSeries.push({
        x: metersToMiles(directionInfo.distance),
        y: segment.medianTripTime,
        title: route.stops[firstStopId].title,
        stopIndex: directionInfo.stops.length,
        numTrips: segment.trips,
      });
    }
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

  let observedData = [];
  let scheduledData = [];

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  const onNearestTripX = (value, info) => {
    setCrosshairValues([value, scheduledData[info.index]]);
  };

  let tripTimeForDirection = null;
  let distanceForDirection = null;
  let numStops = null;

  const { routeId, directionId } = graphParams;

  if (routes && routeId) {
    const route = routes.find(thisRoute => thisRoute.id === routeId);

    const dirMetrics = routeMetrics
      ? routeMetrics.interval.directions.find(
          dm => dm.directionId === directionId,
        )
      : null;

    const directionInfo = route
      ? route.directions.find(direction => direction.id === directionId)
      : null;

    if (dirMetrics && directionInfo) {
      observedData = getTripDataSeries(
        dirMetrics,
        directionInfo,
        route,
        'medianTripTime',
        'trips',
      );
      scheduledData = getTripDataSeries(
        dirMetrics,
        directionInfo,
        route,
        'scheduledMedianTripTime',
        'scheduledTrips',
      );
    }

    numStops = observedData.length;
    tripTimeForDirection = numStops > 0 ? observedData[numStops - 1].y : null;
    distanceForDirection = numStops > 0 ? observedData[numStops - 1].x : null;
  }

  const observedColor = '#aa82c5';
  const scheduledColor = '#b4b6b9';

  const legendItems = [
    { title: 'Observed', color: observedColor, strokeWidth: 10 },
    { title: 'Scheduled', color: scheduledColor, strokeWidth: 10 },
  ];

  return directionId ? (
    <Fragment>
      <Typography variant="h5">Median travel time along route</Typography>
      Median travel time:{' '}
      {tripTimeForDirection > 0 ? tripTimeForDirection.toFixed(0) : '?'} min
      &nbsp;&nbsp; Average speed:{' '}
      {tripTimeForDirection > 0
        ? ((60 * distanceForDirection) / tripTimeForDirection).toFixed(0)
        : '?'}{' '}
      mph
      <br />
      {/* set the y domain to start at zero and end at highest value (which is not always
         the end to end travel time due to spikes in the data) */}
      <XYPlot
        height={350}
        width={500}
        margin={{ left: 50, right: 10, top: 10, bottom: 45 }}
        xDomain={[
          0,
          observedData.reduce(
            (max, coord) => (coord.x > max ? coord.x : max),
            0,
          ),
        ]}
        yDomain={[
          0,
          observedData.reduce(
            (max, coord) => (coord.y > max ? coord.y : max),
            numStops > 0 ? scheduledData[numStops - 1].y : 0,
          ),
        ]}
        onMouseLeave={onMouseLeave}
      >
        <HorizontalGridLines />
        <VerticalGridLines />
        <XAxis tickPadding={4} />
        <YAxis hideLine tickPadding={4} />

        <LineSeries
          data={scheduledData}
          stroke={scheduledColor}
          strokeWidth="2"
          style={{
            strokeDasharray: '2 2',
          }}
        />
        <LineMarkSeries
          data={observedData}
          stroke={observedColor}
          color={observedColor.substring(1)}
          style={{
            strokeWidth: '3px',
          }}
          size="1"
          onNearestX={onNearestTripX}
        />
        <ChartLabel
          text="Minutes"
          includeMargin
          className="alt-y-label"
          xPercent={0.03}
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
          xPercent={0.55}
          yPercent={0.84}
          style={{
            textAnchor: 'middle',
          }}
        />

        {crosshairValues.length > 0 && (
          <Crosshair
            values={crosshairValues}
            style={{ line: { background: 'none' } }}
          >
            <div
              className="rv-crosshair__inner__content"
              style={{ whiteSpace: 'nowrap' }}
            >
              <div>
                {crosshairValues[0].title} (Stop #
                {crosshairValues[0].stopIndex + 1})
              </div>
              {crosshairValues[0].numTrips > 0 ? (
                <>
                  <div>
                    {Math.round(crosshairValues[0].y)} min (observed);{' '}
                    {crosshairValues[0].numTrips} trips
                  </div>
                  {crosshairValues[1] ? (
                    <div>
                      {Math.round(crosshairValues[1].y)} min (scheduled);{' '}
                      {crosshairValues[1].numTrips} trips
                    </div>
                  ) : null}
                </>
              ) : null}
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
