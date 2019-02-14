import React, { Component } from 'react';
import DropdownControl from './DropdownControl';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  render() {
    return (
      <div className="controls-wrapper">
        <DropdownControl prettyName="Route" name="route" options={[1, 2, 3, 4, 5]} variant="success" />
      </div>
    );
  }
}


export default ControlPanel;
