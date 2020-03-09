/**
 * Card for displaying one metric.
 */

import React, { Fragment, useState } from 'react';

// import Chip from '@material-ui/core/Chip';
import { Typography } from '@material-ui/core';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Popover from '@material-ui/core/Popover';
import { makeStyles } from '@material-ui/core/styles';
// import red from '@material-ui/core/colors/red'; // delta worse
// import green from '@material-ui/core/colors/green'; // delta better
import InfoIcon from '@material-ui/icons/InfoOutlined';
import Rating from '@material-ui/lab/Rating';
import Box from '@material-ui/core/Box';
import {
  // scoreBackgroundColor,
  scoreContrastColor,
} from '../helpers/routeCalculations';
import { NO_VALUE } from '../UIConstants';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
export default function InfoScoreCard(props) {
  const {
    score,
    higherIsBetter,
    hideRating,
    preserveRatingSpace,
    title,
    firstValue,
    secondValue,
    valuePrefix,
    valueSuffix,
    bottomContent,
    popoverContent,
  } = props;

  const useStyles = makeStyles(theme => ({
    popover: {
      padding: theme.spacing(2),
      maxWidth: 500,
    },
  }));

  const classes = useStyles();

  const [anchorEl, setAnchorEl] = useState(null);

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function percentDifference(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) {
      return '--';
    }
    if (a === 0 && b === 0) {
      return 0;
    }
    if (a === 0) {
      return -100;
    }
    if (b === 0) {
      return 100;
    }
    return (100 * (1 - b / a)).toFixed(0);
  }

  function percentContent(a, b, myScore) {
    const percent = percentDifference(a, b);
    const differenceColor = scoreContrastColor(
      /* 0 */ myScore,
      percent,
      higherIsBetter,
    );

    return (
      <>
        <Typography
          variant="h4"
          style={{ color: differenceColor }}
          display="inline"
        >
          {percent}
        </Typography>
        <Typography
          variant="h5"
          style={{ color: differenceColor }}
          display="inline"
        >
          %
        </Typography>
      </>
    );

    /*    
           
    return  <Chip
      style={{
        color: scoreContrastColor(score),
        backgroundColor: 'white',//scoreBackgroundColor(score),
      }}
      label={<>
    <Typography variant="h4" style={{color:differenceColor}} display="inline">
    {percent}
    </Typography>
      <Typography variant="h5" style={{color:differenceColor}} display="inline">
        %
      </Typography>
      </>
      }
      /> */
  }

  const cardStyle = {
    background: 'white', // score !== NO_VALUE ? scoreBackgroundColor(score) : 'white',
    color: score !== NO_VALUE ? scoreContrastColor(0 /* score */) : 'black',
    width: '100%',
    height: '100%',
    display: 'inline-block',
  };

  const rating =
    score != null ? Math.max(Math.round(score / 10.0) / 2.0, 0.5) : 0;

  // NO_VALUE is overloaded as both a display string and a special case signifier.
  // Here, if it passed in as the second value, it means that we are not comparing
  // values.  Otherwise, we are comparing values that are possibly null, like a missing
  // score, or possibly undefined).

  const hasSecondValue = secondValue !== NO_VALUE;
  const largeContent = hasSecondValue ? (
    percentContent(firstValue, secondValue, 0 /* score */)
  ) : (
    <Fragment>
      <Typography variant="h4" display="inline">
        {valuePrefix || null}
        {firstValue === null ? NO_VALUE : firstValue}
      </Typography>
      <Typography variant="h5" display="inline">
        {valueSuffix}
      </Typography>
    </Fragment>
  );

  return (
    <Fragment>
      {/* This width needs to be large enough to prevent wrapping in any card */}
      <Box
        width={200}
        style={{ display: 'inline-block', padding: 0, margin: 4 }}
      >
        <Paper style={cardStyle}>
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="flex-start"
            m={2}
          >
            <Typography variant="overline">{title}</Typography>

            <Box flexGrow={1}>
              {' '}
              {/* middle area takes all possible height */}
              {largeContent}
              {hasSecondValue ? (
                <Typography variant="body2">
                  {/* <Chip
      style={{
        color: scoreContrastColor(score),
        backgroundColor: scoreBackgroundColor(score),
      }}
      label={`${valuePrefix ? valuePrefix:''}${firstValue}${valueSuffix}`}
    /> */}
                  {valuePrefix}
                  {firstValue}
                  {valueSuffix}
                  &nbsp;vs {valuePrefix}
                  {secondValue}
                  {valueSuffix}
                </Typography>
              ) : null}
              {hideRating ? null : (
                <Rating readOnly size="small" value={rating} precision={0.5} />
              )}
              {/* This is quick way to maintain the same 18 pixels of height so that
                route summary cards are the same height */}
              {preserveRatingSpace ? (
                <div
                  className="MuiSvgIcon-root MuiSvgIcon-fontSizeInherit"
                  style={{ display: 'block' }}
                >
                  &nbsp;
                </div>
              ) : null}
            </Box>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="flex-end"
              pt={2}
            >
              {bottomContent}
              <IconButton size="small" onClick={handleClick}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <div className={classes.popover}>{popoverContent}</div>
      </Popover>
    </Fragment>
  );
}
