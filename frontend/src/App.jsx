import React, { Component } from 'react';
import './App.css';
import ControlPanel from './components/ControlPanel';
import Info from './components/Info.jsx';


class App extends Component {
  constructor() {
    super();
    this.state = 0;
  }

  render() {
    return (
      <div>
        <ControlPanel></ControlPanel>
        <Info></Info>
      </div>
    );
  }
}

export default App;
