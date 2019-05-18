import React, { Component } from 'react';
import { css } from 'emotion';
import { BarChart } from 'react-d3-components';
import Card from 'react-bootstrap/Card';
import * as d3 from "d3";

class Info extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }


  /**
   * Helper method to get a specific percentile out of histogram graph data
   * where percentile is 0-100.
   */
  getPercentileValue(histogram, percentile) {
    const bin = histogram.percentiles.find(x => x.percentile === percentile);
    if (bin) {
      return bin.value;
    } else {
      return 0;
    }
  }
  
  computeGrades(headwayMin, waitTimes, tripTimes, speed) {
  
    //
    // grade and score for average wait
    //
    
    const averageWaitScoreScale = d3.scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);
    
    const averageWaitGradeScale = d3.scaleThreshold()
    .domain([5, 7.5, 10])
    .range(["A", "B", "C", "D"]);
    
    //
    // grade and score for long wait probability
    // 
    // where probability of 20 min wait is:
    //   the sum of counts of bins whose range starts at 20 or more, divided by count
    //

    let reducer = (accumulator, currentValue, index) =>  {
      const LONG_WAIT = 20; // histogram bins are in minutes
      return currentValue.bin_start >= LONG_WAIT ? (accumulator + currentValue.count) : accumulator;
    }
    
    let longWaitProbability = 0;
    if (headwayMin) {
      longWaitProbability = waitTimes.histogram.reduce(reducer, 0);
      longWaitProbability /= waitTimes.count;
    }
    
    const longWaitScoreScale = d3.scaleLinear()
    .domain([0.10, 0.33])
    .rangeRound([100, 0])
    .clamp(true);
    
    const longWaitGradeScale = d3.scaleThreshold()
    .domain([0.10, 0.20, 0.33])
    .range(["A", "B", "C", "D"]);

    // grade and score for travel speed
    
    const speedScoreScale = d3.scaleLinear()
    .domain([5, 10])
    .rangeRound([0, 100])
    .clamp(true);
    
    const speedGradeScale = d3.scaleThreshold()
    .domain([5, 7.5, 10])
    .range(["D", "C", "B", "A"]);
        
    //
    // grade score for travel time variability
    //
    // where variance is 90th percentile time minus average time
    //
    
    let travelVarianceTime = 0;
    if (tripTimes) {
        travelVarianceTime = this.getPercentileValue(tripTimes, 90) - tripTimes.avg;
    }
    
    const travelVarianceScoreScale = d3.scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);
    
    const travelVarianceGradeScale = d3.scaleThreshold()
    .domain([5, 7.5, 10])
    .range(["A", "B", "C", "D"]);
    
    
    const totalGradeScale = d3.scaleThreshold()
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
   * Returns the distance between two stops in miles. 
   */
  milesBetween(p1, p2) {
    const meters = this.haverDistance(p1.lat, p1.lon, p2.lat, p2.lon);
    return meters / 1609.344; 
  }
  
  /**
   * Haversine formula for calcuating distance between two coordinates in lat lon
   * from bird eye view; seems to be +- 8 meters difference from geopy distance.
   *
   * From eclipses.py.  Returns distance in meters.
   */
  haverDistance(latstop,lonstop,latbus,lonbus) {

    const deg2rad = x => x * Math.PI / 180;
     
    [latstop,lonstop,latbus,lonbus] = [latstop,lonstop,latbus,lonbus].map(deg2rad);
    const eradius = 6371000;

    const latdiff = (latbus-latstop);
    const londiff = (lonbus-lonstop);

    const a = Math.sin(latdiff/2)**2 + Math.cos(latstop) * Math.cos(latbus) * Math.sin(londiff/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = eradius * c;
    return distance;
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
    const speed = tripTimes ? (distance / (tripTimes.avg / 60.0)).toFixed(1) : 0; // convert avg trip time to hours for mph
    const grades = this.computeGrades(headwayMin, waitTimes, tripTimes, speed);

    return (
      <div
        className={css`
         grid-column: col3-start ;
         grid-row: row1-start / row2-end;
        `
        }
      >
        {headwayMin && tripTimes
          ? (<div>
            <Card><Card.Body>
            <span className="h4">Overall Grade: </span><span className="h1">{grades.totalGrade}</span> ( {grades.totalScore} / {grades.highestPossibleScore} )

            <table className="table table-borderless"><tbody>
            <tr><th>Metric</th><th>Value</th><th>Grade</th><th>Score</th></tr>
            <tr>
            <td>Average wait</td><td>{Math.round(waitTimes.avg)} minutes<br/>
            90% of waits under { Math.round(this.getPercentileValue(waitTimes, 90)) } minutes
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
            90% of trips take { Math.round(this.getPercentileValue(tripTimes, 90)) } minutes
            
            </td><td> {grades.travelVarianceGrade} </td><td> {grades.travelVarianceScore} </td>
            </tr>
            </tbody></table>
            </Card.Body></Card>
            
            <p/>

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
                    top: 10,
                    bottom: 30,
                    left: 50,
                    right: 10,
                  }
                }
              xAxis={{label: "minutes"}}
              barPadding={0.3}
              style={{fill: 'red'}}
              yAxis={{innerTickSize: 10, label: "arrivals", tickArguments: [5]}}
            /></div>
          ) : null }
        {waitTimes
          ? (<div>
            <h4>Wait Times</h4>
            <p>average wait time {Math.round(waitTimes.avg)} minutes, max wait time {Math.round(waitTimes.max)} minutes</p>
            <BarChart
              data={[{ values: waitTimes.histogram.map(bin => ({ x: `${bin.value}`, y: (bin.count / (waitTimes.histogram.reduce((acc, bin)=>{return acc + bin.count}, 0))) })) }]}
              width={Math.max(100, waitTimes.histogram.length * 70)}
              className={`css
                color: 'red'
              `}
              height={200}
              margin={
                  {
                    top: 10,
                    bottom: 30,
                    left: 50,
                    right: 10,
                  }
                }
              xAxis={{label: "minutes"}}
              barPadding={0.3}
              style={{fill: 'red'}}
              yAxis={{innerTickSize: 10, label: "chance", tickArguments: [5], tickFormat: d3.format(".0%")}}
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
                    top: 10,
                    bottom: 30,
                    left: 50,
                    right: 10,
                  }
                }
              xAxis={{label: "minutes"}}
              barPadding={0.3}
              style={{fill: 'red'}}
              yAxis={{innerTickSize: 10, label: "trips", tickArguments: [5]}}
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
