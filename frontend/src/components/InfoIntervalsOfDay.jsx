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
          y = interval[intervalField].avg;
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
    const { intervalData, intervalError } = this.props;

    const intervals = intervalData ? intervalData.intervals : null;
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
                  label="Average"
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
        <code>{intervalError || ''}</code>
      </div>
    );
  }
}

/*
   * Interval data is mainly the array named intervals.  It contains objects that resemble the graphData
   * object, for a given start_time and end_time.  Example is below.

  {
    "intervals": [
        {
            "startTime": "09:00",
            "endTime": "10:00",
            "headwayMin": {
                "count": 5,
                "avg": 10.936666666666664,
                "std": 5.4460729990619035,
                "min": 3.3833333333333333,
                "median": 11.45,
                "max": 19.3,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 1,
                        "binStart": 0,
                        "binEnd": 5
                    } etc.
  
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 3.3833333333333333
                    } etc.
                ]
            },
            "waitTimes": {
                "firstBus": "09:03:25",
                "lastBus": "09:58:06",
                "count": 60,
                "avg": 6.916666666666668,
                "std": 5.050841514044961,
                "min": 0.1,
                "median": 6.033333333333333,
                "max": 19.683333333333334,
                "histogram": [
                   etc.
                ],
                "percentiles": [
                   etc.
                ]
            },
            "tripTimes": {
                "startStop": "3994",
                "endStop": "5417",
                "count": 6,
                "avg": 19.025000000000002,
                "std": 2.3074506936668664,
                "min": 17.1,
                "median": 17.891666666666666,
                "max": 23.383333333333333,
                "histogram": [
                    etc.
                ],
                "percentiles": [
                    etc.
                ]
            }
        },
        {
            "start_time": "10:00",
            "end_time": "11:00",
            "headway_min": {
                etc.
            },
            "wait_times": {
                etc.
            },
            "trip_times": {
                etc.
            }
        },
        {
            "start_time": "11:00",
            "end_time": "12:00",
            etc.
        }
    ],
    "params": {
        "startStopId": "3994",
        "endStopId": "5417",
        "routeId": "J",
        "directionId": "J____I_F00",
        "startDate": "2019-04-08",
        "endDate": "2019-04-08",
        "startTime": "09:00",
        "endTime": "12:00"
    },
    "routeTitle": [
        "J-Church"
    ],
    "startStopTitle": "Church St & 22nd St",
    "endStopTitle": "Powell Station Inbound",
    "directions": [
        {
            "id": "J____I_F00",
            "title": "Inbound to Embarcadero Station"
        }
    ]
  }

*/

export default InfoIntervalsOfDay;
