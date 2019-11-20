import React, { Fragment } from 'react';
import Moment from 'moment';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import { connect } from 'react-redux';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import DateTimePopover from './DateTimePopover';
import {
  TIME_RANGES, TIME_RANGE_ALL_DAY,
  CUSTOM_DATE_RANGE,
} from '../UIConstants';
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
  const { graphParams, onGraphParams } = props;

  
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }
  
  function handleRemove() {
    onGraphParams({ secondDateRange: null });
  }

  /**
   * convert yyyy/mm/dd to mm/dd/yyyy
   */
  function convertDate(ymdString) {
    return Moment(ymdString).format('MM/DD/YYYY');
  }

  const firstOpen = Boolean(anchorEl) && anchorEl.id === 'firstDateRange';
  const secondOpen = Boolean(anchorEl) && anchorEl.id === 'secondDateRange';

  /**
   * @param {Object} props Object including a "target" indicating which field
   *   in graphParams this is for. 
   */
  function DatePanelButton(props) {
    const target = props.target;
    
    const dateRangeParams = graphParams[target];

    // short circuit to a placeholder button if second range is null
    
    if (target === "secondDateRange" && graphParams.secondDateRange === null) {
      return (
        <Button
          variant="contained"
          className={classes.button}
          onClick={handleClick}
          id={target}
        >
          <Typography className={classes.secondaryHeading}>
             Compare Dates
          </Typography>
          { secondOpen ? <ExpandLessIcon /> : <ExpandMoreIcon /> } 
        </Button>
      )
    }

    // convert the state's current time range to a string or the sentinel value
    const timeRange =
      dateRangeParams.startTime && dateRangeParams.endTime
        ? `${dateRangeParams.startTime}-${dateRangeParams.endTime}`
        : TIME_RANGE_ALL_DAY;

    // these are the read-only representations of the date and time range
    let dateLabel = convertDate(dateRangeParams.date);
  
    if (dateRangeParams.daysBack === CUSTOM_DATE_RANGE) {
      dateLabel = convertDate(dateRangeParams.startDate) + ' - ' + dateLabel; 
    } else if (dateRangeParams.daysBack !== '1') {
      const startMoment = Moment(dateRangeParams.date).subtract(Number.parseInt(dateRangeParams.daysBack) - 1, 'days');
      dateLabel = startMoment.format('MM/DD/YYYY') + ' - ' + dateLabel; 
    }
  
    const timeLabel = TIME_RANGES.find(range => range.value === timeRange)
      .shortLabel;
    
    
    return (
      <Fragment>
      <Button
        variant="contained"
        className={classes.button}
        onClick={handleClick}
        id={target}
      >
        <div className={classes.column}>
          {/*<Typography className={classes.secondaryHeading}>
            Date-Time Range&nbsp;
          </Typography> */}
        </div>
        <div className={classes.nowrap}>
          <Typography className={classes.heading} display="inline">
            {dateLabel}&nbsp;
          </Typography>
          <Typography className={classes.secondaryHeading} display="inline">
            {timeLabel}
            { (target==="firstDateRange" && firstOpen) || (target==="secondDateRange" && secondOpen) ? <ExpandLessIcon /> : <ExpandMoreIcon /> } 
          </Typography>
        </div>
      </Button>
      { (target==="secondDateRange")
         ? <IconButton color="inherit" size="small" onClick={ handleRemove } aria-label="Remove"><RemoveCircleOutlineIcon/></IconButton>
         : null
      }
      </Fragment> 
    );
  }
  
   // For some reason, invoking this as a component causes anchorEl not to have a bounding box
   // and thus the popover appears at the upper left corner of the window.  So invoking it as
   // just a plain old function instead.
   
  const firstButton = DatePanelButton({ target: 'firstDateRange' });
  const secondButton = DatePanelButton({ target: 'secondDateRange' });
  
  return (
    <div className={classes.root}>

      { firstButton }
      &nbsp;
      { secondButton }

      <DateTimePopover anchorEl={anchorEl} setAnchorEl={setAnchorEl}/>
    </div>
  );
}

const mapStateToProps = state => ({
  graphParams: state.routes.graphParams,
});

const mapDispatchToProps = dispatch => {
  return {
    onGraphParams: params => dispatch(handleGraphParams(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DateTimePanel);
