import React, { Component } from 'react';
import { css } from 'emotion';
import { BarChart } from 'react-d3-components';
import * as d3 from "d3";

class Info extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  render() {
    const { graphData, graphError } = this.props;

    const headwayMin = graphData ? graphData.headway_min : null;
    const waitTimes = graphData ? graphData.wait_times : null;
    const tripTimes = graphData ? graphData.trip_times : null;
    
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
    // where probability of 20 min wait is sum of buckets #4 and higher divided by count
    //
    
    let reducer = (accumulator, currentValue, index) =>  { return index >= 4 ? (accumulator + currentValue.count) : accumulator; }
    
    let longWaitProbability = 0;
    if (headwayMin) {
        longWaitProbability = waitTimes.histogram.reduce(reducer, 0);
        console.log(longWaitProbability + "/" + waitTimes.count);
        longWaitProbability /= waitTimes.count;
        
    }
    
    const longWaitScoreScale = d3.scale.linear()
    .domain([0.10, 0.33])
    .rangeRound([100, 0])
    .clamp(true);
    
    const longWaitGradeScale = d3.scale.threshold()
    .domain([0.10, 0.20, 0.33])
    .range(["A", "B", "C", "D"]);
    
    //
    // grade score for travel time variability
    //
    // where variance is 90th percentile time minus average time
    //
    
    let travelVarianceTime = 0;
    if (tripTimes) {
        travelVarianceTime = tripTimes.percentiles[18].value - tripTimes.avg;
    }
    
    const varianceTimeScoreScale = d3.scale.linear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);
    
    const varianceTimeGradeScale = d3.scale.threshold()
    .domain([5, 7.5, 10])
    .range(["A", "B", "C", "D"]);
    
    
    const totalGradeScale = d3.scale.threshold()
    .domain([75, 150, 225])
    .range(["D", "C", "B", "A"]);

    let averageWaitScore = 0, longWaitScore = 0, varianceTimeScore = 0, totalScore = 0, totalGrade = "";
    
    if (headwayMin) {    
        averageWaitScore = averageWaitScoreScale(waitTimes.avg);    
        longWaitScore = longWaitScoreScale(longWaitProbability);
        varianceTimeScore = varianceTimeScoreScale(travelVarianceTime);
    
        totalScore = averageWaitScore + longWaitScore + varianceTimeScore;
        totalGrade = totalGradeScale(totalScore);
    } 

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
            Overall Grade: <span class="h1">{ totalGrade }</span> ( {totalScore} / 300 )

            <table class="table table-borderless">
            <tr><th>Metric</th><th>Value</th><th>Grade</th><th>Score</th></tr>
            <tr>
            <td>Average wait</td><td>{Math.round(waitTimes.avg)} minutes<br/>
            90% of waits under { Math.round(waitTimes.percentiles[18].value) } minutes
            </td><td>{ averageWaitGradeScale(waitTimes.avg) }</td><td> { averageWaitScoreScale(waitTimes.avg)}</td>
            </tr>
            <tr>
            <td>20 min wait probability</td><td> {Math.round(longWaitProbability * 100)}% { longWaitProbability > 0 ? "(1 time out of " + Math.round(1/longWaitProbability) + ")" : ""} <br/>
            </td><td> { longWaitGradeScale(longWaitProbability) } </td><td> { longWaitScore } </td>
            </tr>
            { tripTimes ? (<tr>
            <td>Travel variability</td><td> 
            Average time {Math.round(tripTimes.avg)} minutes <br/>
            90% of trips take { Math.round(tripTimes.percentiles[18].value) } minutes
            
            </td><td> { varianceTimeGradeScale(travelVarianceTime) } </td><td> { varianceTimeScore } </td>
            </tr>) : null }
            </table>

            <h4>Headways</h4>
            <p>{headwayMin.count + 1} arrivals, average headway {Math.round(headwayMin.avg)} minutes, max headway {Math.round(headwayMin.max)} minutes</p>
            <BarChart
              data={[{ values: headwayMin.histogram.map(bin => ({ x: `${bin.value}`, y: bin.count })) }]}
              width={Math.max(150, headwayMin.histogram.length * 70 + 50)}
              className={`css
                color: 'red'
              `}
              height={200}
              margin={
                  {
                    top: 0,
                    bottom: 50,
                    left: 50,
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
              width={Math.max(150, waitTimes.histogram.length * 70 + 50)}
              className={`css
                color: 'red'
              `}
              height={200}
              margin={
                  {
                    top: 0,
                    bottom: 50,
                    left: 50,
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
              width={Math.max(150, tripTimes.histogram.length * 70 + 50)}
              height={200}
              margin={
                  {
                    top: 0,
                    bottom: 50,
                    left: 50,
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
