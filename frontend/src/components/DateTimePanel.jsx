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
    minWidth: 120,
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

  
  const timeRange =
    graphParams.start_time || graphParams.end_time
      ? `${graphParams.start_time}-${graphParams.end_time}`
      : '';

  const setTimeRange = myTimeRange => {
    if (!myTimeRange) {
      props.handleGraphParams({ start_time: null, end_time: null });
    } else {
      const timeRangeParts = myTimeRange.target.value.split('-');
      props.handleGraphParams({
        start_time: timeRangeParts[0],
        end_time: timeRangeParts[1],
      });
    }
  };  

  const setDate = myDate => {
    if (!myDate.target.value) {
      // ignore bad date, could revert to default.
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
      <Typography className={classes.heading}>
        {graphParams.date}&nbsp;
        {graphParams.start_time ? graphParams.start_time : "All day"}
        {graphParams.end_time ? ' - ' + graphParams.end_time : ""}
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
            <MenuItem value="">All Day</MenuItem>
            <MenuItem value="07:00-19:00">Daytime (7AM - 7PM)</MenuItem>
            <MenuItem value="03:00-07:00">Early Morning (3AM - 7AM)</MenuItem>
            <MenuItem value="07:00-10:00">AM Peak (7AM - 10AM)</MenuItem>
            <MenuItem value="10:00-15:00">Midday (10AM - 4PM)</MenuItem>
            <MenuItem value="16:00-19:00">PM Peak (4PM - 7PM)</MenuItem>
            <MenuItem value="19:00-03:00+1">
              Late Evening (7PM - 3AM)
            </MenuItem>
          </Select>
        </FormControl>
      </ListItem>
      <ListItem>
        <Button onClick={handleClose} color="primary">
          Close
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
