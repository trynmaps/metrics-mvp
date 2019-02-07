import React, { Component } from 'react';
import Control from './Control';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  render() {
    return (
      <div className="controls-wrapper">
        <Control name="weirdo" />
      </div>
    );
  }
}


export default ControlPanel;
