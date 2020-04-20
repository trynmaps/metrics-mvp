import React from 'react';
import { connect } from 'react-redux';
import { TextField } from '@material-ui/core';
import { updateQuery } from '../actions';
import { dateQueryFromDateRangeParams } from '../routesMap';

/*
 * Renders an input field that allows changing the app's date range to a single date.
 */
function SingleDateControl(props) {
  const { graphParams } = props;

  const targetRange = props.targetRange || 'firstDateRange';

  const dateRangeParams = graphParams[targetRange];

  function applyDateRangeParams(payload) {
    const newDateRangeParams = { ...dateRangeParams, ...payload };
    props.updateQuery({
      [targetRange]: dateQueryFromDateRangeParams(newDateRangeParams),
    });
  }

  function setDate(event) {
    const newDate = event.target.value;
    applyDateRangeParams({
      startDate: newDate,
      date: newDate,
    });
  }

  return (
    <TextField
      type="date"
      required
      style={{ maxWidth: '140px' }}
      value={dateRangeParams.date}
      onChange={setDate}
    />
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

export default connect(mapStateToProps, mapDispatchToProps)(SingleDateControl);
