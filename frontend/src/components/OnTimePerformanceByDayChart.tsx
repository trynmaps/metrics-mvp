import React from 'react';
import { connect } from 'react-redux';
import Moment from 'moment';
import { getOnTimePercent } from 'helpers';
import SimpleLineMarkChart from './SimpleLineMarkChart';
import { CHART_COLORS } from '../UIConstants';

function getOnTimePercentByDayChartData(byDayData, property) {
  return byDayData
    ? byDayData.map((dayData, i) => {
        return {
          x: i,
          y: getOnTimePercent(dayData[property]),
        };
      })
    : null;
}

function OnTimePerformanceByDayChart(props) {
  const { tripMetrics, graphParams } = props;

  const compareDateRanges = !!graphParams.secondDateRange;

  const byDayData = tripMetrics ? tripMetrics.byDay : null;

  if (
    compareDateRanges ||
    graphParams.firstDateRange.date === graphParams.firstDateRange.startDate ||
    !byDayData
  ) {
    return null;
  }

  return (
    <div className="chart-section">
      <SimpleLineMarkChart
        title="On-Time Performance By Day"
        width={500}
        height={250}
        yDomain={[0, 100]}
        xFormat={i =>
          i === Math.round(i)
            ? Moment(byDayData[i].dates[0]).format('ddd M/D')
            : ''
        }
        xAxisMaxTicks={5}
        yFormat={v => `${Math.round(v)}%`}
        series={[
          {
            title: 'On-Time Departure Rate',
            color: CHART_COLORS[1],
            data: getOnTimePercentByDayChartData(
              byDayData,
              'departureScheduleAdherence',
            ),
            size: 4,
          },
          {
            title: 'On-Time Arrival Rate',
            color: CHART_COLORS[3],
            data: getOnTimePercentByDayChartData(
              byDayData,
              'arrivalScheduleAdherence',
            ),
            size: 4,
          },
        ]}
      />
    </div>
  );
}

const mapStateToProps = state => ({
  tripMetrics: state.tripMetrics.data,
  graphParams: state.graphParams,
});

export default connect(mapStateToProps)(OnTimePerformanceByDayChart);
