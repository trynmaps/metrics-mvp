import React from 'react';
import { connect } from 'react-redux';
import { CHART_COLORS } from '../UIConstants';
import { renderDateRange } from '../helpers/dateTime';
import { getHistogramChartData } from '../helpers/graphData';
import SimpleVerticalRectChart from './SimpleVerticalRectChart';

function getTravelTimesHistogramChartData(tripTimes) {
  return getHistogramChartData(tripTimes.histogram, tripTimes.count);
}

function TravelTimesHistogram(props) {
  const { tripMetrics, graphParams } = props;

  const compareDateRanges = !!graphParams.secondDateRange;

  const intervalData = tripMetrics ? tripMetrics.interval : null;
  const intervalData2 = tripMetrics ? tripMetrics.interval2 : null;

  const tripTimes = intervalData ? intervalData.tripTimes : null;
  const scheduledTripTimes = intervalData
    ? intervalData.scheduledTripTimes
    : null;

  const tripTimes2 = intervalData2 ? intervalData2.tripTimes : null;

  if (!tripTimes) {
    return null;
  }

  return (
    <div className="chart-section">
      <SimpleVerticalRectChart
        title="Distribution of Travel Times"
        width={500}
        height={250}
        yFormat={v => `${Math.round(v)}%`}
        xUnits="minutes"
        series={
          compareDateRanges
            ? [
                {
                  title: `${renderDateRange(
                    graphParams.firstDateRange,
                  )} (Observed)`,
                  color: CHART_COLORS[1],
                  data: getTravelTimesHistogramChartData(tripTimes),
                  stroke: 'white',
                  style: { strokeWidth: 2 },
                },
                {
                  title: `${renderDateRange(
                    graphParams.secondDateRange,
                  )} (Observed)`,
                  color: CHART_COLORS[0],
                  data: getTravelTimesHistogramChartData(tripTimes2),
                  stroke: '#333',
                  opacity: 0.25,
                  style: { strokeWidth: 2 },
                },
              ]
            : [
                {
                  title: 'Observed',
                  color: CHART_COLORS[1],
                  data: getTravelTimesHistogramChartData(tripTimes),
                  stroke: 'white',
                  style: { strokeWidth: 2 },
                },
                {
                  title: 'Scheduled',
                  color: CHART_COLORS[0],
                  data: getTravelTimesHistogramChartData(scheduledTripTimes),
                  stroke: '#333',
                  cluster: 'second',
                  opacity: 0.25,
                  style: { strokeWidth: 2 },
                },
              ]
        }
      />
    </div>
  );
}

const mapStateToProps = state => ({
  tripMetrics: state.tripMetrics.data,
  graphParams: state.graphParams,
});

export default connect(mapStateToProps)(TravelTimesHistogram);
