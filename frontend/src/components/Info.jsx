import React, { Component } from 'react';
import * as d3 from 'd3';
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
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@material-ui/core';
import { css } from 'emotion';
import InfoIntervalsOfDay from './InfoIntervalsOfDay';
import { getPercentileValue, getBinMin, getBinMax } from '../helpers/graphData';
import { milesBetween } from '../helpers/routeCalculations';
import {
  PLANNING_PERCENTILE,
  CHART_COLORS,
  REACT_VIS_CROSSHAIR_NO_LINE,
} from '../UIConstants';

class Info extends Component {
  constructor(props) {
    super(props);
    this.state = {
      crosshairValues: {}, // tooltip starts out empty
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

  computeGrades(headwayMin, waitTimes, tripTimes, speed) {
    //
    // grade and score for average wait
    //

    const averageWaitScoreScale = d3
      .scaleLinear()
      .domain([5, 10])
      .rangeRound([100, 0])
      .clamp(true);

    const averageWaitGradeScale = d3
      .scaleThreshold()
      .domain([5, 7.5, 10])
      .range(['A', 'B', 'C', 'D']);

    //
    // grade and score for long wait probability
    //
    // where probability of 20 min wait is:
    //   the sum of counts of bins whose range starts at 20 or more, divided by count
    //

    const reducer = (accumulator, currentValue, index) => {
      const LONG_WAIT = 20; // histogram bins are in minutes
      return currentValue.bin_start >= LONG_WAIT
        ? accumulator + currentValue.count
        : accumulator;
    };

    let longWaitProbability = 0;
    if (waitTimes && waitTimes.histogram) {
      longWaitProbability = waitTimes.histogram.reduce(reducer, 0);
      longWaitProbability /= waitTimes.count;
    }

    const longWaitScoreScale = d3
      .scaleLinear()
      .domain([0.1, 0.33])
      .rangeRound([100, 0])
      .clamp(true);

    const longWaitGradeScale = d3
      .scaleThreshold()
      .domain([0.1, 0.2, 0.33])
      .range(['A', 'B', 'C', 'D']);

    // grade and score for travel speed

    const speedScoreScale = d3
      .scaleLinear()
      .domain([5, 10])
      .rangeRound([0, 100])
      .clamp(true);

    const speedGradeScale = d3
      .scaleThreshold()
      .domain([5, 7.5, 10])
      .range(['D', 'C', 'B', 'A']);

    //
    // grade score for travel time variability
    //
    // where variance is planning percentile time minus average time
    //

    let travelVarianceTime = 0;
    if (tripTimes) {
      travelVarianceTime =
        getPercentileValue(tripTimes, PLANNING_PERCENTILE) - tripTimes.avg;
    }

    const travelVarianceScoreScale = d3
      .scaleLinear()
      .domain([5, 10])
      .rangeRound([100, 0])
      .clamp(true);

    const travelVarianceGradeScale = d3
      .scaleThreshold()
      .domain([5, 7.5, 10])
      .range(['A', 'B', 'C', 'D']);

    const totalGradeScale = d3
      .scaleThreshold()
      .domain([100, 200, 300])
      .range(['D', 'C', 'B', 'A']);

    let averageWaitScore = 0;
    let averageWaitGrade = '';
    let longWaitScore = 0;
    let longWaitGrade = '';
    let speedScore = 0;
    let speedGrade = '';
    let travelVarianceScore = 0;
    let travelVarianceGrade = '';
    let totalScore = 0;
    let totalGrade = '';

    if (headwayMin) {
      averageWaitScore = averageWaitScoreScale(waitTimes.avg);
      averageWaitGrade = averageWaitGradeScale(waitTimes.avg);

      longWaitScore = longWaitScoreScale(longWaitProbability);
      longWaitGrade = longWaitGradeScale(longWaitProbability);

      speedScore = speedScoreScale(speed);
      speedGrade = speedGradeScale(speed);

      travelVarianceScore = travelVarianceScoreScale(travelVarianceTime);
      travelVarianceGrade = travelVarianceGradeScale(travelVarianceTime);

      totalScore =
        averageWaitScore + longWaitScore + speedScore + travelVarianceScore;
      totalGrade = totalGradeScale(totalScore);
    }

    return {
      averageWaitScore,
      averageWaitGrade,
      longWaitProbability,
      longWaitScore,
      longWaitGrade,
      speedScore,
      speedGrade,
      travelVarianceTime,
      travelVarianceScore,
      travelVarianceGrade,
      totalScore,
      totalGrade,
      highestPossibleScore: 400,
    };
  }

  computeDistance(graphParams, routes) {
    let miles = 0;

    if (graphParams && graphParams.end_stop_id) {
      const directionId = graphParams.direction_id;
      const routeId = graphParams.route_id;

      const route = routes.find(thisRoute => thisRoute.id === routeId);
      const stopSequence = route.directions.find(dir => dir.id === directionId)
        .stops;
      const startIndex = stopSequence.indexOf(graphParams.start_stop_id);
      const endIndex = stopSequence.indexOf(graphParams.end_stop_id);

      for (let i = startIndex; i < endIndex; i++) {
        const fromStopInfo = route.stops[stopSequence[i]];
        const toStopInfo = route.stops[stopSequence[i + 1]];
        miles += milesBetween(fromStopInfo, toStopInfo);
      }
    }

    return miles;
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

    const headwayMin = graphData ? graphData.headway_min : null;
    const waitTimes = graphData ? graphData.wait_times : null;
    const tripTimes = graphData ? graphData.trip_times : null;

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

    const distance = routes ? this.computeDistance(graphParams, routes) : null;
    const speed =
      tripTimes && distance
        ? (distance / (tripTimes.avg / 60.0)).toFixed(1)
        : 0; // convert avg trip time to hours for mph
    const grades = speed
      ? this.computeGrades(headwayMin, waitTimes, tripTimes, speed)
      : null;

    const tableRows = (!grades && []) || [
      {
        metric: 'Average Wait',
        value: `${Math.round(waitTimes.avg)} minutes`,
        grade: grades.averageWaitGrade,
        score: grades.averageWaitScore,
      },
      {
        metric: '20 min wait probability',
        value: `${Math.round(grades.longWaitProbability * 100)}% ${
          grades.longWaitProbability > 0
            ? `(1 time out of ${Math.round(1 / grades.longWaitProbability)})`
            : ''
        }`,
        grade: grades.longWaitGrade,
        score: grades.longWaitScore,
      },
      {
        metric: 'Travel Time',
        value: `Average time ${Math.round(
          tripTimes.avg,
        )} minutes (${speed} mph)`,
        grade: grades.speedGrade,
        score: grades.speedScore,
      },
      {
        metric: 'Travel Variability',
        value: `${PLANNING_PERCENTILE}% of trips take ${Math.round(
          getPercentileValue(tripTimes, PLANNING_PERCENTILE),
        )} minutes`,
        grade: grades.travelVarianceGrade,
        score: grades.travelVarianceScore,
      },
    ];

    return (
      <div
        className={css`
          grid-column: col3-start;
          grid-row: row1-start / row2-end;
          padding: 4px;
        `}
      >
        {headwayMin && grades ? (
          <div>
            <Card>
              <CardContent>
                <span className="h4">Overall Grade: </span>
                <span className="h1">{grades.totalGrade}</span> ({' '}
                {grades.totalScore} / {grades.highestPossibleScore} )
                <div>
                  {`${PLANNING_PERCENTILE}% of waits under ${Math.round(
                    getPercentileValue(waitTimes, PLANNING_PERCENTILE),
                  )} minutes`}
                </div>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell align="right">Metric</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell align="right">Grade</TableCell>
                      <TableCell align="right">Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map(row => (
                      <TableRow key="{row.metric}">
                        <TableCell component="th" scope="row">
                          {row.metric}
                        </TableCell>
                        <TableCell align="right">{row.value}</TableCell>
                        <TableCell align="right">{row.grade}</TableCell>
                        <TableCell align="right">{row.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <br />
            <InfoIntervalsOfDay
              intervalData={intervalData}
              intervalError={intervalError}
            />
            <br />
            <Card>
              <CardContent>
                <h4>Headways</h4>
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
              </CardContent>
            </Card>
          </div>
        ) : null}
        {waitTimes ? (
          <div>
            <br />
            <Card>
              <CardContent>
                <h4>Wait Times</h4>
                <p>
                  average wait time {Math.round(waitTimes.avg)} minutes, max
                  wait time
                  {Math.round(waitTimes.max)} minutes
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
                        Chance:{' '}
                        {Math.round(this.state.crosshairValues.wait[0].y)}%
                      </div>
                    </Crosshair>
                  )}
                </XYPlot>
              </CardContent>
            </Card>
          </div>
        ) : null}
        {tripTimes ? (
          <div>
            <br />
            <Card>
              <CardContent>
                <h4>Trip Times</h4>
                <p>
                  {tripTimes.count} trips, average
                  {Math.round(tripTimes.avg)} minutes, max{' '}
                  {Math.round(tripTimes.max)} minutes
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
                        Trips:{' '}
                        {Math.round(this.state.crosshairValues.trip[0].y)}
                      </div>
                    </Crosshair>
                  )}
                </XYPlot>
              </CardContent>
            </Card>
          </div>
        ) : null}
        <code>{graphError || ''}</code>
      </div>
    );
  }
}

export default Info;
