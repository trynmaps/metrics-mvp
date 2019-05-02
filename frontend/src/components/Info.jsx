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
