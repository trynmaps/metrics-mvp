import React from 'react';
import Moment from 'moment';
import { makeStyles } from '@material-ui/core/styles';
import Checkbox from '@material-ui/core/Checkbox';
import Collapse from '@material-ui/core/Collapse';
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
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import { TIME_RANGES, TIME_RANGE_ALL_DAY, DATE_RANGES,
  CUSTOM_DATE_RANGE, MAX_DATE_RANGE, WEEKDAYS, WEEKENDS } from '../UIConstants';
import { initialState } from '../reducers/routesReducer';
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
  nowrap: {
    whiteSpace: 'nowrap',
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
  const { graphParams } = props;
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const maxDate = Moment(Date.now()).format('YYYY-MM-DD');

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleReset() {
    const initialParams = initialState.graphParams;
    props.handleGraphParams({
      date: initialParams.date,
      startTime: initialParams.startTime,
      endTime: initialParams.endTime,
      daysBack: initialParams.daysBack,
      startDate: initialParams.date,
      daysOfTheWeek: initialParams.daysOfTheWeek,
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
  const dateLabel = convertDate(graphParams.date);
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
      props.handleGraphParams({ startTime: null, endTime: null });
    } else {
      const timeRangeParts = myTimeRange.target.value.split('-');
      props.handleGraphParams({
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
      props.handleGraphParams({
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
      props.handleGraphParams({
        startDate: myDate.target.value,
      });
    }
  };
    
  // daysBack is for preserving radio button state.
  const setDateRange = event => {
    
    const daysBack = event.target.value;
    
    props.handleGraphParams({
      daysBack: daysBack,
    });
    
    // The GraphQL api takes a list of dates, which are generated just before
    // calling the API.
  };

  const handleDayChange = event => {
    const day = event.target.value;
    const newDaysOfTheWeek = { ...graphParams.daysOfTheWeek};
    newDaysOfTheWeek[day] = event.target.checked; 
    props.handleGraphParams({
      daysOfTheWeek: newDaysOfTheWeek,
    });
  };
  
  /**
   * Bulk toggle.
   */
  const toggleDays = event => {
    const what = event.target.value === 'weekdays' ? WEEKDAYS : WEEKENDS;
    
    const newDaysOfTheWeek = { ...graphParams.daysOfTheWeek};

    // If all false -> set all to true; some false/true -> set all true; all true -> set all false;
    // That is, if all true, set to all false, otherwise set to all true.

    const newValue = !allTrue(newDaysOfTheWeek, what);
    
    for (let i = 0; i < what.length; i++) {
      newDaysOfTheWeek[what[i].value] = newValue;
    }
    
    props.handleGraphParams({
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
      <Button
        variant="contained"
        className={classes.button}
        onClick={handleClick}
      >
        <div className={classes.column}>
          <Typography className={classes.secondaryHeading}>
            Date-Time Range&nbsp;
          </Typography>
        </div>
        <div className={classes.nowrap}>
          <Typography className={classes.heading} display="inline">
            {dateLabel}&nbsp;
          </Typography>
          <Typography className={classes.secondaryHeading} display="inline">
            {timeLabel}
            <ExpandMoreIcon />
          </Typography>
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
        <br />
        <List style={{ color: 'black' }}>
          <ListItem>
            <FormControl className={classes.formControl}>
              <TextField
                id="date"
                label="Date"
                type="date"
                defaultValue={graphParams.date}
                InputProps={{
                  inputProps:{
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
                value={graphParams.daysBack}
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
          
          <Collapse in={graphParams.daysBack === CUSTOM_DATE_RANGE}>
            <ListItem>
              <FormControl className={classes.formControl}>
                <TextField
                  id="startDate"
                  label="Start Date"
                  type="date"
                  defaultValue={graphParams.startDate}
                  InputProps={{
                    inputProps:{
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
          </Collapse>
          
          <ListItem>          
          <FormControl component="fieldset" className={classes.formControl}>
            <FormLabel component="legend" className={classes.secondaryHeading}>Days of the Week</FormLabel>
            
            <Grid container>
            <Grid item>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox value="weekdays"
                checked={ !allFalse(graphParams.daysOfTheWeek, WEEKDAYS) }
                indeterminate={ !allFalse(graphParams.daysOfTheWeek, WEEKDAYS) &&
                  !allTrue(graphParams.daysOfTheWeek, WEEKDAYS) } 
                onChange={toggleDays} />}
                label="Weekdays"
             />
            
              {WEEKDAYS.map(day =>
              <FormControlLabel
                control={<Checkbox checked={ graphParams.daysOfTheWeek[day.value] } onChange={handleDayChange} value={day.value} />}
                key={day.value}
                label={day.label}
             />)}
             </FormGroup>
             </Grid>
             <Grid item>
             <FormGroup>
             
              <FormControlLabel
                control={<Checkbox value="weekends"
                checked={ !allFalse(graphParams.daysOfTheWeek, WEEKENDS) }
                indeterminate={ !allFalse(graphParams.daysOfTheWeek, WEEKENDS) &&
                  !allTrue(graphParams.daysOfTheWeek, WEEKENDS) } 
                onChange={toggleDays} />}                
                label="Weekends"
             />
            
              {WEEKENDS.map(day =>
              <FormControlLabel
                control={<Checkbox checked={ graphParams.daysOfTheWeek[day.value] } onChange={handleDayChange} value={day.value} />}
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
)(DateTimePanel);
