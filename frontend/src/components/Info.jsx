import React, { Component } from 'react';
import { css } from 'emotion';
import { BarChart } from 'react-d3-components';

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
         grid-row: row2-start / row2-end;
        `
        }
      >
        {histogram
          ? (
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
          ) : null }
        <code>
          {graphError || ''}
        </code>
      </div>
    );
  }
}

export default Info;
