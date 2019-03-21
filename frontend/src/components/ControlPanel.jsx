import React, { Component } from 'react';
import { css } from 'emotion';
import DatePicker from 'react-date-picker';
import PropTypes from 'prop-types';
import addresses from '../constants/addresses';

import DropdownControl from './DropdownControl';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selected: {},
      date: new Date('2019-02-01T03:50'),
      time: '6:50 am',
    };
  }

  onSubmit = (event) => {
    event.preventDefault();
    const { avgWaitHandler } = this.props;
    const { selected, date, time } = this.state;
    avgWaitHandler({ ...selected }, date, time);
  }

  onChange = date => this.setState({ date });

  handleSelected(selectedValue, prettyName) {
    const { selected } = this.state;
    const selectedCopy = { ...selected };
    /*
      temp fix. Should not pass sid through text
    */
    let selectedValueCopy = selectedValue;
    if (selectedValue.indexOf('sid:') !== -1) {
      [, selectedValueCopy] = selectedValue.split('sid:');
    }
    selectedCopy[prettyName] = selectedValueCopy;
    this.setState({ selected: selectedCopy });
  }

  handleTimeChange(newTime) {
    this.setState({ time: newTime.formatted });
  }

  // toggleTimekeeper(val) {
  //   // this.setState({ displayTimepicker: val });
  // }

  render() {
    const { date } = this.state;

    return (
      <>
        <div className={css`
          background-color: #add8e6;
          color: #fff;
          border-radius: 5px;
          padding: 20px;
          margin-right: 20px;
          grid-column: col1-start / col3-start;
           grid-row: row2-start ;
      `
      }
        >
          <DatePicker value={date} onChange={this.onChange} />
          <DropdownControl handleSelected={this.handleSelected} obj={[{ prettyName: 'Route' }, { name: 'route' }, { options: [12] }, { variant: 'primary' }]} />
          <DropdownControl handleSelected={this.handleSelected} obj={addresses} />
          <DropdownControl handleSelected={this.handleSelected} obj={[{ prettyName: 'Direction' }, { name: 'direction' }, { options: ['Inbound', 'Outbound'] }, { variant: 'info' }]} />
        </div>
        <div className={css`
          color: #fff;
          border-radius: 5px;
          margin-top: 20px;
          `}
        >
          <button type="submit" onClick={this.onSubmit}> Calculate route statistics </button>
        </div>
      </>
    );
  }
}

ControlPanel.propTypes = {
  avgWaitHandler: PropTypes.func.isRequired,
};

export default ControlPanel;
