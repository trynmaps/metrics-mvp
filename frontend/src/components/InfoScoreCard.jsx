/**
 * Card for displaying one metric.
 */
 
import React, { Fragment, useState } from 'react';

import { Typography } from '@material-ui/core';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton'
import Paper from '@material-ui/core/Paper';
import Popover from '@material-ui/core/Popover';
import { makeStyles } from '@material-ui/core/styles';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import Rating from '@material-ui/lab/Rating';
import Box from '@material-ui/core/Box';
import {
  quartileBackgroundColor,
  quartileForegroundColor,
} from '../helpers/routeCalculations';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
export default function InfoScoreCard(props) {

  const {
    grades,
    gradeName,
    hideRating,
    title,
    largeValue,
    smallValue,
    bottomContent,
    popoverContent,
  } = props;

  const useStyles = makeStyles(theme => ({
    popover: {
        padding: theme.spacing(2),
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
  
  const cardStyle = (grades, gradeName) => {
    return {
      background:
        grades
          ? quartileBackgroundColor(grades[gradeName] / 100.0)
          : 'gray',
      color:
        grades
          ? quartileForegroundColor(grades[gradeName] / 100.0)
          : 'black',
      margin: 4
    }
  };
  
  
  const rating = grades ? Math.max(Math.round(grades[gradeName] / 10.0) / 2.0, 0.5) : 0;
  
  return (
    <Fragment>
      <Grid item xs component={Paper} style={cardStyle(grades, gradeName)}>
        <Box display="flex" flexDirection="column" justifyContent="flex-start" height="100%">                  
          <Typography variant="overline">
            {title}
          </Typography>
              
          <Box flexGrow={1}> {/* middle area takes all possible height */}

            <Typography variant="h3" display="inline">
              {largeValue}  
            </Typography>

            <Typography variant="h5" display="inline">
              {smallValue}
            </Typography>

            { hideRating ? null : <Rating
              readOnly
              size="small"
              value={rating}
              precision={0.5}
              />}
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="flex-end" pt={2}>
            {bottomContent}
            <IconButton size='small' onClick={handleClick} ><InfoIcon fontSize='small'/></IconButton>                  
          </Box>
        </Box>
      </Grid>
                
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
        <div className={classes.popover}>
          {popoverContent}
        </div>
      </Popover>  
    </Fragment>     
  )      
}
