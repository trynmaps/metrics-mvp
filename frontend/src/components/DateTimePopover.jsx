import React, { useEffect, useState } from 'react';
import Moment from 'moment';
import { makeStyles } from '@material-ui/core/styles';
import Checkbox from '@material-ui/core/Checkbox';
import Divider from '@material-ui/core/Divider';
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
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import {
  TIME_RANGES,
  TIME_RANGE_ALL_DAY,
  DATE_RANGES,
  MAX_DATE_RANGE,
  WEEKDAYS,
  WEEKENDS,
} from '../UIConstants';
import { typeForPage } from '../reducers/page';
import { initialGraphParams } from '../reducers';
import { fullQueryFromParams } from '../routesMap';
import { allTrue, allFalse } from '../helpers/dateTime';

const useStyles = makeStyles(theme => ({
  secondaryHeading: {
    fontSize: theme.typography.pxToRem(12),
    color: theme.palette.text.secondary,
    textAlign: 'left',
  },
  formControl: {
    leftMargin: theme.spacing(1),
    rightMargin: theme.spacing(1),
    minWidth: 240,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
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

  // Initialize our local data range parameters state to the appropriate date range object.

  const [localDateRangeParams, setLocalDateRangeParams] = useState(
    graphParams[targetRange] || initialGraphParams.firstDateRange,
  );

  // Whenever targetRange changes, we need to resync our local state with Redux

  useEffect(() => {
    setLocalDateRangeParams(
      graphParams[targetRange] || initialGraphParams.firstDateRange,
    );
  }, [targetRange, graphParams]);

  const classes = useStyles();
  const maxDate = Moment(Date.now()).format('YYYY-MM-DD');

  /**
   * Compute and dispatch new graph params.
   */
  function applyGraphParams() {
    const newGraphParams = Object.assign({}, graphParams);
    newGraphParams[targetRange] = localDateRangeParams;

    const currentType = typeForPage(props.currentPage);

    props.dispatch({
      type: currentType,
      payload: graphParams, // not affected by date changes
      query: fullQueryFromParams(newGraphParams),
    });
  }

  /**
   * On close, we apply to local changes to the Redux state.
   */
  function handleClose() {
    applyGraphParams();
    setAnchorEl(null);
  }

  function handleReset() {
    setLocalDateRangeParams(initialGraphParams.firstDateRange);
  }

  function updateLocalDateRangeParams(datePayload) {
    const newLocalDateRangeParams = { ...localDateRangeParams, ...datePayload };
    setLocalDateRangeParams(newLocalDateRangeParams);
  }

  // convert the state's current time range to a string or the sentinel value
  const timeRange =
    localDateRangeParams.startTime && localDateRangeParams.endTime
      ? `${localDateRangeParams.startTime}-${localDateRangeParams.endTime}`
      : TIME_RANGE_ALL_DAY;

  /**
   * Handler that takes the time range as a string and sets
   * the start and end time state.
   *
   * @param {any} myTimeRange
   */
  const setTimeRange = myTimeRange => {
    if (myTimeRange.target.value === TIME_RANGE_ALL_DAY) {
      updateLocalDateRangeParams({ startTime: null, endTime: null });
    } else {
      const timeRangeParts = myTimeRange.target.value.split('-');
      updateLocalDateRangeParams({
        startTime: timeRangeParts[0],
        endTime: timeRangeParts[1],
      });
    }
  };

  /**
   * Normalizes date input strings.  Keeps them to the past and today.
   *
   * @param {String} date
   * @returns {Object} Moment object
   */
  const normalizedMoment = date => {
    const maxMoment = Moment(Date.now());
    let moment = Moment(date);

    // end date cannot be later than now, so set to now
    if (moment.isAfter(maxMoment)) {
      moment = maxMoment;
    }
    return moment;
  };

  /**
   * Handler that updates the end date in the state.
   *
   * @param {any} myDate
   */
  const setEndDate = myDate => {
    const newDate = myDate.target.value;
    if (!newDate) {
      // ignore empty date and leave at current value
    } else {
      const startMoment = Moment(localDateRangeParams.startDate);
      const newMoment = normalizedMoment(newDate);

      const payload = {
        date: newMoment.format('YYYY-MM-DD'),
      };

      if (newMoment.isBefore(startMoment)) {
        // end date cannot before start, so adjust the start
        payload.startDate = newDate;
      } else if (newMoment.diff(startMoment, 'days') > MAX_DATE_RANGE) {
        // end date cannot be more than 90 from start, so adjust the start
        payload.startDate = newMoment
          .subtract(MAX_DATE_RANGE, 'days')
          .format('YYYY-MM-DD');
      }
      updateLocalDateRangeParams(payload);
    }
  };

  /**
   * Handler that updates the start date in the state.
   *
   * @param {any} myDate
   */
  const setStartDate = myDate => {
    if (!myDate.target.value) {
      // ignore empty date and leave at current value
    } else {
      const startMoment = normalizedMoment(myDate.target.value);
      updateLocalDateRangeParams({
        startDate: startMoment.format('YYYY-MM-DD'),
      });
    }
  };

  const setDateRange = daysBack => {
    const initialParams = initialGraphParams.firstDateRange;
    const date = initialParams.date;
    const startMoment = Moment(date).subtract(daysBack - 1, 'days'); // include end date

    updateLocalDateRangeParams({
      date,
      startDate: startMoment.format('YYYY-MM-DD'),
    });
  };

  const handleDayChange = event => {
    const day = event.target.value;
    const newDaysOfTheWeek = { ...localDateRangeParams.daysOfTheWeek };
    newDaysOfTheWeek[day] = event.target.checked;
    updateLocalDateRangeParams({
      daysOfTheWeek: newDaysOfTheWeek,
    });
  };

  /**
   * Bulk toggle.
   */
  const toggleDays = event => {
    const what = event.target.value === 'weekdays' ? WEEKDAYS : WEEKENDS;

    const newDaysOfTheWeek = { ...localDateRangeParams.daysOfTheWeek };

    // If all false -> set all to true; some false/true -> set all true; all true -> set all false;
    // That is, if all true, set to all false, otherwise set to all true.

    const newValue = !allTrue(newDaysOfTheWeek, what);

    for (let i = 0; i < what.length; i++) {
      newDaysOfTheWeek[what[i].value] = newValue;
    }

    updateLocalDateRangeParams({
      daysOfTheWeek: newDaysOfTheWeek,
    });
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

      <List style={{ color: 'black', marginTop: 32 }}>
        <ListItem>
          <FormControl className={classes.formControl}>
            <TextField
              id="startDate"
              label="Start Date"
              type="date"
              value={localDateRangeParams.startDate}
              InputProps={{
                inputProps: {
                  max: localDateRangeParams.date,
                  min: Moment(localDateRangeParams.date)
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
              value={localDateRangeParams.date}
              InputProps={{
                inputProps: {
                  max: maxDate,
                },
              }}
              className={classes.textField}
              InputLabelProps={{
                shrink: true,
              }}
              onChange={setEndDate}
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
            <FormLabel component="legend" className={classes.secondaryHeading}>
              Days of the Week
            </FormLabel>

            <Grid container>
              <Grid item>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        value="weekdays"
                        checked={
                          !allFalse(
                            localDateRangeParams.daysOfTheWeek,
                            WEEKDAYS,
                          )
                        }
                        indeterminate={
                          !allFalse(
                            localDateRangeParams.daysOfTheWeek,
                            WEEKDAYS,
                          ) &&
                          !allTrue(localDateRangeParams.daysOfTheWeek, WEEKDAYS)
                        }
                        onChange={toggleDays}
                      />
                    }
                    label="Weekdays"
                  />

                  <Divider
                    variant="middle"
                    style={{ marginLeft: 0 } /* divider with a right margin */}
                  />

                  {WEEKDAYS.map(day => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={
                            localDateRangeParams.daysOfTheWeek[day.value]
                          }
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
                          !allFalse(
                            localDateRangeParams.daysOfTheWeek,
                            WEEKENDS,
                          )
                        }
                        indeterminate={
                          !allFalse(
                            localDateRangeParams.daysOfTheWeek,
                            WEEKENDS,
                          ) &&
                          !allTrue(localDateRangeParams.daysOfTheWeek, WEEKENDS)
                        }
                        onChange={toggleDays}
                      />
                    }
                    label="Weekends"
                  />

                  <Divider
                    variant="middle"
                    style={{ marginLeft: 0 } /* divider with a right margin */}
                  />

                  {WEEKENDS.map(day => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={
                            localDateRangeParams.daysOfTheWeek[day.value]
                          }
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
  graphParams: state.graphParams,
  currentPage: state.page,
});

const mapDispatchToProps = dispatch => {
  return {
    dispatch,
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DateTimePopover);
