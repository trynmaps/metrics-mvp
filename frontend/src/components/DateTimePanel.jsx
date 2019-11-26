import React, { useState, Fragment } from 'react';
import Moment from 'moment';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';      
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Popover from '@material-ui/core/Popover';
import { connect } from 'react-redux';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import DateTimePopover from './DateTimePopover';
import InfoIcon from '@material-ui/icons/InfoOutlined';

import {
  TIME_RANGES, TIME_RANGE_ALL_DAY,
} from '../UIConstants';
import { isLoadingRequest } from '../reducers/loadingReducer';
import { handleGraphParams } from '../actions';
import { getDaysOfTheWeekLabel } from '../helpers/dateTime';

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
  const { graphParams, onGraphParams, dateRangeSupported } = props;

  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [infoAnchorEl, setInfoAnchorEl] = useState(null);

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }
  
  function handleInfoClick(event) {
    setInfoAnchorEl(event.currentTarget);
  }

  function handleInfoClose() {
    setInfoAnchorEl(null);
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

  let rangeInfo = null;
  
  //
  // If a date range is set, either update the date label to the full
  // range if we support it, or else show an info icon that explains
  // that we are only showing one day's data.
  //
  
  if ((graphParams.firstDateRange.startDate !== graphParams.firstDateRange.date) ||
      (graphParams.secondDateRange && graphParams.secondDateRange.startDate !== graphParams.secondDateRange.date)) {
      
    if (!dateRangeSupported) {
      
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

  /**
   * @param {Object} props Object including a "target" indicating which field
   *   in graphParams this is for. 
   */
  function DatePanelButton(props) {
    const target = props.target;
    

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
    
    const dateRangeParams = graphParams[target];

    // these are the read-only representations of the date and time range
    let dateLabel = convertDate(dateRangeParams.date);
    let smallLabel = '';
    
    if (dateRangeParams.startDate !== dateRangeParams.date) {
      dateLabel = convertDate(dateRangeParams.startDate) + ' - ' + dateLabel;
      
      // generate a days of the week label
    
      smallLabel = getDaysOfTheWeekLabel(dateRangeParams.daysOfTheWeek) + ', ';      
    }
      

    
    // convert the state's current time range to a string or the sentinel value
    const timeRange =
      dateRangeParams.startTime && dateRangeParams.endTime
        ? `${dateRangeParams.startTime}-${dateRangeParams.endTime}`
        : TIME_RANGE_ALL_DAY;

    smallLabel += TIME_RANGES.find(range => range.value === timeRange)
      .shortLabel;

    return (
      <Fragment>

      <Button
        variant="contained"
        className={classes.button}
        onClick={handleClick}
        id={target}
      >
        <div className={classes.nowrap}>
          <Typography className={classes.heading} display="inline">
            {dateLabel}&nbsp;
          </Typography>
          <Typography className={classes.secondaryHeading} display="inline">
            {smallLabel}
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

      { firstButton }
      &nbsp;
      { secondButton }

      <DateTimePopover anchorEl={anchorEl} setAnchorEl={setAnchorEl}/>
    </div>
  );
}

const mapStateToProps = state => ({
  graphParams: state.routes.graphParams,
  isLoading: isLoadingRequest(state), 
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
