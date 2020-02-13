import React, { useState } from 'react';
import Moment from 'moment';
import { makeStyles } from '@material-ui/core/styles';
import Checkbox from '@material-ui/core/Checkbox';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import { connect } from 'react-redux';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';

import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import { List, ListItem } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';

import {
  DATE_RANGES,
  MAX_DATE_RANGE,
  WEEKDAYS,
  WEEKENDS,
} from '../UIConstants';
import { initialGraphParams } from '../reducers';
import { fullQueryFromParams } from '../routesMap';

const useStyles = makeStyles(theme => ({
  button: {
    textTransform: 'none',
    borderRadius: '0px',
    borderColor: 'rgba(0, 0, 0, 0.42);',
    borderWidth: '0px 0px 1px 0px',
    padding: '3px 4px 3px 4px',
    justifyContent: 'flex-start',
    marginTop: '2px',
  },
  checkboxLabel: {
    fontSize: theme.typography.pxToRem(14),
  },
  heading: {
    fontSize: theme.typography.pxToRem(16),
    color: '#333',
  },
  secondaryHeading: {
    fontSize: theme.typography.pxToRem(15),
    color: '#333',
    // color: theme.palette.text.secondary,
    textAlign: 'left',
  },
  column: {
    flexGrow: '1',
  },
  dateTime: {
    whiteSpace: 'nowrap',
    display: 'flex',
  },
  root: {
    whiteSpace: 'nowrap',
  },
  formControl: {
    leftMargin: theme.spacing(1),
    rightMargin: theme.spacing(1),
    minWidth: 240,
  },
  closeButton: {
    position: 'absolute',
    zIndex: 100000,
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  popover: {
    padding: theme.spacing(2),
    maxWidth: 400,
  },
}));

function DateRangeControl(props) {
  const { graphParams, dateRangeSupported, currentLocation } = props;

  const targetRange = props.targetRange || 'firstDateRange';

  const dateRangeParams = graphParams[targetRange];

  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);
  const maxDate = Moment(Date.now()).format('YYYY-MM-DD');

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function applyDateRangeParams(payload) {
    const newDateRangeParams = Object.assign({}, dateRangeParams, payload);
    const newGraphParams = Object.assign({}, graphParams);
    newGraphParams[targetRange] = newDateRangeParams;

    props.dispatch({
      type: currentLocation.type,
      payload: currentLocation.payload,
      query: fullQueryFromParams(newGraphParams),
    });
  }

  function handleReset() {
    const initialDateRangeParams = initialGraphParams[targetRange];

    if (initialDateRangeParams)
    {
        applyDateRangeParams({
          date: initialDateRangeParams.date,
          daysBack: initialDateRangeParams.daysBack,
          startDate: initialDateRangeParams.date,
          daysOfTheWeek: initialDateRangeParams.daysOfTheWeek,
        });
    }
    handleClose(); // this forces the native date picker to reset, otherwise it doesn't stay in sync
  }

  /**
   * convert yyyy/mm/dd to m/d/yyyy
   */
  function convertDate(ymdString) {
    const date = new Date(ymdString);
    return date.toLocaleDateString('en', { timeZone: 'UTC' });
  }
  // these are the read-only representations of the date and time range
  let dateLabel = convertDate(dateRangeParams.date);

  //
  // If a date range is set, either update the date label to the full
  // range if we support it, or else show an info icon that explains
  // that we are only showing one day's data.
  //

  if (dateRangeParams.startDate !== dateRangeParams.date) {
    if (dateRangeSupported) {
      dateLabel = `${convertDate(dateRangeParams.startDate)} - ${dateLabel}`;
    }
  }

  /**
   * Handler that updates the (end) date string in the state.
   * Also keeps startDate no later than date.
   *
   * @param {any} myDate
   */
  const setDate = myDate => {
    const newDate = myDate.target.value;
    if (!newDate) {
      // ignore empty date and leave at current value
    } else {
      const newMoment = Moment(newDate);
      const startMoment = Moment(dateRangeParams.startDate);

      const payload = {
        date: newDate,
      };

      if (newMoment.isBefore(dateRangeParams.startDate)) {
        payload.startDate = newDate;
      } else if (newMoment.diff(startMoment, 'days') > MAX_DATE_RANGE) {
        payload.startDate = newMoment
          .subtract(MAX_DATE_RANGE, 'days')
          .format('YYYY-MM-DD');
      }
      applyDateRangeParams(payload);
    }
  };

  /**
   * Handler that updates the start date string in the state.
   *
   * @param {any} myDate
   */
  const setStartDate = myDate => {
    if (!myDate.target.value) {
      // ignore empty date and leave at current value
    } else {
      applyDateRangeParams({
        startDate: myDate.target.value,
      });
    }
  };

  const setDateRange = daysBack => {
    const date = initialGraphParams.date;
    const startMoment = Moment(date).subtract(daysBack - 1, 'days'); // include end date

    applyDateRangeParams({
      date,
      startDate: startMoment.format('YYYY-MM-DD'),
    });

    // The GraphQL api takes a list of dates, which are generated just before
    // calling the API.
  };

  const handleDayChange = event => {
    const day = event.target.value;
    const newDaysOfTheWeek = { ...dateRangeParams.daysOfTheWeek };
    newDaysOfTheWeek[day] = event.target.checked;
    applyDateRangeParams({
      daysOfTheWeek: newDaysOfTheWeek,
    });
  };

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

    applyDateRangeParams({
      daysOfTheWeek: newDaysOfTheWeek,
    });
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  return (
    <>
      {dateRangeSupported ? (
        <FormControl className="inline-form-control">
          <InputLabel shrink id="dateRangeLabel">
            Date Range
          </InputLabel>
          <Button
            variant="outlined"
            color="inherit"
            className={`${classes.button} MuiInput-formControl`}
            onClick={handleClick}
          >
            <div className={classes.dateTime}>
              <span>
                <Typography className={classes.heading} display="inline">
                  {dateLabel}&nbsp;
                </Typography>
              </span>
              <ArrowDropDownIcon />
            </div>
          </Button>
        </FormControl>
      ) : (
        <FormControl className="inline-form-control">
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
      )}
      {dateRangeSupported ? (
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

          <List style={{ color: 'black' }}>
            <ListItem>
              <FormControl className={classes.formControl}>
                <TextField
                  id="startDate"
                  label="Start Date"
                  type="date"
                  value={dateRangeParams.startDate}
                  InputProps={{
                    inputProps: {
                      max: dateRangeParams.date,
                      min: Moment(dateRangeParams.date)
                        .subtract(MAX_DATE_RANGE, 'days')
                        .format('YYYY-MM-DD'),
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

            <ListItem>
              <FormControl className={classes.formControl}>
                <TextField
                  id="date"
                  label="End Date"
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
              <Grid container style={{ maxWidth: 250 }}>
                {DATE_RANGES.map(range => (
                  <Grid item xs={6} key={range.value}>
                    <Button
                      key={range.value}
                      onClick={() => {
                        setDateRange(range.value);
                      }}
                    >
                      {range.label}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </ListItem>

            <ListItem>
              <FormControl component="fieldset" className={classes.formControl}>
                <Grid container>
                  <Grid item>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <Checkbox
                            value="weekdays"
                            checked={
                              !allFalse(dateRangeParams.daysOfTheWeek, WEEKDAYS)
                            }
                            indeterminate={
                              !allFalse(dateRangeParams.daysOfTheWeek, WEEKDAYS) &&
                              !allTrue(dateRangeParams.daysOfTheWeek, WEEKDAYS)
                            }
                            onChange={toggleDays}
                          />
                        }
                        label="Weekdays"
                      />

                      <Divider
                        variant="middle"
                        style={
                          { marginLeft: 0 } /* divider with a right margin */
                        }
                      />

                      {WEEKDAYS.map(day => (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={dateRangeParams.daysOfTheWeek[day.value]}
                              onChange={handleDayChange}
                              value={day.value}
                            />
                          }
                          key={day.value}
                          label={day.label}
                        />
                      ))}
                    </FormGroup>
                  </Grid>
                  <Grid item>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <Checkbox
                            value="weekends"
                            checked={
                              !allFalse(dateRangeParams.daysOfTheWeek, WEEKENDS)
                            }
                            indeterminate={
                              !allFalse(dateRangeParams.daysOfTheWeek, WEEKENDS) &&
                              !allTrue(dateRangeParams.daysOfTheWeek, WEEKENDS)
                            }
                            onChange={toggleDays}
                          />
                        }
                        label="Weekends"
                      />

                      <Divider
                        variant="middle"
                        style={
                          { marginLeft: 0 } /* divider with a right margin */
                        }
                      />

                      {WEEKENDS.map(day => (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={dateRangeParams.daysOfTheWeek[day.value]}
                              onChange={handleDayChange}
                              value={day.value}
                            />
                          }
                          key={day.value}
                          label={day.label}
                        />
                      ))}
                    </FormGroup>
                  </Grid>
                </Grid>
              </FormControl>
            </ListItem>
            <ListItem>
              <Button onClick={handleReset}>Reset</Button>
            </ListItem>
          </List>
        </Popover>
      ) : null}
    </>
  );
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
  currentLocation: state.location,
});

const mapDispatchToProps = dispatch => {
  return {
    dispatch,
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DateRangeControl);
