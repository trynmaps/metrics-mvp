import React, { useState } from 'react';
import { connect } from 'react-redux';
import {
  FormControl,
  FormControlLabel,
  Radio,
  Typography,
} from '@material-ui/core';
import { CHART_COLORS, PLANNING_PERCENTILE } from '../UIConstants';
import { renderDateRange, getTimeRangeShortLabel } from '../helpers/dateTime';
import SimpleVerticalBarChart from './SimpleVerticalBarChart';
import { getPercentileValue } from '../helpers/graphData';

const AVERAGE_TIME = 'average_time';
const PLANNING_TIME = 'planning_time';

function getChartData(timeRanges, property, selectedOption) {
  return timeRanges
    ? timeRanges.map(timeRange => {
        let y = 0;

        if (timeRange[property] != null) {
          if (selectedOption === AVERAGE_TIME) {
            y = getPercentileValue(timeRange[property], 50);
          } else {
            y = getPercentileValue(timeRange[property], PLANNING_PERCENTILE);
          }
        }

        if (y === undefined) {
          y = 0;
        }

        return {
          x: `${timeRange.startTime}-${timeRange.endTime}`,
          y,
        };
      })
    : null;
}

function TripTimesByTimeChart(props) {
  const { tripMetrics, graphParams } = props;

  const [selectedOption, setSelectedOption] = useState(AVERAGE_TIME);

  const handleOptionChange = changeEvent => {
    setSelectedOption(changeEvent.target.value);
  };

  const compareDateRanges = !!graphParams.secondDateRange;

  const timeRangesData = tripMetrics ? tripMetrics.timeRanges : null;
  const timeRangesData2 = tripMetrics ? tripMetrics.timeRanges2 : null;

  if (graphParams.firstDateRange.startTime || !timeRangesData) {
    return null;
  }

  const waitData = getChartData(timeRangesData, 'waitTimes', selectedOption);
  const tripData = getChartData(timeRangesData, 'tripTimes', selectedOption);

  const scheduledWaitData = getChartData(
    timeRangesData,
    'scheduledWaitTimes',
    selectedOption,
  );
  const scheduledTripData = getChartData(
    timeRangesData,
    'scheduledTripTimes',
    selectedOption,
  );

  const waitData2 = getChartData(timeRangesData2, 'waitTimes', selectedOption);
  const tripData2 = getChartData(timeRangesData2, 'tripTimes', selectedOption);

  return (
    <div className="chart-section">
      <Typography variant="h6">Trip Times by Time of Day</Typography>
      <FormControl>
        <div className="controls">
          <FormControlLabel
            control={
              <Radio
                id="average_time"
                type="radio"
                value={AVERAGE_TIME}
                checked={selectedOption === AVERAGE_TIME}
                onChange={handleOptionChange}
              />
            }
            label="Median"
          />

          <FormControlLabel
            control={
              <Radio
                id="planning_time"
                type="radio"
                value={PLANNING_TIME}
                checked={selectedOption === PLANNING_TIME}
                onChange={handleOptionChange}
              />
            }
            label={`Planning (${PLANNING_PERCENTILE}th percentile)`}
          />
        </div>
      </FormControl>
      <SimpleVerticalBarChart
        width={500}
        height={250}
        xType="ordinal"
        xFormat={getTimeRangeShortLabel}
        yFormat={v => `${Math.round(v)}`}
        yUnits="minutes"
        stackBy="y"
        series={
          compareDateRanges
            ? [
                {
                  title: `${renderDateRange(
                    graphParams.firstDateRange,
                  )} Wait Time (Observed)`,
                  color: CHART_COLORS[1],
                  data: waitData,
                  cluster: 'first',
                },
                {
                  title: `${renderDateRange(
                    graphParams.firstDateRange,
                  )} Travel Time (Observed)`,
                  color: CHART_COLORS[3],
                  data: tripData,
                  cluster: 'first',
                },
                {
                  title: `${renderDateRange(
                    graphParams.secondDateRange,
                  )} Wait Time (Observed)`,
                  color: CHART_COLORS[0],
                  data: waitData2,
                  cluster: 'second',
                },
                {
                  title: `${renderDateRange(
                    graphParams.secondDateRange,
                  )} Travel Time (Observed)`,
                  color: CHART_COLORS[2],
                  data: tripData2,
                  cluster: 'second',
                },
              ]
            : [
                {
                  title: 'Wait Time (Observed)',
                  color: CHART_COLORS[1],
                  data: waitData,
                  cluster: 'first',
                },
                {
                  title: 'Travel Time (Observed)',
                  color: CHART_COLORS[3],
                  data: tripData,
                  cluster: 'first',
                },
                {
                  title: 'Wait Time (Scheduled)',
                  color: CHART_COLORS[0],
                  data: scheduledWaitData,
                  cluster: 'second',
                },
                {
                  title: 'Travel Time (Scheduled)',
                  color: CHART_COLORS[2],
                  data: scheduledTripData,
                  cluster: 'second',
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

export default connect(mapStateToProps)(TripTimesByTimeChart);
