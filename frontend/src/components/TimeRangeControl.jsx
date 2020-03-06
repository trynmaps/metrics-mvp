import React from 'react';
import { connect } from 'react-redux';

import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

import { TIME_RANGES, TIME_RANGE_ALL_DAY } from '../UIConstants';
import { dateQueryFromDateRangeParams } from '../routesMap';
import { updateQuery } from '../actions';

/*
 * Renders a dropdown that allows the user to select a time range,
 * and updates the query string.
 *
 * If the targetRange prop is 'secondDateRange', updates the
 * second time range used for comparison.
 *
 * This control preserves the dates selected via the DateRangeControl.
 */
function TimeRangeControl(props) {
  const { graphParams } = props;

  const targetRange = props.targetRange || 'firstDateRange';

  const dateRangeParams = graphParams[targetRange];

  function applyDateRangeParams(payload) {
    const newDateRangeParams = { ...dateRangeParams, ...payload };

    if (
      JSON.stringify(newDateRangeParams) ===
      JSON.stringify(graphParams[targetRange])
    ) {
      return;
    }

    props.updateQuery({
      [targetRange]: dateQueryFromDateRangeParams(newDateRangeParams),
    });
  }

  // convert the state's current time range to a string or the sentinel value
  const timeRange =
    dateRangeParams.startTime && dateRangeParams.endTime
      ? `${dateRangeParams.startTime}-${dateRangeParams.endTime}`
      : TIME_RANGE_ALL_DAY;

  /**
   * Handler that takes the time range as a string and sets
   * the start and end time state.
   *
   * @param {any} myTimeRange
   */
  const setTimeRange = myTimeRange => {
    if (myTimeRange.target.value === TIME_RANGE_ALL_DAY) {
      applyDateRangeParams({ startTime: null, endTime: null });
    } else {
      const timeRangeParts = myTimeRange.target.value.split('-');
      applyDateRangeParams({
        startTime: timeRangeParts[0],
        endTime: timeRangeParts[1],
      });
    }
  };

  const renderTimeRange = value => {
    const range = TIME_RANGES.find(t => t.value === value);
    return range ? range.shortLabel : value;
  };

  return (
    <Select
      value={timeRange}
      onChange={setTimeRange}
      renderValue={renderTimeRange}
    >
      {TIME_RANGES.map(range => (
        <MenuItem value={range.value} key={range.value}>
          {range.shortLabel}
          {range.restOfLabel}
        </MenuItem>
      ))}
    </Select>
  );
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
});

const mapDispatchToProps = dispatch => {
  return {
    updateQuery: params => dispatch(updateQuery(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(TimeRangeControl);
