import React, { Component } from 'react';
import { css } from 'emotion';
import Card from 'react-bootstrap/Card';
import InfoIntervalsOfDay from './InfoIntervalsOfDay';
import { getPercentileValue, getBinMin, getBinMax } from '../helpers/graphData';
import { milesBetween } from '../helpers/routeCalculations';
import {
  PLANNING_PERCENTILE,
  CHART_COLORS,
  REACT_VIS_CROSSHAIR_NO_LINE,
} from '../UIConstants';
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

class Info extends Component {
  constructor(props) {
    super(props);
    this.state = {
      crosshairValues: {}, // tooltip starts out empty
    };
  }

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

      const route = routes.find(route => route.id === routeId);
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

  /**
   * Event handler for onMouseLeave.
   * @private
   */
  _onMouseLeave = () => {
    this.setState({ crosshairValues: {} });
  };

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  _onNearestXHeadway = (value, { index }) => {
    this.setState({ crosshairValues: { headway: [this.headwayData[index]] } });
  };

  _onNearestXWaitTimes = (value, { index }) => {
    this.setState({ crosshairValues: { wait: [this.waitData[index]] } });
  };

  _onNearestXTripTimes = (value, { index }) => {
    this.setState({ crosshairValues: { trip: [this.tripData[index]] } });
  };

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
              waitTimes.histogram.reduce((acc, bin) => acc + bin.count, 0),
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

    const distance = this.computeDistance(graphParams, routes);
    const speed = tripTimes
      ? (distance / (tripTimes.avg / 60.0)).toFixed(1)
      : 0; // convert avg trip time to hours for mph
    const grades = this.computeGrades(headwayMin, waitTimes, tripTimes, speed);
    const percentileValues = Math.round(
      getPercentileValue(waitTimes, PLANNING_PERCENTILE),
    );
    const travelVariability = Math.round(
      getPercentileValue(waitTimes, PLANNING_PERCENTILE),
    );
    return (
      <div
        className={css`
          grid-column: col3-start;
          grid-row: row1-start / row2-end;
        `}
      >
        {headwayMin ? (
          <div>
            <Card>
              <Card.Body>
                <span className="h4">This Trip's Grade: </span>
                <span className="h1">{grades.totalGrade}</span>
                <span>
                  {grades.totalScore
                    ? ` ( ${grades.totalScore} / ${grades.highestPossibleScore} ) `
                    : 'Not enough information to grade this trip'}
                </span>

                <table className="table table-borderless">
                  <tbody>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Grade</th>
                      <th>Score</th>
                    </tr>
                    <tr>
                      <td>Average wait</td>
                      <td>
                        {!!waitTimes.avg
                          ? ` ${Math.round(waitTimes.avg)} minutes `
                          : 'No departures'}
                        <br />
                        {!!percentileValues 
                          ? `${PLANNING_PERCENTILE} % of waits under ${percentileValues} minutes`
                          : ''
                        }
                      </td>
                      <td>{grades.averageWaitGrade}</td>
                      <td> {grades.averageWaitScore} </td>
                    </tr>
                    <tr>
                      <td>20 min wait probability</td>
                      <td>
                        {` ${Math.round(grades.longWaitProbability * 100)}% `}
                        {grades.longWaitProbability > 0
                          ? `(1 time out of ${Math.round(
                              1 / grades.longWaitProbability,
                            )})`
                          : ''}{' '}
                        <br />
                      </td>
                      <td> {grades.longWaitGrade} </td>
                      <td> {grades.longWaitScore} </td>
                    </tr>
                    <tr>
                      <td>Travel time</td>
                      <td>
                        {!!tripTimes.avg 
                          ? `Average time ${Math.round(tripTimes.avg)} minutes (${speed} mph)`
                          : 'N/A'
                        }
                      </td>
                      <td>{grades.speedGrade}</td>
                      <td>{grades.speedScore}</td>
                    </tr>
                    <tr>
                      <td>Travel variability</td>
                      <td>
                        {!!travelVariability 
                          ? `${PLANNING_PERCENTILE}% of trips take ${travelVariability} minutes`
                          : 'N/A'
                        }
                      </td>
                      <td> {grades.travelVarianceGrade} </td>
                      <td> {grades.travelVarianceScore} </td>
                    </tr>
                  </tbody>
                </table>
              </Card.Body>
            </Card>

            <InfoIntervalsOfDay
              intervalData={intervalData}
              intervalError={intervalError}
            />

            <p />

            <h4>Headways</h4>
            <p>
              {headwayMin.avg 
                ? `${headwayMin.count + 1} arrivals, average headway ${Math.round(headwayMin.avg)} minutes, max headway ${Math.round(headwayMin.max)} minutes`
                : `${headwayMin.count + 1} arrivals, no headway data available`
              }
            </p>
            <XYPlot
              xDomain={[0, Math.max(60, Math.round(headwayMin.max) + 5)]}
              height={200}
              width={400}
              onMouseLeave={this._onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis />
              <YAxis hideLine />

              <VerticalRectSeries
                data={this.headwayData}
                onNearestX={this._onNearestXHeadway}
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
          </div>
        ) : null}
        {waitTimes ? (
          <div>
            <h4>Wait Times</h4>
            <p>
              {!!waitTimes.avg
                ? `average wait time ${Math.round(waitTimes.avg)} minutes, 
                  max wait time ${Math.round(waitTimes.max)} minutes`
                : 'N/A'
                }
            </p>
            <XYPlot
              xDomain={[0, Math.max(60, Math.round(waitTimes.max) + 5)]}
              height={200}
              width={400}
              onMouseLeave={this._onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis />
              <YAxis hideLine tickFormat={v => `${v}%`} />

              <VerticalRectSeries
                data={this.waitData}
                onNearestX={this._onNearestXWaitTimes}
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
          </div>
        ) : null}
        {tripTimes ? (
          <div>
            <h4>Trip Times</h4>
            <p>
              {tripTimes.count 
                  ? `${tripTimes.count} trips, average ${Math.round(tripTimes.avg)} minutes, max ${Math.round(tripTimes.max)} minutes`
                  : `${tripTimes.count} trips`
                }
            </p>
            <XYPlot
              xDomain={[0, Math.max(60, Math.round(tripTimes.max) + 5)]}
              height={200}
              width={400}
              onMouseLeave={this._onMouseLeave}
            >
              <HorizontalGridLines />
              <XAxis />
              <YAxis hideLine />

              <VerticalRectSeries
                data={this.tripData}
                onNearestX={this._onNearestXTripTimes}
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
          </div>
        ) : null}
        <code>{graphError || ''}</code>
      </div>
    );
  }
}

export default Info;
