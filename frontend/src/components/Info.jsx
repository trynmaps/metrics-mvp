import React, { Component } from 'react';
import { BarChart } from 'react-d3-components';
import { LineChart } from 'react-d3-components';

const barData = [{
  label: 'somethingA',
  values: [
    {
      x: '5am',
      y: 10,
    },
    {
      x: '10am',
      y: 4,
    },
    {
      x: '12pm',
      y: 3,
    },
  ],
}];

const lineData = [
  {
    label: '', values: [
      {
        x: '5am',
        y: 2
      },
      {
        x: '7am',
        y: 4
      },
      {
        x: '9am',
        y: 7
      },
      {
        x: '11am',
        y: 7
      },
      {
        x: '1pm',
        y: 5
      }
            ]},
]

class Info extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  render() {
    const { name } = this.props;
    return (
      <div
        className="App"
        style={
          {
            padding: '10%',
          }
        }
      >
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <LineChart
                data={lineData}
                width={400}
                height={400}
                margin={
                  {
                    top: 10,
                    bottom: 50,
                    left: .5,
                    right: 20
                  }
                }
               />
            </div>
            <div className="col-md-6">
              <BarChart
                data={barData}
                width={400}
                height={400}
                margin={
                  {
                    top: 10,
                    bottom: 50,
                    left: 0,
                    right: 20,
                  }
                }
              />
            </div>
          </div>

        </div>
      </div>
    );
  }
}

export default Info;
