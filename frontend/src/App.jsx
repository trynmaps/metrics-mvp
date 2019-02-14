import React, { Component } from 'react';
import { BarChart } from 'react-d3-components';
import Alert from 'react-bootstrap/Alert';

import './App.css';
import ControlPanel from './components/ControlPanel';

const data = [{
  label: 'somethingA',
  values: [
    {
      x: 'SomethingA',
      y: 10,
    },
    {
      x: 'SomethingB',
      y: 4,
    },
    {
      x: 'SomethingC',
      y: 3,
    },
  ],
}];

class App extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  render() {
    return (
      <div
        className="App"
        style={
          {
            padding: '10%',
          }
        }
      >
        <ControlPanel />
        <Alert variant="success">
          <Alert.Heading>Hey, nice to see you</Alert.Heading>
          <p>
            Aww yeah, you successfully read this important alert message. This example
            text is going to run a bit longer so that you can see how spacing within an
            alert works with this kind of content.
          </p>
          <hr />
          <p className="mb-0">
            Whenever you need to, be sure to use margin utilities to keep things nice
            and tidy.
          </p>
        </Alert>
        <BarChart
          data={data}
          width={400}
          height={400}
          margin={
            {
              top: 10, bottom: 50, left: 50, right: 10,
            }
          }
        />
      </div>
    );
  }
}

export default App;
