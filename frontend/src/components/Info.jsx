import React, { Component } from 'react';
import { css } from 'emotion';
import { BarChart /*, LineChart */ } from 'react-d3-components';

/*
const lineData = [
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
];
*/

class Info extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  render() {

    const { graphData, graphError } = this.props;

    const histogram = graphData ? graphData.headway_min.histogram : null;

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
        <BarChart
          data={[{values: histogram.map(bin => ({x:''+bin.value, y:bin.count}))}]}
          width={Math.max(400, histogram.length * 50)}
          height={400}
          margin={
                  {
                    top: 10,
                    bottom: 50,
                    left: 0,
                    right: 20,
                  }
                }
      /> : null }
      <code>{graphError ? graphError : ''}{ graphData ? JSON.stringify(graphData) : null}</code>
      </div>
    );
  }
}

export default Info;
