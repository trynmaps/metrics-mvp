import React, { Component } from 'react';
import { DateRangePicker } from 'react-date-range';
import PropTypes from 'prop-types';
import { format, addDays } from 'date-fns';

function formatDateDisplay(date, defaultText) {
  if (!date) return defaultText;
  return format(date, 'MM/DD/YYYY');
}

class MultipleDatePicker extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      dateRangePicker: {
        selection: {
          startDate: new Date('2019-04-08T03:50'),
          endDate: null,
          key: 'selection',
        },
        compare: {
          startDate: new Date('2019-04-08T03:50'),
          endDate: addDays(new Date('2019-04-08T03:50'), 3),
          key: 'compare',
        },
      },
    };
  }

  handleRangeChange(which, payload) {
    console.log(which, payload);
    this.setState({
      [which]: {
        ...this.state[which],
        ...payload,
      },
    });
  }

  render() {
    return (
      <div>
        <div>
          <input
            type="text"
            readOnly
            value={formatDateDisplay(this.state.dateRangePicker.selection.startDate)}
          />
          <input
            type="text"
            readOnly
            value={formatDateDisplay(this.state.dateRangePicker.selection.endDate)}
          />
        </div>
        <div>
          <DateRangePicker
            onChange={this.handleRangeChange.bind(this, 'dateRangePicker')}
            className={'PreviewArea'}
            months={1}
            minDate={addDays(new Date(), -300)}
            maxDate={addDays(new Date(), 900)}
            direction="vertical"
            scroll={{ enabled: true }}
            ranges={[this.state.dateRangePicker.selection, this.state.dateRangePicker.compare]}
          />
        </div>
      </div>
    );
  }
}

MultipleDatePicker.propTypes = {
  dates: PropTypes.instanceOf(Date).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default MultipleDatePicker;
