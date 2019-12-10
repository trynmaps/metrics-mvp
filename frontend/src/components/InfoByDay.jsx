import React, { useState } from 'react';
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
import {
  CHART_COLORS,
  PLANNING_PERCENTILE,
  REACT_VIS_CROSSHAIR_NO_LINE,
} from '../UIConstants';
import '../../node_modules/react-vis/dist/style.css';

/**
 * Bar chart of average and planning percentile wait and time across the day.
 */
function InfoByDay(props) {
  const AVERAGE_TIME = 'average_time';

  const PLANNING_TIME = 'planning_time';


  const [selectedOption, setSelectedOption] = useState(AVERAGE_TIME); // radio button starts on average time
  const [crosshairValues, setCrosshairValues] = useState([]); // tooltip starts out empty

  /**
   * Event handler for radio buttons
   * @param {changeEvent} The change event on the radio buttons.
   * @private
   */
  const handleOptionChange = changeEvent => {
    setSelectedOption(changeEvent.target.value);
  };

  /**
   * Event handler for onMouseLeave.
   * @private
   */
  const onMouseLeave = () => {
    setCrosshairValues([]);
  };

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  const onNearestX = (_value, { index }) => {
    //setCrosshairValues([waitData[index], tripData[index]]); TODO
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
  const mapDays = intervalField => {
    return day => {
      let y = 0;

      if (day[intervalField] != null) {
        if (selectedOption === AVERAGE_TIME) {
          y = day[intervalField].median;
        } else {
          y = day[intervalField].p90;
        }
      }

      if (y === undefined) {
        y = 0;
      }

      return {
        x: day.dates[0], // TODO: format date using Moment
        y,
      };
    };
  }

    const { byDayData } = props;

    const waitData = byDayData && byDayData.map(mapDays('waitTimes'));//.reverse()); // XXX
    const tripData = byDayData && byDayData.map(mapDays('tripTimes'));//.reverse());

    const legendItems = [
      { title: 'Travel time', color: CHART_COLORS[1], strokeWidth: 10 },
      { title: 'Wait time', color: CHART_COLORS[0], strokeWidth: 10 },
    ];

    return (
      <div>
        {byDayData ? (
          <div>
            <FormControl>
              <div className="controls">
                <FormControlLabel
                  control={
                    <Radio
                      id="average_time"
                      type="radio"
                      value={AVERAGE_TIME}
                      checked={
                        selectedOption ===
                        AVERAGE_TIME
                      }
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
                      checked={
                        selectedOption ===
                        PLANNING_TIME
                      }
                      onChange={handleOptionChange}
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
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis />
              <YAxis hideLine />

              <VerticalBarSeries
                data={waitData}
                color={CHART_COLORS[0]}
                onNearestX={onNearestX}
              />
              <VerticalBarSeries data={tripData} color={CHART_COLORS[1]} />

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

              {crosshairValues.length > 0 && (
                <Crosshair
                  values={crosshairValues}
                  style={REACT_VIS_CROSSHAIR_NO_LINE}
                >
                  <div className="rv-crosshair__inner__content">
                    <p>
                      Onboard time:{' '}
                      {Math.round(crosshairValues[1].y)}
                    </p>
                    <p>
                      Wait time: {Math.round(crosshairValues[0].y)}
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
        ) : <code>{'No data.'}</code>}
        
      </div>
    );
}


export default InfoByDay;
