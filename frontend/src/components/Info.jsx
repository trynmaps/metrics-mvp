import React, { Component } from 'react';
import { css } from 'emotion';
import { BarChart } from 'react-d3-components';
import * as d3 from "d3";
import './Info.css';

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
        {histogram
          ? (
            <div>
              <div className='wrapper'>
              <div className='xAxisLabel' >css-x-label</div>
              <div className='yAxisLabel' >css-y-label</div>
              <BarChart className='chart1'
                xAxis={{label: "build-in-x-label"}}
                yAxis={{label: "build-in-y-label", tickFormat: d3.format("%")}}
                colorScale={colorScale}
                data={[
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
                data={[{ values: histogram.map(bin => ({ x: `${bin.value}`, y: bin.count })) }]}
                width={Math.max(400, histogram.length * 70)}
                className={`css
                  color: 'red'
                `}
                height={400}
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
              />
            </div>
          ) : null }
        <code>
          {graphError || ''}
        </code>
      </div>
    );
  }
}

export default Info;
