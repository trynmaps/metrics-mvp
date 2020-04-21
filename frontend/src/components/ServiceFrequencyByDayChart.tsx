import React from 'react';
import { connect } from 'react-redux';
import Moment from 'moment';
import SimpleLineMarkChart from './SimpleLineMarkChart';
import { CHART_COLORS } from '../UIConstants';

function getMedianServiceFrequencyByDayChartData(byDayData, property) {
  return byDayData
    ? byDayData.map((dayData, i) => {
        return {
          x: i,
          y: dayData[property].median,
        };
      })
    : null;
}

function ServiceFrequencyByDayChart(props) {
  const { tripMetrics, graphParams } = props;

  const compareDateRanges = !!graphParams.secondDateRange;
  const byDayData = tripMetrics ? tripMetrics.byDay : null;

  if (
    compareDateRanges ||
    !byDayData ||
    graphParams.firstDateRange.date === graphParams.firstDateRange.startDate
  ) {
    return null;
  }
  return (
    <div className="chart-section">
      <SimpleLineMarkChart
        title="Median Service Frequency By Day"
        width={500}
        height={250}
        xFormat={i =>
          i === Math.round(i)
            ? Moment(byDayData[i].dates[0]).format('ddd M/D')
            : ''
        }
        xAxisMaxTicks={5}
        yFormat={v => `${Math.round(v)}`}
        yUnits="minutes"
        series={[
          {
            title: 'Observed',
            color: CHART_COLORS[1],
            data: getMedianServiceFrequencyByDayChartData(
              byDayData,
              'headways',
            ),
            size: 4,
          },
          {
            title: 'Scheduled',
            color: CHART_COLORS[0],
            data: getMedianServiceFrequencyByDayChartData(
              byDayData,
              'scheduledHeadways',
            ),
            size: 0,
            opacity: 0.5,
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

export default connect(mapStateToProps)(ServiceFrequencyByDayChart);
