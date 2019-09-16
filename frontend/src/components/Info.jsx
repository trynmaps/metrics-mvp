import React, { Component } from 'react';
import {
  XYPlot,
  HorizontalGridLines,
  XAxis,
  YAxis,
  VerticalRectSeries,
  ChartLabel,
  Crosshair,
} from 'react-vis';
import {
  AppBar,
  Box,
  Tab,
  Tabs,
  Typography,
} from '@material-ui/core';
import InfoIntervalsOfDay from './InfoIntervalsOfDay';
import InfoTripSummary from './InfoTripSummary';
import { getBinMin, getBinMax } from '../helpers/graphData';
import {
  CHART_COLORS,
  REACT_VIS_CROSSHAIR_NO_LINE,
} from '../UIConstants';

class Info extends Component {
  constructor(props) {
    super(props);
    this.state = {
      crosshairValues: {}, // tooltip starts out empty
      tabValue: 0,
    };
  }

  /**
   * Event handler for onMouseLeave.
   * @private
   */
  onMouseLeave = () => {
    this.setState({ crosshairValues: {} });
  };

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  onNearestXHeadway = (value, { index }) => {
    this.setState({ crosshairValues: { headway: [this.headwayData[index]] } });
  };

  onNearestXWaitTimes = (value, { index }) => {
    this.setState({ crosshairValues: { wait: [this.waitData[index]] } });
  };

  onNearestXTripTimes = (value, { index }) => {
    this.setState({ crosshairValues: { trip: [this.tripData[index]] } });
  };

  handleTabChange(event, newValue) {
    this.setState({ tabValue: newValue });
  }

  render() {
    const {
      graphData,
      graphError,
      graphParams,
      intervalData,
      intervalError,
      routes,
    } = this.props;

    const headwayMin = graphData ? graphData.headwayMin : null;
    const waitTimes = graphData ? graphData.waitTimes : null;
    const tripTimes = graphData ? graphData.tripTimes : null;

    this.headwayData =
      headwayMin && headwayMin.histogram
        ? headwayMin.histogram.map(bin => ({
            x0: getBinMin(bin),
            x: getBinMax(bin),
            y: bin.count,
          }))
        : null;
    this.waitData =
      waitTimes && waitTimes.histogram
        ? waitTimes.histogram.map(bin => ({
            x0: getBinMin(bin),
            x: getBinMax(bin),
            y:
              (100 * bin.count) /
              waitTimes.histogram.reduce(
                (acc, thisBin) => acc + thisBin.count,
                0,
              ),
          }))
        : null;
    this.tripData =
      tripTimes && tripTimes.histogram
        ? tripTimes.histogram.map(bin => ({
            x0: getBinMin(bin),
            x: getBinMax(bin),
            y: bin.count,
          }))
        : null;



    function a11yProps(index) {
      return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
      };
    }

    const SUMMARY = 0;
    const TIME_OF_DAY = 1;
    const HEADWAYS = 2;
    const WAITS = 3;
    const TRIPS = 4;

    return (
      <div>
        <br />
        <AppBar position="static" color="default">
          <Tabs
            value={this.state.tabValue}
            onChange={this.handleTabChange.bind(this)}
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
              label="Time of Day"
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

        
        {headwayMin && routes ? (
          <div>
            <Box p={2} hidden={this.state.tabValue !== SUMMARY} >
            
              <InfoTripSummary
                graphData={graphData}
                graphParams={graphParams}
                routes={routes}
              />

            </Box>

            <Box p={2} hidden={this.state.tabValue !== TIME_OF_DAY}>
              <Typography variant="h5" display="inline">
                Performance by Time of Day
              </Typography>

              <InfoIntervalsOfDay
                intervalData={intervalData}
                intervalError={intervalError}
              />
            </Box>

            <Box p={2} hidden={this.state.tabValue !== HEADWAYS}>
              <Typography variant="h5" display="inline">
                Headways (Time Between Vehicles)
              </Typography>
              <p>
                {headwayMin.count + 1} arrivals, average headway{' '}
                {Math.round(headwayMin.avg)} minutes, max headway{' '}
                {Math.round(headwayMin.max)} minutes
              </p>
              <XYPlot
                xDomain={[0, Math.max(60, Math.round(headwayMin.max) + 5)]}
                height={200}
                width={400}
                onMouseLeave={this.onMouseLeave}
              >
                <HorizontalGridLines />
                <XAxis />
                <YAxis hideLine />

                <VerticalRectSeries
                  data={this.headwayData}
                  onNearestX={this.onNearestXHeadway}
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

                {this.state.crosshairValues.headway && (
                  <Crosshair
                    values={this.state.crosshairValues.headway}
                    style={REACT_VIS_CROSSHAIR_NO_LINE}
                  >
                    <div className="rv-crosshair__inner__content">
                      Arrivals:{' '}
                      {Math.round(this.state.crosshairValues.headway[0].y)}
                    </div>
                  </Crosshair>
                )}
              </XYPlot>
            </Box>
          </div>
        ) : null}

        {waitTimes ? (
          <Box p={2} hidden={this.state.tabValue !== WAITS}>
            <Typography variant="h5" display="inline">
              Wait Times
            </Typography>
            <p>
              average wait time {Math.round(waitTimes.avg)} minutes, max wait
              time {Math.round(waitTimes.max)} minutes
            </p>
            <XYPlot
              xDomain={[0, Math.max(60, Math.round(waitTimes.max) + 5)]}
              height={200}
              width={400}
              onMouseLeave={this.onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis />
              <YAxis hideLine tickFormat={v => `${v}%`} />

              <VerticalRectSeries
                data={this.waitData}
                onNearestX={this.onNearestXWaitTimes}
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

              {this.state.crosshairValues.wait && (
                <Crosshair
                  values={this.state.crosshairValues.wait}
                  style={REACT_VIS_CROSSHAIR_NO_LINE}
                >
                  <div className="rv-crosshair__inner__content">
                    Chance: {Math.round(this.state.crosshairValues.wait[0].y)}%
                  </div>
                </Crosshair>
              )}
            </XYPlot>
          </Box>
        ) : null}
        {tripTimes ? (
          <Box p={2} hidden={this.state.tabValue !== TRIPS}>
            <Typography variant="h5" display="inline">
              Trip Times
            </Typography>
            <p>
              {tripTimes.count} trips, average {Math.round(tripTimes.avg)}{' '}
              minutes, max {Math.round(tripTimes.max)} minutes
            </p>
            <XYPlot
              xDomain={[0, Math.max(60, Math.round(tripTimes.max) + 5)]}
              height={200}
              width={400}
              onMouseLeave={this.onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis />
              <YAxis hideLine />

              <VerticalRectSeries
                data={this.tripData}
                onNearestX={this.onNearestXTripTimes}
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

              {this.state.crosshairValues.trip && (
                <Crosshair
                  values={this.state.crosshairValues.trip}
                  style={REACT_VIS_CROSSHAIR_NO_LINE}
                >
                  <div className="rv-crosshair__inner__content">
                    Trips: {Math.round(this.state.crosshairValues.trip[0].y)}
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
}

export default Info;
