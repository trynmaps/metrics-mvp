import React from 'react';
import { connect } from 'react-redux';
import { Typography } from '@material-ui/core';
import { getHistogramChartData } from '../helpers/graphData';
import { renderDateRange } from '../helpers/dateTime';
import SimpleVerticalRectChart from './SimpleVerticalRectChart';
import { CHART_COLORS } from '../UIConstants';

function getScheduleAdherenceHistogramChartData(scheduleAdherence) {
  return getHistogramChartData(
    scheduleAdherence.closestDeltas.histogram,
    scheduleAdherence.closestDeltas.count,
  );
}

function OnTimePerformanceHistogram(props) {
  const { tripMetrics, graphParams } = props;

  const intervalData = tripMetrics ? tripMetrics.interval : null;
  const intervalData2 = tripMetrics ? tripMetrics.interval2 : null;

  const departureScheduleAdherence = intervalData
    ? intervalData.departureScheduleAdherence
    : null;
  const departureScheduleAdherence2 = intervalData2
    ? intervalData2.departureScheduleAdherence
    : null;

  const compareDateRanges = !!graphParams.secondDateRange;

  if (!departureScheduleAdherence) {
    return null;
  }

  return (
    <div className="chart-section">
      <Typography variant="h5">
        Distribution of Early/Late Departures
      </Typography>
      <SimpleVerticalRectChart
        width={500}
        height={250}
        xAxisMaxTicks={20}
        yFormat={v => `${Math.round(v)}%`}
        xUnits="minutes late"
        series={
          compareDateRanges && departureScheduleAdherence2
            ? [
                {
                  title: `${renderDateRange(
                    graphParams.firstDateRange,
                  )} (Observed)`,
                  color: CHART_COLORS[1],
                  data: getScheduleAdherenceHistogramChartData(
                    departureScheduleAdherence,
                  ),
                  stroke: 'white',
                  style: { strokeWidth: 2 },
                },
                {
                  title: `${renderDateRange(
                    graphParams.secondDateRange,
                  )} (Observed)`,
                  color: CHART_COLORS[0],
                  data: getScheduleAdherenceHistogramChartData(
                    departureScheduleAdherence2,
                  ),
                  stroke: '#333',
                  opacity: 0.25,
                  style: { strokeWidth: 2 },
                },
              ]
            : [
                {
                  color: CHART_COLORS[1],
                  data: getScheduleAdherenceHistogramChartData(
                    departureScheduleAdherence,
                  ),
                  stroke: 'white',
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

export default connect(mapStateToProps)(OnTimePerformanceHistogram);
