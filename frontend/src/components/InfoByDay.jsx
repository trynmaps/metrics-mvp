import React, { useState } from 'react';
import { FormControl, FormControlLabel, Radio } from '@material-ui/core';
import {
  XYPlot,
  HorizontalGridLines,
  XAxis,
  YAxis,
  LineSeries,
  LineMarkSeries,
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
import {
  computeScores,
} from '../helpers/routeCalculations';
import {
  getDistanceInMiles
} from '../helpers/mapGeometry';
import Moment from 'moment';
import '../../node_modules/react-vis/dist/style.css';

/**
 * Bar chart of average and planning percentile wait and time across the day.
 */
function InfoByDay(props) {
  const AVERAGE_TIME = 'average_time';
  const PLANNING_TIME = 'planning_time';
  const LONG_WAIT = 'long_wait';
  const SPEED = 'speed';
  const TRAVEL_VARIABILITY = 'travel_variability';


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
    setCrosshairValues([waitData[index], tripData[index]]);
  };

  const onNearestXGeneric = (_value, { index }) => {
    // TODO: need to make only one chart's crosshair visible at a time,
    // this currently makes it appear on all charts: setCrosshairValues([_value]);
  };
  
  const computeDistance = (myGraphParams, myRoutes) => {
    if (myGraphParams && myGraphParams.endStopId) {
      const directionId = myGraphParams.directionId;
      const routeId = myGraphParams.routeId;
      const route = myRoutes.find(thisRoute => thisRoute.id === routeId);
      const directionInfo = route.directions.find(
        dir => dir.id === directionId,
      );
      return getDistanceInMiles(route, directionInfo, myGraphParams.startStopId, myGraphParams.endStopId);
    } else {
      return 0;
    }
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
  const mapDays = (field, attribute) => {

    let distance;    
    if (attribute === SPEED) {
       distance = routes ? computeDistance(graphParams, routes) : null;
    }
    
    return day => {
      let y = 0;

      if (day[field] != null) {
        if (attribute === AVERAGE_TIME) {
          y = day[field].median;
        } else if (attribute === PLANNING_TIME) {
          y = day[field].p90;
        } else if (attribute === LONG_WAIT) {
          y = Math.round((1 - day[field].probabilityLessThan) * 100); // the p less than is 20 min
        } else if (attribute === SPEED) {
          y = distance ? distance / (day[field].median / 60.0)
            : 0; // convert avg trip time to hours for mph
        } else if (attribute === TRAVEL_VARIABILITY) {
          y = (day[field].p90 - day[field].p10)/2;          
        }
        
      }

      if (y === undefined) {
        y = 0;
      }

      return {
        x: Moment(day.dates[0]).format('dd MM/DD'),
        y,
      };
    };
  }

    const { byDayData, routes, graphParams } = props;

    const waitData = byDayData && byDayData.map(mapDays('waitTimes', selectedOption));
    const tripData = byDayData && byDayData.map(mapDays('tripTimes', selectedOption));
    const meanWait = waitData && waitData.length > 0 && waitData.reduce((accum, value) => accum + value.y, 0) / waitData.length;
    const meanTrip = tripData && tripData.length > 0 && tripData.reduce((accum, value) => accum + value.y, 0) / tripData.length;
    const meanWaitData = [{ x: waitData[0].x, y: meanWait}, { x: waitData[waitData.length-1].x, y: meanWait}];
    const meanTripData = [{ x: tripData[0].x, y: meanWait + meanTrip}, { x: tripData[tripData.length-1].x, y: meanWait + meanTrip}];

    const maxWait = waitData && waitData.length > 0 && waitData.reduce((max, value) => max > value.y ? max : value.y, 0);
    const maxTrip = tripData && tripData.length > 0 && tripData.reduce((max, value) => max > value.y ? max : value.y, 0);

    const legendItems = [
      { title: 'Travel time', color: CHART_COLORS[1], strokeWidth: 10 },
      { title: 'Wait time', color: CHART_COLORS[0], strokeWidth: 10 },
    ];

    // 2nd chart: long wait %
    
    const longWaitData = byDayData && byDayData.map(mapDays('waitTimes', LONG_WAIT));
    const maxLongWait = longWaitData && longWaitData.length > 0 && longWaitData.reduce((max, value) => max > value.y ? max : value.y, 0);
    
    // 3rd chart: speed
    
    const speedData = byDayData && byDayData.map(mapDays('tripTimes', SPEED));
    const maxSpeed = speedData && speedData.length > 0 && speedData.reduce((max, value) => max > value.y ? max : value.y, 0);
    
    // 4th chart: travel variability
    
    const travelVariabilityData = byDayData && byDayData.map(mapDays('tripTimes', TRAVEL_VARIABILITY));
    const maxTravelVariability = travelVariabilityData && travelVariabilityData.length > 0 && travelVariabilityData.reduce((max, value) => max > value.y ? max : value.y, 0);
    
    // 5th chart: score

    const scoreData = byDayData.map((day, index) => {
      const grades = computeScores(
        waitData[index].y,
        longWaitData[index].y,
        speedData[index].y,
        travelVariabilityData[index].y);
      return {
        x: Moment(day.dates[0]).format('dd MM/DD'),
        y: grades.totalScore,
      }
    });
    const maxScore = scoreData && scoreData.length > 0 && scoreData.reduce((max, value) => max > value.y ? max : value.y, 0);

    // Non-default chart margins for rotated x-axis tick marks.
    // Default is {left: 40, right: 10, top: 10, bottom: 40}
    
    const chartMargins = {left: 40, right: 10, top: 10, bottom: 60};
    
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
              margin={chartMargins}
              stackBy="y"
              yDomain={[ 0, maxWait + maxTrip ]}              
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} />
              <YAxis hideLine />

              <VerticalBarSeries
                data={waitData}
                color={CHART_COLORS[0]}
                onNearestX={onNearestX}
                stack={true}
              />
              <VerticalBarSeries data={tripData} color={CHART_COLORS[1]} stack={true}/>
              <LineSeries data={meanWaitData} color={CHART_COLORS[2]} strokeDasharray={'5, 5'}/>
              <LineSeries data={meanTripData} color={CHART_COLORS[3]} strokeDasharray={'5, 5'}/>

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
                      {crosshairValues[1] ? Math.round(crosshairValues[1].y) : ''}
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
            
           Long Wait %
            
            <XYPlot
              xType="ordinal"
              height={300}
              width={400}
              margin={chartMargins}
              yDomain={[ 0, maxLongWait ]}              
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} />
              <YAxis hideLine />

              <LineMarkSeries
                data={longWaitData}
                color={CHART_COLORS[0]}
                onNearestX={onNearestXGeneric}
                stack={true}
              />

              <ChartLabel
                text="Long Wait %"
                className="alt-y-label"
                includeMargin={false}
                xPercent={0.06}
                yPercent={0.06}
                style={{
                  transform: 'rotate(-90)',
                  textAnchor: 'end',
                }}
              />

              {crosshairValues.length > 0 && false && ( /* need separate state for each crosshair */
                <Crosshair
                  values={crosshairValues}
                  style={REACT_VIS_CROSSHAIR_NO_LINE}
                >
                </Crosshair>
              )}
            </XYPlot>

            Median Speed
            
            <XYPlot
              xType="ordinal"
              height={300}
              width={400}
              margin={chartMargins}
              yDomain={[ 0, maxSpeed ]}              
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} />
              <YAxis hideLine />

              <LineMarkSeries
                data={speedData}
                color={CHART_COLORS[1]}
                onNearestX={onNearestXGeneric}
                stack={true}
              />

              <ChartLabel
                text="Median Speed (mph)"
                className="alt-y-label"
                includeMargin={false}
                xPercent={0.06}
                yPercent={0.06}
                style={{
                  transform: 'rotate(-90)',
                  textAnchor: 'end',
                }}
              />

              {crosshairValues.length > 0 && false && ( /* need separate state for each crosshair */
                <Crosshair
                  values={crosshairValues}
                  style={REACT_VIS_CROSSHAIR_NO_LINE}
                >
                </Crosshair>
              )}
            </XYPlot>

            Travel Variability

            <XYPlot
              xType="ordinal"
              height={300}
              width={400}
              margin={chartMargins}
              yDomain={[ 0, maxTravelVariability ]}              
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} />
              <YAxis hideLine />

              <LineMarkSeries
                data={travelVariabilityData}
                color={CHART_COLORS[1]}
                onNearestX={onNearestXGeneric}
                stack={true}
              />

              <ChartLabel
                text={'Variability (\u00b1 min)'}
                className="alt-y-label"
                includeMargin={false}
                xPercent={0.06}
                yPercent={0.06}
                style={{
                  transform: 'rotate(-90)',
                  textAnchor: 'end',
                }}
              />

              {crosshairValues.length > 0 && false && ( /* need separate state for each crosshair */
                <Crosshair
                  values={crosshairValues}
                  style={REACT_VIS_CROSSHAIR_NO_LINE}
                >
                </Crosshair>
              )}
            </XYPlot>


            Score

            <XYPlot
              xType="ordinal"
              height={300}
              width={400}
              margin={chartMargins}
              yDomain={[ 0, maxScore ]}              
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} />
              <YAxis hideLine />

              <LineMarkSeries
                data={scoreData}
                color={CHART_COLORS[2]}
                onNearestX={onNearestXGeneric}
                stack={true}
              />

              <ChartLabel
                text={'Score'}
                className="alt-y-label"
                includeMargin={false}
                xPercent={0.06}
                yPercent={0.06}
                style={{
                  transform: 'rotate(-90)',
                  textAnchor: 'end',
                }}
              />

              {crosshairValues.length > 0 && false && ( /* need separate state for each crosshair */
                <Crosshair
                  values={crosshairValues}
                  style={REACT_VIS_CROSSHAIR_NO_LINE}
                >
                </Crosshair>
              )}
            </XYPlot>
          </div>
        ) : <code>{'No data.'}</code>}

      </div>
    );
}


export default InfoByDay;
