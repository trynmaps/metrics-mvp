import React from 'react';
import { connect } from 'react-redux';
// import { makeStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import Tooltip from '@material-ui/core/Tooltip';
import InputLabel from '@material-ui/core/InputLabel';
import Navlink from 'redux-first-router-link';
import BackspaceIcon from '@material-ui/icons/Backspace';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import DateRangeControl from './DateRangeControl';
import TimeRangeControl from './TimeRangeControl';
import { fullQueryFromParams } from '../routesMap';

/*
const useStyles = makeStyles(() => ({
  backspaceIcon: {
    color: red[900],
    fontSize: 19,
    verticalAlign: '-4px',
    opacity: 0.6,
    '&:hover': {
      opacity: 1.0,
    },
  },
}));
*/

function DateTimeRangeControls(props) {
  const { compareSupported, graphParams, currentLocation } = props;

  return (
    <span className="date-time-ranges">
      <span style={{ whiteSpace: 'nowrap' }}>
        <FormControl className="inline-form-control">
          <InputLabel shrink>
            Date-Time Range
            {compareSupported && !graphParams.secondDateRange ? (
              <>
                {' '}
                <Tooltip title="Add Date Range to Compare">
                  <Navlink
                    to={{
                      type: currentLocation.type,
                      payload: currentLocation.payload,
                      query: fullQueryFromParams({
                        ...graphParams,
                        secondDateRange: graphParams.firstDateRange,
                      }),
                    }}
                  >
                    <AddCircleIcon className="add-filter" />
                  </Navlink>
                </Tooltip>
              </>
            ) : null}
          </InputLabel>
          <DateRangeControl compareSupported />
        </FormControl>
        <FormControl className="inline-form-control">
          <InputLabel shrink></InputLabel>
          <TimeRangeControl />
        </FormControl>
      </span>
      {graphParams.secondDateRange && compareSupported ? (
        <span style={{ whiteSpace: 'nowrap' }}>
          <span
            style={{ padding: '30px 10px 5px 3px', display: 'inline-block' }}
          >
            vs.
          </span>
          <FormControl className="inline-form-control">
            <InputLabel shrink>
              Date-Time Range{' '}
              <Navlink
                to={{
                  type: currentLocation.type,
                  payload: currentLocation.payload,
                  query: fullQueryFromParams({
                    ...graphParams,
                    secondDateRange: null,
                  }),
                }}
              >
                <BackspaceIcon className="clear-filter" />
              </Navlink>
            </InputLabel>
            <DateRangeControl targetRange="secondDateRange" />
          </FormControl>

          <FormControl className="inline-form-control">
            <InputLabel></InputLabel>
            <TimeRangeControl targetRange="secondDateRange" />
          </FormControl>
        </span>
      ) : null}
    </span>
  );
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
  currentLocation: state.location,
});

export default connect(mapStateToProps)(DateTimeRangeControls);
