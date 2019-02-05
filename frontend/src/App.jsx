import React, { Component } from 'react';
import './App.css';
import ControlPanel from './ControlPanel';

class App extends Component {
  constructor() {
    super();
    this.state = 0;
  }

  render() {
    return (
      <div className="App">
        <ControlPanel trynState="string" />
      </div>
    );
  }
}

export default App;
