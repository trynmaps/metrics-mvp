import React, { useState, Fragment } from 'react';
import Moment from 'moment';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Checkbox from '@material-ui/core/Checkbox';
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import { connect } from 'react-redux';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
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
import InfoIcon from '@material-ui/icons/InfoOutlined';

import {
  TIME_RANGES, TIME_RANGE_ALL_DAY, DATE_RANGES,
  MAX_DATE_RANGE, WEEKDAYS, WEEKENDS
} from '../UIConstants';
import { initialGraphParams } from '../reducers';
import { isLoadingRequest } from '../reducers/loadingReducer';
import { handleGraphParams } from '../actions';

const useStyles = makeStyles(theme => ({
  button: {
    textTransform: 'none',
    display: 'flex',
    justifyContent: 'flex-start',
  },
  heading: {
    fontSize: theme.typography.pxToRem(15),
  },
  secondaryHeading: {
    fontSize: theme.typography.pxToRem(12),
    color: theme.palette.text.secondary,
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
    display: 'flex',
    flexWrap: 'wrap',
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
  popover: {
    padding: theme.spacing(2),
    maxWidth: 400,
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
function DateTimePanel(props) {
  const { graphParams, dateRangeSupported } = props;
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);
  const [infoAnchorEl, setInfoAnchorEl] = useState(null);
  const maxDate = Moment(Date.now()).format('YYYY-MM-DD');

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleInfoClick(event) {
    setInfoAnchorEl(event.currentTarget);
  }

  function handleInfoClose() {
    setInfoAnchorEl(null);
  }

  function applyGraphParams(payload) {
    // xxx need to figure out how we're going update the path or query
    props.handleGraphParams(payload);
    /*
    const newState = Object.assign(graphParams, payload);
    const path = new Path();
    // rebuild path using new future state -- temporary code
    path.buildPath(DATE, newState.date);
    path.buildPath(START_DATE, newState.startDate);
    path.buildPath(START_TIME, newState.startTime);
    path.buildPath(END_TIME, newState.endTime);
    path.commitPath(); // this will trigger handleGraphParams
    */
  }
  
  function handleReset() {
    applyGraphParams({
      date: initialGraphParams.date,
      startTime: initialGraphParams.startTime,
      endTime: initialGraphParams.endTime,
      daysBack: initialGraphParams.daysBack,
      startDate: initialGraphParams.date,
      daysOfTheWeek: initialGraphParams.daysOfTheWeek,
    });
    handleClose(); // this forces the native date picker to reset, otherwise it doesn't stay in sync
  }

  /**
   * convert yyyy/mm/dd to mm/dd/yyyy
   */
  function convertDate(ymdString) {
    const date = new Date(ymdString);
    return `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}/${date
      .getUTCDate()
      .toString()
      .padStart(2, '0')}/${date.getUTCFullYear()}`;
  }

  // convert the state's current time range to a string or the sentinel value
  const timeRange =
    graphParams.startTime && graphParams.endTime
      ? `${graphParams.startTime}-${graphParams.endTime}`
      : TIME_RANGE_ALL_DAY;

  // these are the read-only representations of the date and time range
  let dateLabel = convertDate(graphParams.date);
  let rangeInfo = null;

  //
  // If a date range is set, either update the date label to the full
  // range if we support it, or else show an info icon that explains
  // that we are only showing one day's data.
  //

  if (graphParams.startDate !== graphParams.date) {
    if (dateRangeSupported) {

      dateLabel = convertDate(graphParams.startDate) + ' - ' + dateLabel;

    } else {

      rangeInfo =
        <Fragment>
          <IconButton size="small" color="inherit" onClick={handleInfoClick}>
            <InfoIcon fontSize="small" />
          </IconButton>
          <Popover
            open={Boolean(infoAnchorEl)}
            anchorEl={infoAnchorEl}
            onClose={handleInfoClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
          >
            <div className={classes.popover}>Date ranges are implemented for
            Dashboard statistics when a route, direction, and stops are selected.
            Currently showing data for one day.</div>
          </Popover>
        </Fragment>
    }
  }

  const timeLabel = TIME_RANGES.find(range => range.value === timeRange)
    .shortLabel;

  /**
   * Handler that takes the time range as a string and sets
   * the start and end time state.
   *
   * @param {any} myTimeRange
   */
  const setTimeRange = myTimeRange => {
    if (myTimeRange.target.value === TIME_RANGE_ALL_DAY) {
      applyGraphParams({ startTime: null, endTime: null });
    } else {
      const timeRangeParts = myTimeRange.target.value.split('-');
      applyGraphParams({
        startTime: timeRangeParts[0],
        endTime: timeRangeParts[1],
      });
    }
  };

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
      const startMoment = Moment(graphParams.startDate);

      const payload = {
        date: newDate
      };

      if (newMoment.isBefore(graphParams.startDate)) {
        payload.startDate = newDate;
      } else if (newMoment.diff(startMoment, 'days') > MAX_DATE_RANGE) {
        payload.startDate = newMoment.subtract(MAX_DATE_RANGE, 'days').format('YYYY-MM-DD');
      }
      applyGraphParams(payload);
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
      applyGraphParams({
        startDate: myDate.target.value,
      });
    }
  };

  const setDateRange = daysBack => {
    const date = initialGraphParams.date;
    const startMoment = Moment(date).subtract(daysBack - 1, 'days'); // include end date

    applyGraphParams({
      date: date,
      startDate: startMoment.format('YYYY-MM-DD'),
    });

    // The GraphQL api takes a list of dates, which are generated just before
    // calling the API.
  };

  const handleDayChange = event => {
    const day = event.target.value;
    const newDaysOfTheWeek = { ...graphParams.daysOfTheWeek };
    newDaysOfTheWeek[day] = event.target.checked;
    applyGraphParams({
      daysOfTheWeek: newDaysOfTheWeek,
    });
  };

  /**
   * Bulk toggle.
   */
  const toggleDays = event => {
    const what = event.target.value === 'weekdays' ? WEEKDAYS : WEEKENDS;

    const newDaysOfTheWeek = { ...graphParams.daysOfTheWeek };

    // If all false -> set all to true; some false/true -> set all true; all true -> set all false;
    // That is, if all true, set to all false, otherwise set to all true.

    const newValue = !allTrue(newDaysOfTheWeek, what);

    for (let i = 0; i < what.length; i++) {
      newDaysOfTheWeek[what[i].value] = newValue;
    }

    applyGraphParams({
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
    <div className={classes.root}>

      { props.isLoading
        ?
          <Box p={1}>
            <CircularProgress
              variant='indeterminate'
              disableShrink
              style={{color: 'white'}}
              size={24}
            />
          </Box>
        : null
      }

      { rangeInfo }
      <Button
        variant="contained"
        className={classes.button}
        onClick={handleClick}
      >
        <div className={classes.dateTime}>
          <span>
            <Typography className={classes.heading} display="inline">
              {dateLabel}&nbsp;
            </Typography>
            <Typography className={classes.secondaryHeading} display="inline">
              {timeLabel}
            </Typography>
          </span>
          <ExpandMoreIcon/>

        </div>
      </Button>

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
                  value={graphParams.startDate}
                  InputProps={{
                    inputProps: {
                      max: graphParams.date,
                      min: Moment(graphParams.date).subtract(MAX_DATE_RANGE, 'days').format('YYYY-MM-DD'),
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
                value={graphParams.date}
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
            <Grid container style={{maxWidth:250}}>
                {DATE_RANGES.map(range => (

                  <Grid item xs={6} key = {range.value}>
                  <Button
                    key={range.value}
                    onClick={ () => { setDateRange(range.value) } }
                  >
                  {range.label}
                  </Button>
                  </Grid>

                ))}
            </Grid>
          </ListItem>


          <ListItem>
            <FormControl component="fieldset" className={classes.formControl}>
              <FormLabel component="legend" className={classes.secondaryHeading}>Days of the Week</FormLabel>

              <Grid container>
                <Grid item>
                  <FormGroup>
                    <FormControlLabel
                      control={<Checkbox value="weekdays"
                        checked={!allFalse(graphParams.daysOfTheWeek, WEEKDAYS)}
                        indeterminate={!allFalse(graphParams.daysOfTheWeek, WEEKDAYS) &&
                          !allTrue(graphParams.daysOfTheWeek, WEEKDAYS)}
                        onChange={toggleDays} />}
                      label="Weekdays"
                    />

                    <Divider variant="middle" style={{ marginLeft: 0 } /* divider with a right margin */}/>

                    {WEEKDAYS.map(day =>
                      <FormControlLabel
                        control={<Checkbox checked={graphParams.daysOfTheWeek[day.value]} onChange={handleDayChange} value={day.value} />}
                        key={day.value}
                        label={day.label}
                      />)}
                  </FormGroup>
                </Grid>
                <Grid item>
                  <FormGroup>

                    <FormControlLabel
                      control={<Checkbox value="weekends"
                        checked={!allFalse(graphParams.daysOfTheWeek, WEEKENDS)}
                        indeterminate={!allFalse(graphParams.daysOfTheWeek, WEEKENDS) &&
                          !allTrue(graphParams.daysOfTheWeek, WEEKENDS)}
                        onChange={toggleDays} />}
                      label="Weekends"
                    />

                    <Divider variant="middle" style={{ marginLeft: 0 } /* divider with a right margin */}/>

                    {WEEKENDS.map(day =>
                      <FormControlLabel
                        control={<Checkbox checked={graphParams.daysOfTheWeek[day.value]} onChange={handleDayChange} value={day.value} />}
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
    </div>
  );
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
  isLoading: isLoadingRequest(state),
});

const mapDispatchToProps = dispatch => {
  return {
    handleGraphParams: params => dispatch(handleGraphParams(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DateTimePanel);
