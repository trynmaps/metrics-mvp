import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import { connect } from 'react-redux';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import { List, ListItem } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import Moment from 'moment';
import { TIME_RANGES, TIME_RANGE_ALL_DAY } from '../UIConstants';
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
    margin: theme.spacing(1),
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
    });
    handleClose(); // this forces the native date picker to reset, otherwise it doesn't stay in sync
  }


  function setTimeAndDateToNow() {
    /** Sets the date as today
    * Gets the current time, sets start and end time as the
    * the corresponding members of TIME_RANGES
    */

    const date = Moment(Date.now());

    const currentDate =  date.format('YYYY-MM-DD');
    const hour = parseInt(date.format("HH"))

    var startTime = null;
    var endTime = null;

    // Hard-code handling of early morning
    if (hour < 3 || hour >= 19) {
      startTime = TIME_RANGES[6].value.split("-")[0]
      endTime = TIME_RANGES[6].value.split("-")[1]
    }
    else {
      // First two of TIME_RANGES are not applicable
      const possibleTimes = TIME_RANGES.slice(2,6).map(x => parseInt(x.value.slice(0,2)))

      var correspondingTimeRange = null
      possibleTimes.forEach(function(element, i) {
        if (hour >= element) {
          correspondingTimeRange = i
        }
      });

      correspondingTimeRange = TIME_RANGES[correspondingTimeRange+2].value
      startTime = correspondingTimeRange.split("-")[0]
      endTime = correspondingTimeRange.split("-")[1]
    }

    props.handleGraphParams({
      date: currentDate,
      startTime: startTime,
      endTime: endTime,
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
                className={classes.textField}
                InputLabelProps={{
                  shrink: true,
                }}
                onChange={setDate}
              />
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
            <Button onClick={setTimeAndDateToNow} color="secondary">Today</Button>
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
