import React, { useEffect, useState } from 'react';
import Moment from 'moment';
import { makeStyles } from '@material-ui/core/styles';
import Checkbox from '@material-ui/core/Checkbox';
import Collapse from '@material-ui/core/Collapse';
import Grid from '@material-ui/core/Grid';
import Popover from '@material-ui/core/Popover';
import Button from '@material-ui/core/Button';
import { connect } from 'react-redux';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import Select from '@material-ui/core/Select';
import { List, ListItem } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import {
  TIME_RANGES, TIME_RANGE_ALL_DAY, DATE_RANGES,
  CUSTOM_DATE_RANGE, MAX_DATE_RANGE, WEEKDAYS, WEEKENDS
} from '../UIConstants';
import { initialState } from '../reducers/routesReducer';
import { handleGraphParams } from '../actions';

const useStyles = makeStyles(theme => ({
  secondaryHeading: {
    fontSize: theme.typography.pxToRem(12),
    color: theme.palette.text.secondary,
    textAlign: 'left',
  },
  nowrap: {
    whiteSpace: 'nowrap',
  },
  formControl: {
    leftMargin: theme.spacing(1),
    rightMargin: theme.spacing(1),
    minWidth: 240,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}));

/**
 * Displays the current date and time selections and an "expand" icon as
 * a large button.  Clicking the button reveals a Popper with a date and
 * time picker.
 *
 * This button is meant to appear on every screen of the UI, currently
 * at the right end of the app bar.
 *
 * @param {any} props
 */
function DateTimePopover(props) {
  const { graphParams, anchorEl, setAnchorEl } = props;
  const targetRange = anchorEl ? anchorEl.id : 'firstDateRange';
  
  // Initialize our local state to the appropriate date range object.
  
  const [ dateRangeParams, setDateRangeParams ] = useState(graphParams[targetRange] || initialState.graphParams.firstDateRange);

  // Whenever targetRange changes, we need to resync our local state with Redux
   
  useEffect(() => {
    setDateRangeParams(graphParams[targetRange] || initialState.graphParams.firstDateRange);    
  }, [targetRange, graphParams])


  const classes = useStyles();
  const maxDate = Moment(Date.now()).format('YYYY-MM-DD');

  /**
   * On close, we apply to local changes to the Redux state.
   */
  function handleClose() {
    
    const payload = {};
    payload[targetRange] = dateRangeParams;
    props.handleGraphParams(payload);
    
    setAnchorEl(null);
  }

  function handleDateRangeParams(datePayload) {
    const newDateRangeParams = {...dateRangeParams, ...datePayload };
    setDateRangeParams(newDateRangeParams);
  }

  function handleReset() {
    const initialParams = initialState.graphParams.firstDateRange;
    handleDateRangeParams(initialParams);
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
      handleDateRangeParams({ startTime: null, endTime: null });
    } else {
      const timeRangeParts = myTimeRange.target.value.split('-');
      handleDateRangeParams({
        startTime: timeRangeParts[0],
        endTime: timeRangeParts[1],
      });
    }
  };

  /**
   * Handler that updates the date string in the state.
   *
   * @param {any} myDate
   */
  const setDate = myDate => {
    if (!myDate.target.value) {
      // ignore empty date and leave at current value
    } else {
      handleDateRangeParams({
        date: myDate.target.value,
      });
    }
  };

  /**
   * Handler that updates the date string in the state.
   *
   * @param {any} myDate
   */
  const setStartDate = myDate => {
    if (!myDate.target.value) {
      // ignore empty date and leave at current value
    } else {
      handleDateRangeParams({
        startDate: myDate.target.value,
      });
    }
  };

  // daysBack is for preserving radio button state.
  const setDateRange = event => {

    const daysBack = event.target.value;

    handleDateRangeParams({
      daysBack: daysBack,
    });

    // The GraphQL api takes a list of dates, which are generated just before
    // calling the API.
  };

  const handleDayChange = event => {
    const day = event.target.value;
    const newDaysOfTheWeek = { ...dateRangeParams.daysOfTheWeek };
    newDaysOfTheWeek[day] = event.target.checked;
    handleDateRangeParams({
      daysOfTheWeek: newDaysOfTheWeek,
    });
  };

  /**
   * Bulk toggle.
   */
  const toggleDays = event => {
    const what = event.target.value === 'weekdays' ? WEEKDAYS : WEEKENDS;

    const newDaysOfTheWeek = { ...dateRangeParams.daysOfTheWeek };

    // If all false -> set all to true; some false/true -> set all true; all true -> set all false;
    // That is, if all true, set to all false, otherwise set to all true.

    const newValue = !allTrue(newDaysOfTheWeek, what);

    for (let i = 0; i < what.length; i++) {
      newDaysOfTheWeek[what[i].value] = newValue;
    }

    handleDateRangeParams({
      daysOfTheWeek: newDaysOfTheWeek,
    });
  }

  const allFalse = (dictionary, array) => {
    for (let i = 0; i < array.length; i++) {
      if (dictionary[array[i].value]) {
        return false;
      }
    }
    return true;
  };

  const allTrue = (dictionary, array) => {
    for (let i = 0; i < array.length; i++) {
      if (!dictionary[array[i].value]) {
        return false;
      }
    }
    return true;
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  return (
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <IconButton
          size="small"
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>

        <List style={{ color: 'black', marginTop: 24, paddingTop: 0 }}>
          <ListItem>
            <FormControl className={classes.formControl}>
              <TextField
                id="date"
                label="Date"
                type="date"
                value={dateRangeParams.date}
                InputProps={{
                  inputProps: {
                    max: maxDate,
                  },
                }}
                className={classes.textField}
                InputLabelProps={{
                  shrink: true,
                }}
                onChange={setDate}
              />
            </FormControl>
          </ListItem>

          <ListItem>
            <FormControl component="fieldset" className={classes.formControl}>
              <FormLabel component="legend" className={classes.secondaryHeading}>Date Range for Stop to Stop Info</FormLabel>
              <RadioGroup
                value={dateRangeParams.daysBack}
                onChange={setDateRange}
                aria-label="date range" name="dateRange">

                {DATE_RANGES.map(range => (
                  <FormControlLabel
                    key={range.value}
                    value={range.value}
                    control={<Radio />}
                    label={range.label}

                  />
                ))}

              </RadioGroup>
            </FormControl>
          </ListItem>

          <Collapse in={dateRangeParams.daysBack === CUSTOM_DATE_RANGE}>
            <ListItem>
              <FormControl className={classes.formControl}>
                <TextField
                  id="startDate"
                  label="Start Date"
                  type="date"
                  defaultValue={dateRangeParams.startDate}
                  InputProps={{
                    inputProps: {
                      max: dateRangeParams.date,
                      min: Moment(dateRangeParams.date).subtract(MAX_DATE_RANGE, 'days').format('YYYY-MM-DD'),
                    },
                  }}
                  className={classes.textField}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  onChange={setStartDate}
                />
              </FormControl>
            </ListItem>
          </Collapse>

          <ListItem>
            <FormControl component="fieldset" className={classes.formControl}>
              <FormLabel component="legend" className={classes.secondaryHeading}>Days of the Week</FormLabel>

              <Grid container>
                <Grid item>
                  <FormGroup>
                    <FormControlLabel
                      control={<Checkbox value="weekdays"
                        checked={!allFalse(dateRangeParams.daysOfTheWeek, WEEKDAYS)}
                        indeterminate={!allFalse(dateRangeParams.daysOfTheWeek, WEEKDAYS) &&
                          !allTrue(dateRangeParams.daysOfTheWeek, WEEKDAYS)}
                        onChange={toggleDays} />}
                      label="Weekdays"
                    />

                    {WEEKDAYS.map(day =>
                      <FormControlLabel
                        control={<Checkbox checked={dateRangeParams.daysOfTheWeek[day.value]} onChange={handleDayChange} value={day.value} />}
                        key={day.value}
                        label={day.label}
                      />)}
                  </FormGroup>
                </Grid>
                <Grid item>
                  <FormGroup>

                    <FormControlLabel
                      control={<Checkbox value="weekends"
                        checked={!allFalse(dateRangeParams.daysOfTheWeek, WEEKENDS)}
                        indeterminate={!allFalse(dateRangeParams.daysOfTheWeek, WEEKENDS) &&
                          !allTrue(dateRangeParams.daysOfTheWeek, WEEKENDS)}
                        onChange={toggleDays} />}
                      label="Weekends"
                    />

                    {WEEKENDS.map(day =>
                      <FormControlLabel
                        control={<Checkbox checked={dateRangeParams.daysOfTheWeek[day.value]} onChange={handleDayChange} value={day.value} />}
                        key={day.value}
                        label={day.label}
                      />)}
                  </FormGroup>

                </Grid>
              </Grid>
            </FormControl>

          </ListItem>

          <ListItem>
            <FormControl className={classes.formControl}>
              <InputLabel htmlFor="time-helper">Time Range</InputLabel>
              <Select
                value={timeRange}
                onChange={setTimeRange}
                input={<Input name="time_range" id="time_range" />}
              >
                {TIME_RANGES.map(range => (
                  <MenuItem value={range.value} key={range.value}>
                    {range.shortLabel}
                    {range.restOfLabel}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </ListItem>
          <ListItem>
            <Button onClick={handleReset}>Reset</Button>
          </ListItem>
        </List>
      </Popover>
  );
}

const mapStateToProps = state => ({
  graphParams: state.routes.graphParams,
});

const mapDispatchToProps = dispatch => {
  return {
    handleGraphParams: params => dispatch(handleGraphParams(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DateTimePopover);
