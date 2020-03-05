import React, { useState, Fragment } from 'react';
import {
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  Tab,
  Tabs,
  useTheme,
} from '@material-ui/core';

import {
  FlexibleWidthXYPlot,
  HorizontalGridLines,
  XAxis,
  YAxis,
  LineMarkSeries,
  AreaSeries,
  ChartLabel,
  Crosshair,
} from 'react-vis';
// import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import Moment from 'moment';
import DateTimeLabel from './DateTimeLabel';
import {
  PLANNING_PERCENTILE,
  REACT_VIS_CROSSHAIR_NO_LINE,
} from '../UIConstants';
import { computeScores } from '../helpers/routeCalculations';
import { getPercentileValue } from '../helpers/graphData';
import { getDistanceInMiles } from '../helpers/mapGeometry';
import '../../node_modules/react-vis/dist/style.css';

/**
 * Bar chart of average and planning percentile wait and time across the day.
 */
function InfoByDay(props) {
  const AVERAGE_TIME = 'average_time';
  const PLANNING_TIME = 'planning_time';
  const ON_TIME_RATE = 'on_time_rate';
  const SPEED = 'speed';
  const TRAVEL_VARIABILITY = 'travel_variability';
  const CHART_HEIGHT = 200;
  const MARK_SIZE = 4;

  const [tabValue, setTabValue] = React.useState(0);

  const [selectedOption, setSelectedOption] = useState(AVERAGE_TIME); // radio button starts on average time
  const [crosshairValues, setCrosshairValues] = useState([]); // tooltip starts out empty

  const { byDayData, byDayData2, routes, graphParams } = props;

  const theme = useTheme();

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

  const computeDistance = (myGraphParams, myRoutes) => {
    if (myGraphParams && myGraphParams.endStopId) {
      const directionId = myGraphParams.directionId;
      const routeId = myGraphParams.routeId;
      const route = myRoutes.find(thisRoute => thisRoute.id === routeId);
      const directionInfo = route.directions.find(
        dir => dir.id === directionId,
      );
      return getDistanceInMiles(
        route,
        directionInfo,
        myGraphParams.startStopId,
        myGraphParams.endStopId,
      );
    }
    return 0;
  };

  /**
   * Returns a mapping function for creating a react-vis XYPlot data series out of interval data.
   *
   * Mapping function is for either wait time or trip time, and for either average or planning percentile time.
   *
   * It's possible that an interval will have null wait/travel times due to lack of data (no vehicles
   * running in that interval), in which case we replace with zero values (best effort).
   *
   * @param {intervalField} One of wait_times or travel_times.
   */
  const mapDays = (field, attribute, fieldToAdd) => {
    let distance;
    if (attribute === SPEED) {
      distance = routes ? computeDistance(graphParams, routes) : null;
    }

    return (day, index) => {
      let y = 0;
      let y0 = 0;

      if (day[field] != null) {
        if (attribute === AVERAGE_TIME) {
          const stackedValue = fieldToAdd ? day[fieldToAdd].median : 0;
          y = day[field].median + stackedValue;
          y0 = stackedValue;
        } else if (attribute === PLANNING_TIME) {
          const stackedValue = fieldToAdd
            ? getPercentileValue(day[fieldToAdd], 90)
            : 0;
          y = getPercentileValue(day[field], 90) + stackedValue;
          y0 = stackedValue;
        } else if (attribute === ON_TIME_RATE) {
          const scheduleAdherence = day[field];
          y =
            scheduleAdherence && scheduleAdherence.scheduledCount > 0
              ? (100 * scheduleAdherence.onTimeCount) /
                scheduleAdherence.scheduledCount
              : null;
        } else if (attribute === SPEED) {
          y = distance ? distance / (day[field].median / 60.0) : 0; // convert avg trip time to hours for mph
        } else if (attribute === TRAVEL_VARIABILITY) {
          y =
            (getPercentileValue(day[field], 90) -
              getPercentileValue(day[field], 10)) /
            2;
        }
      }

      if (y === undefined) {
        y = 0;
      }

      const x = index;
      const xAsDate = Moment(day.dates[0]).format('dd MM/DD');

      return {
        x,
        y,
        y0,
        xAsDate,
      };
    };
  };

  const maxOfDataSeries = series =>
    series &&
    series.length > 0 &&
    series.reduce((max, value) => (max > value.y ? max : value.y), 0);
  const maxOfBothDataSeries = (series1, series2) => {
    const max1 = maxOfDataSeries(series1);
    const max2 = maxOfDataSeries(series2);
    return Math.max(max1, max2 || 0);
  };

  // 1st chart: journey times

  const waitData =
    byDayData && byDayData.map(mapDays('waitTimes', selectedOption));

  const tripData =
    byDayData &&
    byDayData.map(mapDays('tripTimes', selectedOption, 'waitTimes'));

  const waitData2 =
    byDayData2 && byDayData2.map(mapDays('waitTimes', selectedOption));

  const tripData2 =
    byDayData2 &&
    byDayData2.map(mapDays('tripTimes', selectedOption, 'waitTimes'));

  const maxWait = maxOfBothDataSeries(waitData, waitData2);
  const maxTrip = maxOfBothDataSeries(tripData, tripData2);

  /*
  const legendItems = [
    { title: 'Travel time', color: theme.palette.primary.main, strokeWidth: 10 },
    { title: 'Wait time', color: theme.palette.primary.dark, strokeWidth: 10 },
  ];
*/
  // 2nd chart: on time %

  const onTimeRateData =
    byDayData &&
    byDayData.map(mapDays('departureScheduleAdherence', ON_TIME_RATE));
  const onTimeRateData2 =
    byDayData2 &&
    byDayData2.map(mapDays('departureScheduleAdherence', ON_TIME_RATE));

  // 3rd chart: speed

  const speedData = byDayData && byDayData.map(mapDays('tripTimes', SPEED));
  const speedData2 = byDayData2 && byDayData2.map(mapDays('tripTimes', SPEED));
  const maxSpeed = maxOfBothDataSeries(speedData, speedData2);

  // 4th chart: travel variability

  const travelVariabilityData =
    byDayData && byDayData.map(mapDays('tripTimes', TRAVEL_VARIABILITY));
  const travelVariabilityData2 =
    byDayData2 && byDayData2.map(mapDays('tripTimes', TRAVEL_VARIABILITY));
  const maxTravelVariability = maxOfBothDataSeries(
    travelVariabilityData,
    travelVariabilityData2,
  );

  // 5th chart: score

  const scoreData =
    byDayData &&
    byDayData.map((day, index) => {
      const grades = computeScores(
        waitData[index].y,
        onTimeRateData[index].y / 100,
        speedData[index].y,
        travelVariabilityData[index].y,
      );
      return {
        x: index,
        xAsDate: Moment(day.dates[0]).format('dd MM/DD'),
        y: grades.totalScore,
      };
    });
  const scoreData2 =
    byDayData2 &&
    byDayData2.map((day, index) => {
      const grades = computeScores(
        waitData2[index].y,
        onTimeRateData2[index].y / 100,
        speedData2[index].y,
        travelVariabilityData2[index].y,
      );
      return {
        x: index,
        xAsDate: Moment(day.dates[0]).format('dd MM/DD'),
        y: grades.totalScore,
      };
    });
  const maxScore = maxOfBothDataSeries(scoreData, scoreData2);

  // Non-default chart margins for rotated x-axis tick marks.
  // Default is {left: 40, right: 10, top: 10, bottom: 40}

  const chartMargins = { left: 40, right: 10, top: 10, bottom: 60 };

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  const onNearestX = (_value, { index }) => {
    setCrosshairValues([
      waitData[index] ? waitData[index] : 0,
      tripData[index] ? tripData[index] : 0,
    ]);
    // TODO: add secondary data
  };

  const onNearestXGeneric = (/* _value, { index } */) => {
    // TODO: need to make only one chart's crosshair visible at a time,
    // this currently makes it appear on all charts: setCrosshairValues([_value]);
  };

  /**
   * For the x-axis, render indexes as relative to the primary data series' dates.  If the index
   * is above the primary data series, show as blank for now.
   */
  const primaryDateFormatter = value => {
    if (value < waitData.length) {
      return waitData[value].xAsDate;
    }
    return '';
  };

  function handleTabChange(event, newValue) {
    setTabValue(newValue);

    // This is a workaround to trigger the react-vis resize listeners,
    // because the hidden flexible width charts are all width zero, and
    // stay width zero when unhidden.
    window.dispatchEvent(new Event('resize'));
  }

  function a11yProps(index) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }

  const JOURNEY_TIMES = 0;
  const SCORE = 1;
  const ON_TIME = 2;
  const MEDIAN_SPEED = 3;
  const TRIP_VARIABILITY = 4;

  return (
    <div>
      {byDayData ? (
        <div>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="tab bar"
            variant="scrollable"
            scrollButtons="on"
          >
            <Tab
              style={{ minWidth: 72 }}
              label="Journey Times"
              {...a11yProps(JOURNEY_TIMES)}
            />
            <Tab style={{ minWidth: 72 }} label="Score" {...a11yProps(SCORE)} />
            <Tab
              style={{ minWidth: 72 }}
              label="On-Time %"
              {...a11yProps(ON_TIME)}
            />
            <Tab
              style={{ minWidth: 72 }}
              label="Median Speed"
              {...a11yProps(MEDIAN_SPEED)}
            />
            <Tab
              style={{ minWidth: 72 }}
              label="Trip Variability"
              {...a11yProps(TRIP_VARIABILITY)}
            />
          </Tabs>

          <DateTimeLabel
            style={{ display: 'inline-block', minWidth: 330, paddingTop: 8 }}
            dateRangeParams={graphParams.firstDateRange}
            colorCode={theme.palette.primary.main}
          />
          {graphParams.secondDateRange ? (
            <Fragment>
              <br />
              <DateTimeLabel
                style={{ display: 'inline-block', minWidth: 330 }}
                dateRangeParams={graphParams.secondDateRange}
                colorCode={theme.palette.secondary.light}
              />
            </Fragment>
          ) : null}

          <Box py={1} hidden={tabValue !== JOURNEY_TIMES}>
            <FlexibleWidthXYPlot
              xType="ordinal"
              height={CHART_HEIGHT}
              margin={chartMargins}
              yDomain={[0, maxTrip + maxWait]}
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} tickFormat={primaryDateFormatter} />
              <YAxis hideLine />

              <AreaSeries
                data={waitData}
                opacity={0.3}
                color={theme.palette.primary.dark}
              />
              <LineMarkSeries
                data={waitData}
                color={theme.palette.primary.dark}
                size={MARK_SIZE}
                onNearestX={onNearestX}
              />
              <AreaSeries
                data={tripData}
                opacity={0.3}
                color={theme.palette.primary.light}
              />
              <LineMarkSeries
                data={tripData}
                color={theme.palette.primary.light}
                size={MARK_SIZE}
              />
              {byDayData2 ? (
                <LineMarkSeries
                  data={waitData2}
                  color={theme.palette.secondary.dark}
                  size={MARK_SIZE}
                  onNearestX={onNearestX}
                />
              ) : null}
              {byDayData2 ? (
                <LineMarkSeries
                  data={tripData2}
                  color={theme.palette.secondary.light}
                  size={MARK_SIZE}
                />
              ) : null}

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
                      {crosshairValues[1]
                        ? Math.round(
                            crosshairValues[1].y - crosshairValues[0].y,
                          )
                        : ''}
                    </p>
                    <p>Wait time: {Math.round(crosshairValues[0].y)}</p>
                  </div>
                </Crosshair>
              )}
            </FlexibleWidthXYPlot>
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

            {/*          <DiscreteColorLegend
            orientation="horizontal"
            width={300}
            items={legendItems}
          /> */}
          </Box>

          <Box py={1} hidden={tabValue !== ON_TIME}>
            <FlexibleWidthXYPlot
              xType="ordinal"
              height={CHART_HEIGHT}
              margin={chartMargins}
              yDomain={[0, 100]}
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} tickFormat={primaryDateFormatter} />
              <YAxis hideLine />

              <LineMarkSeries
                data={onTimeRateData}
                color={theme.palette.primary.main}
                size={MARK_SIZE}
                onNearestX={onNearestXGeneric}
              />
              <LineMarkSeries
                data={onTimeRateData2}
                color={theme.palette.secondary.main}
                size={MARK_SIZE}
                onNearestX={onNearestXGeneric}
              />

              <ChartLabel
                text="On-Time %"
                className="alt-y-label"
                includeMargin={false}
                xPercent={0.06}
                yPercent={0.06}
                style={{
                  transform: 'rotate(-90)',
                  textAnchor: 'end',
                }}
              />

              {crosshairValues.length > 0 &&
              false /* need separate state for each crosshair */ && (
                  <Crosshair
                    values={crosshairValues}
                    style={REACT_VIS_CROSSHAIR_NO_LINE}
                  ></Crosshair>
                )}
            </FlexibleWidthXYPlot>
          </Box>

          <Box py={1} hidden={tabValue !== MEDIAN_SPEED}>
            <FlexibleWidthXYPlot
              xType="ordinal"
              height={CHART_HEIGHT}
              margin={chartMargins}
              yDomain={[0, maxSpeed]}
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} tickFormat={primaryDateFormatter} />
              <YAxis hideLine />

              <LineMarkSeries
                data={speedData}
                color={theme.palette.primary.main}
                size={MARK_SIZE}
                onNearestX={onNearestXGeneric}
              />
              <LineMarkSeries
                data={speedData2}
                color={theme.palette.secondary.main}
                size={MARK_SIZE}
                onNearestX={onNearestXGeneric}
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

              {crosshairValues.length > 0 &&
              false /* need separate state for each crosshair */ && (
                  <Crosshair
                    values={crosshairValues}
                    style={REACT_VIS_CROSSHAIR_NO_LINE}
                  ></Crosshair>
                )}
            </FlexibleWidthXYPlot>
          </Box>

          <Box py={1} hidden={tabValue !== TRIP_VARIABILITY}>
            <FlexibleWidthXYPlot
              xType="ordinal"
              height={CHART_HEIGHT}
              margin={chartMargins}
              yDomain={[0, maxTravelVariability]}
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} tickFormat={primaryDateFormatter} />
              <YAxis hideLine />

              <LineMarkSeries
                data={travelVariabilityData}
                color={theme.palette.primary.main}
                size={MARK_SIZE}
                onNearestX={onNearestXGeneric}
              />
              <LineMarkSeries
                data={travelVariabilityData2}
                color={theme.palette.secondary.main}
                size={MARK_SIZE}
                onNearestX={onNearestXGeneric}
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

              {crosshairValues.length > 0 &&
              false /* need separate state for each crosshair */ && (
                  <Crosshair
                    values={crosshairValues}
                    style={REACT_VIS_CROSSHAIR_NO_LINE}
                  ></Crosshair>
                )}
            </FlexibleWidthXYPlot>
          </Box>

          <Box py={1} hidden={tabValue !== SCORE}>
            <FlexibleWidthXYPlot
              xType="ordinal"
              height={CHART_HEIGHT}
              margin={chartMargins}
              yDomain={[0, maxScore]}
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis tickLabelAngle={-90} tickFormat={primaryDateFormatter} />
              <YAxis hideLine />

              <LineMarkSeries
                data={scoreData}
                color={theme.palette.primary.main}
                size={MARK_SIZE}
                onNearestX={onNearestXGeneric}
              />
              <LineMarkSeries
                data={scoreData2}
                color={theme.palette.secondary.main}
                size={MARK_SIZE}
                onNearestX={onNearestXGeneric}
              />

              <ChartLabel
                text="Score"
                className="alt-y-label"
                includeMargin={false}
                xPercent={0.06}
                yPercent={0.06}
                style={{
                  transform: 'rotate(-90)',
                  textAnchor: 'end',
                }}
              />

              {crosshairValues.length > 0 &&
              false /* need separate state for each crosshair */ && (
                  <Crosshair
                    values={crosshairValues}
                    style={REACT_VIS_CROSSHAIR_NO_LINE}
                  ></Crosshair>
                )}
            </FlexibleWidthXYPlot>
          </Box>
        </div>
      ) : (
        <code>No data.</code>
      )}
    </div>
  );
}

export default InfoByDay;
