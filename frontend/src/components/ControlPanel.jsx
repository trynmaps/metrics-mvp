import React, { Component } from 'react';
import DropdownControl from './DropdownControl';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = { selected: [] };
    this.handleSelected = this.handleSelected.bind(this);
  }

  handleSelected(event) {
    const selected = event.target.textContent;
    this.setState(state => ({
      selected: [...state.selected, selected],
    }));
  }

  render() {
    return (
      <div className="controls-wrapper">
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Route' }, { name: 'route' }, { options: [1, 2, 3, 4, 5] }, { variant: 'primary' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'From Stop' }, { name: 'from-stop' }, { options: [1, 2, 3, 4, 5] }, { variant: 'secondary' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Direction' }, { name: 'direction' }, { options: [1, 2, 3, 4, 5] }, { variant: 'success' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'To Stop' }, { name: 'to-stop' }, { options: [1, 2, 3, 4, 5] }, { variant: 'info' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Days of Week' }, { name: 'days-of-week' }, { options: [1, 2, 3, 4, 5] }, { variant: 'warning' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Time of Day' }, { name: 'time-of-day' }, { options: [1, 2, 3, 4, 5] }, { variant: 'danger' }]} />
      </div>
    );
  }
}


export default ControlPanel;
