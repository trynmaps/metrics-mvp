import React, { Component } from 'react';
import './App.css';
import ControlPanel from './components/ControlPanel';
import Info from './components/Info';


class App extends Component {
  constructor() {
    super();
    this.state = 0;
  }

  render() {
    return (
      <div>
        <ControlPanel />
        <Info />
      </div>
    );
  }
}

export default App;
