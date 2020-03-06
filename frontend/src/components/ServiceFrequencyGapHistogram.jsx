import React from 'react';
import { connect } from 'react-redux';
import { Typography } from '@material-ui/core';
import { CHART_COLORS } from '../UIConstants';
import { renderDateRange } from '../helpers/dateTime';
import { getHistogramChartData } from '../helpers/graphData';
import SimpleVerticalRectChart from './SimpleVerticalRectChart';

function getGapHistogramChartData(headwayScheduleDeltas) {
  return getHistogramChartData(
    headwayScheduleDeltas.histogram,
    headwayScheduleDeltas.count,
  );
}

function ServiceFrequencyGapHistogram(props) {
  const { tripMetrics, graphParams } = props;

  const compareDateRanges = !!graphParams.secondDateRange;

  const intervalData = tripMetrics ? tripMetrics.interval : null;
  const intervalData2 = tripMetrics ? tripMetrics.interval2 : null;

  const headwayScheduleDeltas = intervalData
    ? intervalData.headwayScheduleDeltas
    : null;
  const headwayScheduleDeltas2 = intervalData2
    ? intervalData2.headwayScheduleDeltas
    : null;

  if (!headwayScheduleDeltas) {
    return null;
  }

  return (
    <div className="chart-section">
      <Typography variant="h5">Distribution of Bunches/Gaps</Typography>
      <SimpleVerticalRectChart
        width={500}
        height={250}
        yFormat={v => `${Math.round(v)}%`}
        xUnits="extra minutes"
        series={
          compareDateRanges
            ? [
                {
                  title: `${renderDateRange(
                    graphParams.firstDateRange,
                  )} (Observed)`,
                  color: CHART_COLORS[1],
                  data: getGapHistogramChartData(headwayScheduleDeltas),
                  stroke: 'white',
                  style: { strokeWidth: 2 },
                },
                {
                  title: `${renderDateRange(
                    graphParams.secondDateRange,
                  )} (Observed)`,
                  color: CHART_COLORS[0],
                  data: getGapHistogramChartData(headwayScheduleDeltas2),
                  stroke: '#333',
                  opacity: 0.25,
                  style: { strokeWidth: 2 },
                },
              ]
            : [
                {
                  color: CHART_COLORS[1],
                  data: getGapHistogramChartData(headwayScheduleDeltas),
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

export default connect(mapStateToProps)(ServiceFrequencyGapHistogram);
