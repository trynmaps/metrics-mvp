import React from 'react';
import { connect } from 'react-redux';
import { renderDateRange, getTimeRangeShortLabel } from 'helpers';
import SimpleVerticalBarChart from './SimpleVerticalBarChart';
import { CHART_COLORS } from '../UIConstants';

function getMedianServiceFrequencyByTimeRangeChartData(
  timeRangesData,
  property,
) {
  return timeRangesData
    ? timeRangesData.map(timeRangeData => {
        return {
          x: `${timeRangeData.startTime}-${timeRangeData.endTime}`,
          y: timeRangeData[property].median,
        };
      })
    : null;
}

function ServiceFrequencyByTimeChart(props) {
  const { tripMetrics, graphParams } = props;

  if (graphParams.firstDateRange.startTime) {
    return null;
  }

  const compareDateRanges = !!graphParams.secondDateRange;

  const timeRangesData = tripMetrics ? tripMetrics.timeRanges : null;
  const timeRangesData2 = tripMetrics ? tripMetrics.timeRanges2 : null;

  return (
    <div className="chart-section">
      <SimpleVerticalBarChart
        title="Median Service Frequency by Time of Day"
        width={500}
        height={250}
        xType="ordinal"
        xFormat={getTimeRangeShortLabel}
        yFormat={v => `${Math.round(v)}`}
        yUnits="minutes"
        series={
          compareDateRanges
            ? [
                {
                  title: `${renderDateRange(
                    graphParams.firstDateRange,
                  )} (Observed)`,
                  color: CHART_COLORS[1],
                  data: getMedianServiceFrequencyByTimeRangeChartData(
                    timeRangesData,
                    'headways',
                  ),
                },
                {
                  title: `${renderDateRange(
                    graphParams.secondDateRange,
                  )} (Observed)`,
                  color: CHART_COLORS[3],
                  data: getMedianServiceFrequencyByTimeRangeChartData(
                    timeRangesData2,
                    'headways',
                  ),
                },
              ]
            : [
                {
                  title: 'Observed',
                  color: CHART_COLORS[1],
                  data: getMedianServiceFrequencyByTimeRangeChartData(
                    timeRangesData,
                    'headways',
                  ),
                },
                {
                  title: 'Scheduled',
                  color: CHART_COLORS[0],
                  data: getMedianServiceFrequencyByTimeRangeChartData(
                    timeRangesData,
                    'scheduledHeadways',
                  ),
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

export default connect(mapStateToProps)(ServiceFrequencyByTimeChart);
