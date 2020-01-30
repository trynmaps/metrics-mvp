import React, { Component } from 'react';
import { FormControl, FormControlLabel, Radio } from '@material-ui/core';
import {
  XYPlot,
  HorizontalGridLines,
  XAxis,
  YAxis,
  VerticalBarSeries,
  ChartLabel,
  Crosshair,
} from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import { getPercentileValue } from '../helpers/graphData';
import {
  CHART_COLORS,
  PLANNING_PERCENTILE,
  REACT_VIS_CROSSHAIR_NO_LINE,
} from '../UIConstants';
import '../../node_modules/react-vis/dist/style.css';

/**
 * Bar chart of average and planning percentile wait and time across the day.
 */
class InfoIntervalsOfDay extends Component {
  static AVERAGE_TIME = 'average_time';

  static PLANNING_TIME = 'planning_time';

  constructor(props) {
    super(props);

    this.state = {
      selectedOption: InfoIntervalsOfDay.AVERAGE_TIME, // radio button starts on average time
      crosshairValues: [], // tooltip starts out empty
    };
  }

  /**
   * Event handler for radio buttons
   * @param {changeEvent} The change event on the radio buttons.
   * @private
   */
  handleOptionChange = changeEvent => {
    this.setState({
      selectedOption: changeEvent.target.value,
    });
  };

  /**
   * Event handler for onMouseLeave.
   * @private
   */
  onMouseLeave = () => {
    this.setState({ crosshairValues: [] });
  };

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  onNearestX = (_value, { index }) => {
    this.setState({
      crosshairValues: [this.waitData[index], this.tripData[index]],
    });
  };

  /**
   * Returns a mapping function for creating a react-vis XYPlot data series out of interval data.
   * Example of interval data is shown at end of this file.
   * Mapping function is for either wait time or trip time, and for either average or planning percentile time.
   *
   * It's possible that an interval will have null wait/travel times due to lack of data (no vehicles
   * running in that interval), in which case we replace with zero values (best effort).
   *
   * @param {intervalField} One of wait_times or travel_times.
   */
  mapInterval(intervalField) {
    return interval => {
      let y = 0;

      if (interval[intervalField] != null) {
        if (this.state.selectedOption === InfoIntervalsOfDay.AVERAGE_TIME) {
          y = getPercentileValue(interval[intervalField], 50);
        } else {
          y = getPercentileValue(interval[intervalField], PLANNING_PERCENTILE);
        }
      }

      if (y === undefined) {
        y = 0;
      }

      return {
        x: `${interval.startTime} - ${interval.endTime}`,
        y,
      };
    };
  }

  render() {
    const { tripMetrics } = this.props;

    const intervals = tripMetrics.timeRanges;
    this.waitData = intervals
      ? intervals.map(this.mapInterval('waitTimes'))
      : null;
    this.tripData = intervals
      ? intervals.map(this.mapInterval('tripTimes'))
      : null;

    const legendItems = [
      { title: 'Travel time', color: CHART_COLORS[1], strokeWidth: 10 },
      { title: 'Wait time', color: CHART_COLORS[0], strokeWidth: 10 },
    ];

    return (
      <div>
        {intervals ? (
          <div>
            <FormControl>
              <div className="controls">
                <FormControlLabel
                  control={
                    <Radio
                      id="average_time"
                      type="radio"
                      value={InfoIntervalsOfDay.AVERAGE_TIME}
                      checked={
                        this.state.selectedOption ===
                        InfoIntervalsOfDay.AVERAGE_TIME
                      }
                      onChange={this.handleOptionChange}
                    />
                  }
                  label="Median"
                />

                <FormControlLabel
                  control={
                    <Radio
                      id="planning_time"
                      type="radio"
                      value={InfoIntervalsOfDay.PLANNING_TIME}
                      checked={
                        this.state.selectedOption ===
                        InfoIntervalsOfDay.PLANNING_TIME
                      }
                      onChange={this.handleOptionChange}
                    />
                  }
                  label={`Planning (${PLANNING_PERCENTILE}th percentile)`}
                />
              </div>
            </FormControl>

            <XYPlot
              xType="ordinal"
              height={300}
              width={400}
              stackBy="y"
              onMouseLeave={this.onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis />
              <YAxis hideLine />

              <VerticalBarSeries
                data={this.waitData}
                color={CHART_COLORS[0]}
                onNearestX={this.onNearestX}
              />
              <VerticalBarSeries data={this.tripData} color={CHART_COLORS[1]} />

              <ChartLabel
                text="minutes"
                className="alt-y-label"
                includeMargin={false}
                xPercent={0.06}
                yPercent={0.06}
                style={{
                  transform: 'rotate(-90)',
                  textAnchor: 'end',
                }}
              />

              {this.state.crosshairValues.length > 0 && (
                <Crosshair
                  values={this.state.crosshairValues}
                  style={REACT_VIS_CROSSHAIR_NO_LINE}
                >
                  <div className="rv-crosshair__inner__content">
                    <p>
                      Onboard time:{' '}
                      {Math.round(this.state.crosshairValues[1].y)}
                    </p>
                    <p>
                      Wait time: {Math.round(this.state.crosshairValues[0].y)}
                    </p>
                  </div>
                </Crosshair>
              )}
            </XYPlot>
            <DiscreteColorLegend
              orientation="horizontal"
              width={300}
              items={legendItems}
            />
          </div>
        ) : null}
      </div>
    );
  }
}

export default InfoIntervalsOfDay;
