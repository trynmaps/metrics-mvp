import React from 'react';
import {
  XYPlot,
  HorizontalGridLines,
  XAxis,
  YAxis,
  VerticalRectSeries,
  ChartLabel,
  Crosshair,
} from 'react-vis';
import { AppBar, Box, Tab, Tabs, Typography } from '@material-ui/core';
import InfoByDay from './InfoByDay';
import InfoIntervalsOfDay from './InfoIntervalsOfDay';
import InfoTripSummary from './InfoTripSummary';
import { CHART_COLORS, REACT_VIS_CROSSHAIR_NO_LINE } from '../UIConstants';

function Info(props) {
  const [crosshairValues, setCrosshairValues] = React.useState({});
  const [tabValue, setTabValue] = React.useState(0);

  const {
    graphData,
    graphError,
    graphParams,
    intervalData,
    intervalError,
    byDayData,
    routes,
  } = props;

  const headways = graphData ? graphData.headways : null;
  const waitTimes = graphData ? graphData.waitTimes : null;
  const tripTimes = graphData ? graphData.tripTimes : null;

  const headwayData =
    headways && headways.histogram
      ? headways.histogram.map(bin => ({
          x0: bin.binStart,
          x: bin.binEnd,
          y: bin.count,
        }))
      : null;

  const waitData =
    waitTimes && waitTimes.histogram
      ? waitTimes.histogram.map(bin => ({
          x0: bin.binStart,
          x: bin.binEnd,
          y: bin.count,
        }))
      : null;

  const tripData =
    tripTimes && tripTimes.histogram
      ? tripTimes.histogram.map(bin => ({
          x0: bin.binStart,
          x: bin.binEnd,
          y: bin.count,
        }))
      : null;

  /**
   * Event handler for onMouseLeave.
   * @private
   */
  function onMouseLeave() {
    setCrosshairValues({});
  }

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  function onNearestXHeadway(value, { index }) {
    setCrosshairValues({ headway: [headwayData[index]] });
  }

  function onNearestXWaitTimes(value, { index }) {
    setCrosshairValues({ wait: [waitData[index]] });
  }

  function onNearestXTripTimes(value, { index }) {
    setCrosshairValues({ trip: [tripData[index]] });
  }

  function handleTabChange(event, newValue) {
    setTabValue(newValue);
  }

  function a11yProps(index) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }

  const SUMMARY = 0;
  const BY_DAY = 1;
  const TIME_OF_DAY = 2;
  const HEADWAYS = 3;
  const WAITS = 4;
  const TRIPS = 5;

  return (
    <div>
      <br />
      <AppBar position="static" color="default">
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="tab bar"
          variant="scrollable"
          scrollButtons="on"
        >
          <Tab
            style={{ minWidth: 72 }}
            label="Summary"
            {...a11yProps(SUMMARY)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="By Day"
            {...a11yProps(BY_DAY)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="By Time of Day"
            {...a11yProps(TIME_OF_DAY)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Headways"
            {...a11yProps(HEADWAYS)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Wait Times"
            {...a11yProps(WAITS)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Trip Times"
            {...a11yProps(TRIPS)}
          />
        </Tabs>
      </AppBar>

      {headways && routes ? (
        <div>
          <Box p={2} hidden={tabValue !== SUMMARY}>
            <InfoTripSummary
              graphData={graphData}
              graphParams={graphParams}
              routes={routes}
            />
          </Box>

          <Box p={2} hidden={tabValue !== BY_DAY}>
            <Typography variant="h5" display="inline">
              Performance by Day
            </Typography>

            <InfoByDay
              byDayData={byDayData}
              graphParams={graphParams}
              routes={routes}
            />
          </Box>
          
          <Box p={2} hidden={tabValue !== TIME_OF_DAY}>
            <Typography variant="h5" display="inline">
              Performance by Time of Day
            </Typography>

            <InfoIntervalsOfDay
              intervalData={intervalData}
              intervalError={intervalError}
            />
          </Box>

          <Box p={2} hidden={tabValue !== HEADWAYS}>
            <Typography variant="h5" display="inline">
              Headways (Time Between Vehicles)
            </Typography>
            <p>
              {headways.count + 1} arrivals, median headway{' '}
              {Math.round(headways.median)} minutes, max headway{' '}
              {Math.round(headways.max)} minutes
            </p>
            <XYPlot
              xDomain={[0, Math.max(60, Math.round(headways.max) + 5)]}
              height={200}
              width={400}
              onMouseLeave={onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis />
              <YAxis hideLine />

              <VerticalRectSeries
                data={headwayData}
                onNearestX={onNearestXHeadway}
                stroke="white"
                fill={CHART_COLORS[0]}
                style={{ strokeWidth: 2 }}
              />

              <ChartLabel
                text="arrivals"
                className="alt-y-label"
                includeMargin={false}
                xPercent={0.06}
                yPercent={0.06}
                style={{
                  transform: 'rotate(-90)',
                  textAnchor: 'end',
                }}
              />

              <ChartLabel
                text="minutes"
                className="alt-x-label"
                includeMargin={false}
                xPercent={0.9}
                yPercent={0.94}
              />

              {crosshairValues.headway && (
                <Crosshair
                  values={crosshairValues.headway}
                  style={REACT_VIS_CROSSHAIR_NO_LINE}
                >
                  <div className="rv-crosshair__inner__content">
                    Arrivals: {Math.round(crosshairValues.headway[0].y)}
                  </div>
                </Crosshair>
              )}
            </XYPlot>
          </Box>
        </div>
      ) : null}

      {waitTimes ? (
        <Box p={2} hidden={tabValue !== WAITS}>
          <Typography variant="h5" display="inline">
            Wait Times
          </Typography>
          <p>
            median wait time {Math.round(waitTimes.median)} minutes, max wait time{' '}
            {Math.round(waitTimes.max)} minutes
          </p>
          <XYPlot
            xDomain={[0, Math.max(60, Math.round(waitTimes.max) + 5)]}
            height={200}
            width={400}
            onMouseLeave={onMouseLeave}
          >
            <HorizontalGridLines />
            <XAxis />
            <YAxis hideLine tickFormat={v => `${v}%`} />

            <VerticalRectSeries
              data={waitData}
              onNearestX={onNearestXWaitTimes}
              stroke="white"
              fill={CHART_COLORS[0]}
              style={{ strokeWidth: 2 }}
            />

            <ChartLabel
              text="chance"
              className="alt-y-label"
              includeMargin={false}
              xPercent={0.06}
              yPercent={0.06}
              style={{
                transform: 'rotate(-90)',
                textAnchor: 'end',
              }}
            />

            <ChartLabel
              text="minutes"
              className="alt-x-label"
              includeMargin={false}
              xPercent={0.9}
              yPercent={0.94}
            />

            {crosshairValues.wait && (
              <Crosshair
                values={crosshairValues.wait}
                style={REACT_VIS_CROSSHAIR_NO_LINE}
              >
                <div className="rv-crosshair__inner__content">
                  Chance: {Math.round(crosshairValues.wait[0].y)}%
                </div>
              </Crosshair>
            )}
          </XYPlot>
        </Box>
      ) : null}
      {tripTimes ? (
        <Box p={2} hidden={tabValue !== TRIPS}>
          <Typography variant="h5" display="inline">
            Trip Times
          </Typography>
          <p>
            {tripTimes.count} trips, median {Math.round(tripTimes.median)}{' '}
            minutes, max {Math.round(tripTimes.max)} minutes
          </p>
          <XYPlot
            xDomain={[0, Math.max(60, Math.round(tripTimes.max) + 5)]}
            height={200}
            width={400}
            onMouseLeave={onMouseLeave}
          >
            <HorizontalGridLines />
            <XAxis />
            <YAxis hideLine />

            <VerticalRectSeries
              data={tripData}
              onNearestX={onNearestXTripTimes}
              stroke="white"
              fill={CHART_COLORS[1]}
              style={{ strokeWidth: 2 }}
            />

            <ChartLabel
              text="trips"
              className="alt-y-label"
              includeMargin={false}
              xPercent={0.06}
              yPercent={0.06}
              style={{
                transform: 'rotate(-90)',
                textAnchor: 'end',
              }}
            />

            <ChartLabel
              text="minutes"
              className="alt-x-label"
              includeMargin={false}
              xPercent={0.9}
              yPercent={0.94}
            />

            {crosshairValues.trip && (
              <Crosshair
                values={crosshairValues.trip}
                style={REACT_VIS_CROSSHAIR_NO_LINE}
              >
                <div className="rv-crosshair__inner__content">
                  Trips: {Math.round(crosshairValues.trip[0].y)}
                </div>
              </Crosshair>
            )}
          </XYPlot>
        </Box>
      ) : null}

      {graphError ? (
        <Box p={2}>
          <code>{graphError}</code>
        </Box>
      ) : null}
    </div>
  );
}

export default Info;
