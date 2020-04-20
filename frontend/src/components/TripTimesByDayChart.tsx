import React, { useState } from 'react';
import { connect } from 'react-redux';
import {
  FormControl,
  FormControlLabel,
  Radio,
  Typography,
} from '@material-ui/core';
import Moment from 'moment';
import { getPercentileValue } from 'helpers';
import SimpleVerticalBarChart from './SimpleVerticalBarChart';
import { CHART_COLORS, PLANNING_PERCENTILE } from '../UIConstants';
import '../../node_modules/react-vis/dist/style.css';

const AVERAGE_TIME = 'average_time';
const PLANNING_TIME = 'planning_time';

/**
 * Returns a react-vis XYPlot data series from interval data.
 * Example of interval data is shown at end of this file.
 * Mapping function is for either wait time or trip time, and for either average or planning percentile time.
 *
 * It's possible that an interval will have null wait/travel times due to lack of data (no vehicles
 * running in that interval), in which case we replace with zero values (best effort).
 */
function getChartData(byDayData, property, selectedOption) {
  return byDayData
    ? byDayData.map((day, i) => {
        let y = 0;

        if (day[property] != null) {
          if (selectedOption === AVERAGE_TIME) {
            y = day[property].median;
          } else if (selectedOption === PLANNING_TIME) {
            y = getPercentileValue(day[property], 90);
          }
        }

        if (y === undefined) {
          y = 0;
        }

        return {
          x: i,
          y,
        };
      })
    : null;
}

function TripTimesByDayChart(props) {
  const { graphParams, tripMetrics } = props;

  const [selectedOption, setSelectedOption] = useState(AVERAGE_TIME); // radio button starts on average time

  const byDayData = tripMetrics ? tripMetrics.byDay : null;

  if (
    graphParams.firstDateRange.date === graphParams.firstDateRange.startDate ||
    !byDayData
  ) {
    return null;
  }

  /**
   * Event handler for radio buttons
   * @param {changeEvent} The change event on the radio buttons.
   * @private
   */
  const handleOptionChange = changeEvent => {
    setSelectedOption(changeEvent.target.value);
  };

  const waitData = getChartData(byDayData, 'waitTimes', selectedOption);
  const scheduledWaitData = getChartData(
    byDayData,
    'scheduledWaitTimes',
    selectedOption,
  );
  const tripData = getChartData(byDayData, 'tripTimes', selectedOption);
  const scheduledTripData = getChartData(
    byDayData,
    'scheduledTripTimes',
    selectedOption,
  );

  const getMaxY = arr =>
    arr ? arr.reduce((max, value) => (max > value.y ? max : value.y), 0) : 0;

  const maxWait = Math.max(getMaxY(waitData), getMaxY(scheduledWaitData));
  const maxTrip = Math.max(getMaxY(tripData), getMaxY(scheduledTripData));

  return (
    <div className="chart-section">
      <Typography variant="h6">Trip Times by Day</Typography>
      <FormControl>
        <div className="controls">
          <FormControlLabel
            control={
              <Radio
                id="average_time"
                // type="radio"
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
                // type="radio"
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
        xFormat={i =>
          i === Math.round(i)
            ? Moment(byDayData[i].dates[0]).format('ddd M/D')
            : ''
        }
        xAxisMaxTicks={5}
        yFormat={v => `${Math.round(v)}`}
        yUnits="minutes"
        stackBy="y"
        yDomain={[0, maxWait + maxTrip]}
        series={[
          {
            title: 'Wait Time (Observed)',
            color: CHART_COLORS[1],
            data: waitData,
            cluster: 'first',
            size: 4,
          },
          {
            title: 'Travel Time (Observed)',
            color: CHART_COLORS[3],
            data: tripData,
            cluster: 'first',
            size: 4,
          },
          {
            title: 'Wait Time (Scheduled)',
            color: CHART_COLORS[0],
            data: scheduledWaitData,
            cluster: 'second',
            size: 0,
            // opacity: 0.5,
          },
          {
            title: 'Travel Time (Scheduled)',
            color: CHART_COLORS[2],
            data: scheduledTripData,
            cluster: 'second',
            size: 0,
            // opacity: 0.5,
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

export default connect(mapStateToProps)(TripTimesByDayChart);
