import React, { Component } from 'react';
import { css } from 'emotion';
import { BarChart } from 'react-d3-components';
import * as d3 from "d3";

class Info extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  computeGrades(headwayMin, waitTimes, tripTimes, speed) {
  
    //
    // grade and score for average wait
    //
    
    const averageWaitScoreScale = d3.scale.linear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);
    
    const averageWaitGradeScale = d3.scale.threshold()
    .domain([5, 7.5, 10])
    .range(["A", "B", "C", "D"]);
    
    //
    // grade and score for long wait probability
    // 
    // where probability of 20 min wait is sum of histogram buckets #4 and higher divided by count
    //
    
    const TWENTY_INDEX = 4;
    
    let reducer = (accumulator, currentValue, index) =>  { return index >= TWENTY_INDEX ? (accumulator + currentValue.count) : accumulator; }
    
    let longWaitProbability = 0;
    if (headwayMin) {
      longWaitProbability = waitTimes.histogram.reduce(reducer, 0);
      longWaitProbability /= waitTimes.count;
    }
    
    const longWaitScoreScale = d3.scale.linear()
    .domain([0.10, 0.33])
    .rangeRound([100, 0])
    .clamp(true);
    
    const longWaitGradeScale = d3.scale.threshold()
    .domain([0.10, 0.20, 0.33])
    .range(["A", "B", "C", "D"]);

    // grade and score for travel speed
    
    
    const speedScoreScale = d3.scale.linear()
    .domain([5, 10])
    .rangeRound([0, 100])
    .clamp(true);
    
    const speedGradeScale = d3.scale.threshold()
    .domain([5, 7.5, 10])
    .range(["D", "C", "B", "A"]);

        
    //
    // grade score for travel time variability
    //
    // where variance is 90th percentile time minus average time
    //
    
    let travelVarianceTime = 0;
    if (tripTimes) {
        travelVarianceTime = tripTimes.percentiles[18].value - tripTimes.avg;
    }
    
    const travelVarianceScoreScale = d3.scale.linear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);
    
    const travelVarianceGradeScale = d3.scale.threshold()
    .domain([5, 7.5, 10])
    .range(["A", "B", "C", "D"]);
    
    
    const totalGradeScale = d3.scale.threshold()
    .domain([100, 200, 300])
    .range(["D", "C", "B", "A"]);

    let averageWaitScore = 0, averageWaitGrade = "";
    let longWaitScore = 0, longWaitGrade = "";
    let speedScore = 0, speedGrade = "";
    let travelVarianceScore = 0, travelVarianceGrade = "";
    let totalScore = 0, totalGrade = "";
    
    
    if (headwayMin) {    
      averageWaitScore = averageWaitScoreScale(waitTimes.avg); 
      averageWaitGrade = averageWaitGradeScale(waitTimes.avg)

      longWaitScore = longWaitScoreScale(longWaitProbability);
      longWaitGrade = longWaitGradeScale(longWaitProbability);

      speedScore = speedScoreScale(speed);
      speedGrade = speedGradeScale(speed);
                     
      travelVarianceScore = travelVarianceScoreScale(travelVarianceTime);
      travelVarianceGrade = travelVarianceGradeScale(travelVarianceTime);

      totalScore = averageWaitScore + longWaitScore + speedScore + travelVarianceScore;
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
      highestPossibleScore: 400
    }
  
  }
  
  /**
   * This is approximate straight line distance between two lat/lon's,
   * assuming a fixed distance per degree of longitude, and that the
   * distance per degree of latitude varies by cosine of latitude.
   *
   * http://jonisalonen.com/2014/computing-distance-between-coordinates-can-be-simple-and-fast/
   */
  milesBetween(p1, p2) {
  
    const degLength = 69.172; // miles per degree at equator
    const deltaLat = p1.lat - p2.lat;
    const deltaLon = (p1.lon - p2.lon) * Math.cos(p1.lat * 3.1415926 / 180);
    return degLength * Math.sqrt(deltaLat * deltaLat + deltaLon * deltaLon);
  }
  
  computeDistance(graphParams, routes) {

    let miles = 0;
        
    if (graphParams && graphParams.end_stop_id) {
      const directionId = graphParams.direction_id;
      const routeId = graphParams.route_id;
    
      const route = routes.find(route => route.id === routeId);
      const stopSequence = route.directions.find(dir => dir.id === directionId).stops;
      const startIndex = stopSequence.indexOf(graphParams.start_stop_id);
      const endIndex = stopSequence.indexOf(graphParams.end_stop_id);

      for (let i = startIndex; i < endIndex; i++) {
        const fromStopInfo = route.stops[stopSequence[i]];
        const toStopInfo = route.stops[stopSequence[i+1]];
        miles += this.milesBetween(fromStopInfo, toStopInfo);
      }
    }
    
    return miles;
  }
  
  render() {
    const { graphData, graphError, graphParams, routes } = this.props;

    const headwayMin = graphData ? graphData.headway_min : null;
    const waitTimes = graphData ? graphData.wait_times : null;
    const tripTimes = graphData ? graphData.trip_times : null;
  
    const distance = this.computeDistance(graphParams, routes);
    const speed = tripTimes ? Math.round(10*distance / (tripTimes.avg / 60.0))/10 : 0; // convert avg trip time to hours
    const grades = this.computeGrades(headwayMin, waitTimes, tripTimes, speed);

    return (
      <div
        className={css`
         grid-column: col3-start ;
         grid-row: row1-start / row2-end;
        `
        }
      >
        {headwayMin
          ? (<div>
            <span className="h4">Overall Grade: </span><span className="h1">{grades.totalGrade}</span> ( {grades.totalScore} / {grades.highestPossibleScore} )

            <table className="table table-borderless"><tbody>
            <tr><th>Metric</th><th>Value</th><th>Grade</th><th>Score</th></tr>
            <tr>
            <td>Average wait</td><td>{Math.round(waitTimes.avg)} minutes<br/>
            90% of waits under { Math.round(waitTimes.percentiles[18].value) } minutes
            </td><td>{grades.averageWaitGrade}</td><td> {grades.averageWaitScore} </td>
            </tr>
            <tr>
            <td>20 min wait probability</td><td> {Math.round(grades.longWaitProbability * 100)}% { grades.longWaitProbability > 0 ? "(1 time out of " + Math.round(1/grades.longWaitProbability) + ")" : ""} <br/>
            </td><td> { grades.longWaitGrade } </td><td> { grades.longWaitScore } </td>
            </tr>
            <tr>
            <td>Travel time</td>
            <td>Average time {Math.round(tripTimes.avg)} minutes ({ speed } mph)
            </td><td>{grades.speedGrade}</td><td>{grades.speedScore}</td>
            </tr><tr>
            <td>Travel variability</td><td> 
            90% of trips take { Math.round(tripTimes.percentiles[18].value) } minutes
            
            </td><td> {grades.travelVarianceGrade} </td><td> {grades.travelVarianceScore} </td>
            </tr>
            </tbody></table>

            <h4>Headways</h4>
            <p>{headwayMin.count + 1} arrivals, average headway {Math.round(headwayMin.avg)} minutes, max headway {Math.round(headwayMin.max)} minutes</p>
            <BarChart
              data={[{ values: headwayMin.histogram.map(bin => ({ x: `${bin.value}`, y: bin.count })) }]}
              width={Math.max(100, headwayMin.histogram.length * 70)}
              className={`css
                color: 'red'
              `}
              height={200}
              margin={
                  {
                    top: 0,
                    bottom: 50,
                    left: 0,
                    right: 20,
                  }
                }
              xAxis={{label: "minutes"}}
              barPadding={0.3}
              style={{fill: 'red'}}
              yAxis={{innerTickSize: 10, label: "number"}}
            /></div>
          ) : null }
        {waitTimes
          ? (<div>
            <h4>Wait Times</h4>
            <p>average wait time {Math.round(waitTimes.avg)} minutes, max wait time {Math.round(waitTimes.max)} minutes</p>
            <BarChart
              data={[{ values: waitTimes.histogram.map(bin => ({ x: `${bin.value}`, y: bin.count })) }]}
              width={Math.max(100, waitTimes.histogram.length * 70)}
              className={`css
                color: 'red'
              `}
              height={200}
              margin={
                  {
                    top: 0,
                    bottom: 50,
                    left: 0,
                    right: 20,
                  }
                }
              xAxis={{label: "minutes"}}
              barPadding={0.3}
              style={{fill: 'red'}}
              yAxis={{innerTickSize: 10, label: "number"}}
            /></div>
          ) : null }
        {tripTimes
          ? (<div>
            <h4>Trip Times</h4>
            <p>{tripTimes.count} trips, average {Math.round(tripTimes.avg)} minutes, max {Math.round(tripTimes.max)} minutes</p>
            <BarChart
              data={[{ values: tripTimes.histogram.map(bin => ({ x: `${bin.value}`, y: bin.count })) }]}
              width={Math.max(100, tripTimes.histogram.length * 70)}
              height={200}
              margin={
                  {
                    top: 0,
                    bottom: 50,
                    left: 0,
                    right: 20,
                  }
                }
              xAxis={{label: "minutes"}}
              barPadding={0.3}
              style={{fill: 'red'}}
              yAxis={{innerTickSize: 10, label: "number"}}
            /></div>
          ) : null }
        <code>
          {graphError || ''}
        </code>
      </div>
    );
  }
}

export default Info;
