import React, { Component } from 'react';
import { css } from 'emotion';
import { BarChart /*, LineChart */ } from 'react-d3-components';
import * as d3 from "d3";
import './Info.css';

/*
to do
show label for x,y axises
y change to % of total buses show 
x frequency
*/

/* const lineData = [
  {
    label: '',
    values: [
      {
        x: '5am',
        y: 2,
      },
      {
        x: '7am',
        y: 4,
      },
      {
        x: '9am',
        y: 7,
      },
      {
        x: '11am',
        y: 7,
      },
      {
        x: '1pm',
        y: 5,
      },
    ],
  },
]; */

const colorScale = d3.scale.ordinal().range(['red', 'blue', 'green']);
class Info extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  render() {

    const { graphData, graphError } = this.props;
    const histogram = graphData ? graphData.headway_min.histogram : null;
    // console.log('test',Array.isArray(histogram));
    // I am trying to wait until histogram's data loaded before access them
    let totalBus;
    if(histogram){
      totalBus = histogram.reduce((totalCount, eachCount)=>{
        return totalCount+=eachCount.count;
      },0);
      console.log('test',totalBus);
    }
    return (
      <div
        className={css`
         grid-column: col3-start ;
          grid-row: row1-start / row2-end;
          `
        }
      >
      {histogram ?
        /* <LineChart
          data={lineData}
          width={400}
          height={400}
          margin={
                  {
                    top: 10,
                    bottom: 50,
                    left: 0.5,
                    right: 20,
                  }
                }
        /> */
        <div>
          <div className='wrapper'>
            <div className='xAxisLabel' >css-x-label</div>
            <div className='yAxisLabel' >css-y-label</div>
            <BarChart className='chart1'
              xAxis={{label: "build-in-x-label"}}
              yAxis={{label: "build-in-y-label", tickFormat: d3.format("%")}}
              colorScale={colorScale}
              data={[
                // {label: 'a', values: histogram.map(bin => ({x:''+bin.value, y:bin.count}))},
                // {label: 'b', values: histogram.map(bin => ({x:''+bin.value, y:bin.count}))},
                {label: 'c', values: histogram.map(bin => ({
                  x:''+bin.value, 
                  y:(bin.count/totalBus)
                }))}
              ]}
              width={Math.max(400, histogram.length * 70)}
              height={400}
              margin={{top: 10, bottom: 30, left: 50, right: 10}}/>
          </div>
          
          <BarChart
            colorScale={colorScale}
            data={[{label: 'a', values: histogram.map(bin => ({x:''+bin.value, y:bin.count}))}]}
            width={Math.max(400, histogram.length * 70)}
            height={400}
            margin={{top: 10, bottom: 50, left: 50, right: 20,}}/>
        </div> : 
        null }
      <code>{graphError ? graphError : ''}{ graphData ? JSON.stringify(graphData) : null}</code>
      </div>
    );
  }
}

export default Info;
