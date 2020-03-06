import React from 'react';
import { connect } from 'react-redux';
import { Typography } from '@material-ui/core';
import { getOnTimePercent } from '../helpers/graphData';
import { renderDateRange, getTimeRangeShortLabel } from '../helpers/dateTime';
import SimpleVerticalBarChart from './SimpleVerticalBarChart';
import { CHART_COLORS } from '../UIConstants';

function getOnTimePercentByTimeRangeChartData(timeRangesData, property) {
  return timeRangesData
    ? timeRangesData.map(timeRangeData => {
        return {
          x: `${timeRangeData.startTime}-${timeRangeData.endTime}`,
          y: getOnTimePercent(timeRangeData[property]),
        };
      })
    : [];
}

function OnTimePerformanceByTimeChart(props) {
  const { tripMetrics, graphParams } = props;

  if (graphParams.firstDateRange.startTime) {
    return null;
  }

  const timeRangesData = tripMetrics ? tripMetrics.timeRanges : null;
  const timeRangesData2 = tripMetrics ? tripMetrics.timeRanges2 : null;

  const compareDateRanges = !!graphParams.secondDateRange;

  return (
    <div className="chart-section">
      <Typography variant="h5">On-Time Performance by Time of Day</Typography>
      <SimpleVerticalBarChart
        width={500}
        height={250}
        yDomain={[0, 100]}
        xType="ordinal"
        xFormat={getTimeRangeShortLabel}
        yFormat={v => `${Math.round(v)}%`}
        series={
          compareDateRanges
            ? [
                {
                  title: `${renderDateRange(
                    graphParams.firstDateRange,
                  )} (Observed On-Time Departure Rate)`,
                  color: CHART_COLORS[1],
                  data: getOnTimePercentByTimeRangeChartData(
                    timeRangesData,
                    'departureScheduleAdherence',
                  ),
                },
                {
                  title: `${renderDateRange(
                    graphParams.secondDateRange,
                  )} (Observed On-Time Departure Rate)`,
                  color: CHART_COLORS[3],
                  data: getOnTimePercentByTimeRangeChartData(
                    timeRangesData2,
                    'departureScheduleAdherence',
                  ),
                },
              ]
            : [
                {
                  title: 'On-Time Departure Rate',
                  color: CHART_COLORS[1],
                  data: getOnTimePercentByTimeRangeChartData(
                    timeRangesData,
                    'departureScheduleAdherence',
                  ),
                },
                {
                  title: 'On-Time Arrival Rate',
                  color: CHART_COLORS[3],
                  data: getOnTimePercentByTimeRangeChartData(
                    timeRangesData,
                    'arrivalScheduleAdherence',
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

export default connect(mapStateToProps)(OnTimePerformanceByTimeChart);
