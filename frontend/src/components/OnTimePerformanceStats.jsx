import React from 'react';
import { connect } from 'react-redux';
import {
  XYPlot,
  HorizontalGridLines,
  XAxis,
  YAxis,
  ChartLabel,
  LineMarkSeries,
} from 'react-vis';
import Moment from 'moment';
import { Typography } from '@material-ui/core';
import { CHART_COLORS } from '../UIConstants';

function OnTimePerformanceStats(props) {
  const { tripMetrics, graphParams } = props;

  const byDayData = tripMetrics ? tripMetrics.byDay : null;

  const onTimeRateData =
    byDayData &&
    byDayData.map(dayData => {
      const scheduleAdherence = dayData.departureScheduleAdherence;
      return {
        x: Moment(dayData.dates[0]).format('dd MM/DD'),
        y:
          scheduleAdherence && scheduleAdherence.scheduledCount > 0
            ? (100 * scheduleAdherence.onTimeCount) /
              scheduleAdherence.scheduledCount
            : null,
      };
    });

  return (
    <>
      <Typography variant="h5">On-Time Performance by Time of Day</Typography>
      TODO - bar chart with departure/arrival on-time %
      <br />
      <br />
      {graphParams.date !== graphParams.startDate ? (
        <div>
          <Typography variant="h5">On-Time Performance By Day</Typography>
          <XYPlot
            xType="ordinal"
            height={300}
            width={400}
            margin={{ left: 40, right: 10, top: 10, bottom: 60 }}
            yDomain={[0, 100]}
          >
            <HorizontalGridLines />
            <XAxis tickLabelAngle={-90} />
            <YAxis hideLine />
            <LineMarkSeries
              data={onTimeRateData}
              getNull={d => d.y !== null}
              color={CHART_COLORS[0]}
              stack
            />
            <ChartLabel
              text="%"
              className="alt-y-label"
              includeMargin={false}
              xPercent={0.06}
              yPercent={0.06}
              style={{
                transform: 'rotate(-90)',
                textAnchor: 'end',
              }}
            />
          </XYPlot>
          TODO - show arrival schedule adherence
        </div>
      ) : null}
      <br />
      <Typography variant="h5">Schedule Adherence</Typography>
      TODO - distribution of differences between actual arrival time and
      scheduled arrival time
    </>
  );
}

const mapStateToProps = state => ({
  tripMetrics: state.tripMetrics.data,
  graphParams: state.graphParams,
});

export default connect(mapStateToProps)(OnTimePerformanceStats);
