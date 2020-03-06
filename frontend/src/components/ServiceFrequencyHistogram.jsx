import React from 'react';
import { connect } from 'react-redux';
import { CHART_COLORS } from '../UIConstants';
import { renderDateRange } from '../helpers/dateTime';
import { getHistogramChartData } from '../helpers/graphData';
import SimpleVerticalRectChart from './SimpleVerticalRectChart';

function getHeadwaysHistogramChartData(headways) {
  return getHistogramChartData(headways.histogram, headways.count);
}

function ServiceFrequencyHistogram(props) {
  const { tripMetrics, graphParams } = props;

  const compareDateRanges = !!graphParams.secondDateRange;

  const intervalData = tripMetrics ? tripMetrics.interval : null;
  const intervalData2 = tripMetrics ? tripMetrics.interval2 : null;

  const headways = intervalData ? intervalData.headways : null;
  const scheduledHeadways = intervalData
    ? intervalData.scheduledHeadways
    : null;
  const headways2 = intervalData2 ? intervalData2.headways : null;

  if (!headways) {
    return null;
  }

  return (
    <div className="chart-section">
      <SimpleVerticalRectChart
        title="Distribution of Headways (Time Between Vehicles)"
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
                  data: getHeadwaysHistogramChartData(headways),
                  stroke: 'white',
                  style: { strokeWidth: 2 },
                },
                {
                  title: `${renderDateRange(
                    graphParams.secondDateRange,
                  )} (Observed)`,
                  color: CHART_COLORS[0],
                  data: getHeadwaysHistogramChartData(headways2),
                  stroke: '#333',
                  opacity: 0.25,
                  style: { strokeWidth: 2 },
                },
              ]
            : [
                {
                  title: 'Observed',
                  color: CHART_COLORS[1],
                  data: getHeadwaysHistogramChartData(headways),
                  stroke: 'white',
                  style: { strokeWidth: 2 },
                },
                {
                  title: 'Scheduled',
                  color: CHART_COLORS[0],
                  data: getHeadwaysHistogramChartData(scheduledHeadways),
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

export default connect(mapStateToProps)(ServiceFrequencyHistogram);
