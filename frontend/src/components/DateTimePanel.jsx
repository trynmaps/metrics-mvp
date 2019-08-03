import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import { handleGraphParams } from '../actions';
import { connect } from 'react-redux';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import { List, ListItem } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import { TIME_RANGES, TIME_RANGE_ALL_DAY } from '../UIConstants';
import { initialState } from '../reducers/routesReducer';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';

const useStyles = makeStyles(theme => ({
  button: {
    textTransform: 'none',
    display: 'flex',
    justifyContent: 'flex-start',
    width: '400px',
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
  
  const {graphParams} = props; 
  
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
      start_time: initialParams.start_time,
      end_time: initialParams.end_time,
    });
    handleClose(); // this forces the native date picker to reset, otherwise it doesn't stay in sync 
  }
  
  /**
   * convert yyyy/mm/dd to mm/dd/yyyy
   */
  function convertDate(ymdString) {

    const date = new Date(ymdString);
    return (date.getUTCMonth()+1).toString().padStart(2, '0') + '-' +
      date.getUTCDate().toString().padStart(2, '0') + '-' +
      date.getUTCFullYear();
  }
  
  // convert the state's current time range to a string or the sentinel value 
  const timeRange =
    graphParams.start_time && graphParams.end_time
      ? `${graphParams.start_time}-${graphParams.end_time}`
      : TIME_RANGE_ALL_DAY;

  // these are the read-only representations of the date and time range
  const dateLabel = convertDate(graphParams.date);
  const timeLabel = TIME_RANGES.find(range => range.value === timeRange).shortLabel;
  
  /**
   * Handler that takes the time range as a string and sets 
   * the start and end time state.
   * 
   * @param {any} myTimeRange
   */
  const setTimeRange = myTimeRange => {
    if (myTimeRange.target.value === TIME_RANGE_ALL_DAY) {
      props.handleGraphParams({ start_time: null, end_time: null });
    } else {
      const timeRangeParts = myTimeRange.target.value.split('-');
      props.handleGraphParams({
        start_time: timeRangeParts[0],
        end_time: timeRangeParts[1],
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
        date: myDate.target.value
      });
    }
  };
  
  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  return (
    <div className={classes.root}>
      <Button variant="contained" className={classes.button} onClick={handleClick}>
      <div className={classes.column}>
      <Typography className={classes.secondaryHeading}>Date-Time Range</Typography>
      </div>
      <div>
      <Typography className={classes.heading} display="inline">
        {dateLabel}&nbsp;
      </Typography>
      <Typography className={classes.secondaryHeading} display="inline">
        {timeLabel}
        <ExpandMoreIcon/>
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

        
      <IconButton size="small" aria-label="close" className={classes.closeButton} onClick={handleClose}>
        <CloseIcon />
      </IconButton>
      <br/>
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
          { TIME_RANGES.map(range => <MenuItem value={range.value} key={range.value}>{range.shortLabel}{range.restOfLabel}</MenuItem>) }
          </Select>
        </FormControl>
      </ListItem>
      <ListItem>
        <Button onClick={handleReset}>
          Reset
        </Button>            
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
