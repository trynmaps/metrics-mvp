/**
 * Stop to stop trip summary component. 
 */
 
import React, { Fragment } from 'react';
import { getPercentileValue } from '../helpers/graphData';
import { PLANNING_PERCENTILE } from '../UIConstants';
import { milesBetween } from '../helpers/routeCalculations';

import {
Table,
TableBody,
TableCell,
TableRow,
Typography,
} from '@material-ui/core';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import InfoScoreCard from './InfoScoreCard';
import InfoScoreLegend from './InfoScoreLegend';
import {
  computeGrades,
  metersToMiles,
} from '../helpers/routeCalculations';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
export default function InfoTripSummary(props) {

  const { graphData, graphParams, routes } = props; 
  const waitTimes = graphData ? graphData.waitTimes : null;
  const tripTimes = graphData ? graphData.tripTimes : null;  
  
  const computeDistance = (graphParams, routes) => {
    let miles = 0;

    if (graphParams && graphParams.endStopId) {
      const directionId = graphParams.directionId;
      const routeId = graphParams.routeId;

      const route = routes.find(thisRoute => thisRoute.id === routeId);
      const directionInfo = route.directions.find(dir => dir.id === directionId);

      // if precomputed stop distance is available, use it
      
      if (directionInfo.stop_geometry[graphParams.startStopId] &&
          directionInfo.stop_geometry[graphParams.endStopId]) {
        let distance = directionInfo.stop_geometry[graphParams.endStopId].distance -
          directionInfo.stop_geometry[graphParams.startStopId].distance;
        return metersToMiles(distance);
      }
      
      const startIndex = directionInfo.stops.indexOf(graphParams.startStopId);
      const endIndex = directionInfo.stops.indexOf(graphParams.endStopId);

      for (let i = startIndex; i < endIndex; i++) {
        const fromStopInfo = route.stops[directionInfo.stops[i]];
        const toStopInfo = route.stops[directionInfo.stops[i + 1]];
        miles += milesBetween(fromStopInfo, toStopInfo);
      }
    }

    return miles;
  }

  const distance = routes ? computeDistance(graphParams, routes) : null;
  const speed =
    tripTimes && tripTimes.count > 0 && distance
      ? (distance / (tripTimes.avg / 60.0))
      : 0; // convert avg trip time to hours for mph

      
  let longWaitProbability = 0;
  if (waitTimes && waitTimes.histogram) {
    
    const reducer = (accumulator, currentValue, index) => {
      const LONG_WAIT = 20; // histogram bins are in minutes
      return currentValue.binStart >= LONG_WAIT
        ? accumulator + currentValue.count
        : accumulator;
    };
    
    longWaitProbability = waitTimes.histogram.reduce(reducer, 0);
    longWaitProbability /= waitTimes.count;
  }

  let travelVarianceTime = 0;
  if (tripTimes) {
    travelVarianceTime =
      getPercentileValue(tripTimes, PLANNING_PERCENTILE) - tripTimes.avg;
  }

  const grades = speed && waitTimes.median
  ? computeGrades(waitTimes.median, longWaitProbability, speed, travelVarianceTime)
  : null;
  
  let whyNoData = null;
  if (!distance) {
    whyNoData = 'Unable to determine distance between selected stops.';
  } else if (!tripTimes || !tripTimes.count) {
    whyNoData = 'No trip data between selected stops.';
  } else if (!speed) {
    whyNoData = 'Unable to determine speed between selected stops.';
  } else if (!waitTimes.median) {
    whyNoData = 'No median wait time available.';
  } 
  

  const useStyles = makeStyles(theme => ({
    uncolored: {
      margin: theme.spacing(1),
    },
  }));

  
  const classes = useStyles();

  const planningWait = Math.round(
      getPercentileValue(waitTimes, PLANNING_PERCENTILE));
  const planningTravel = Math.round(
      getPercentileValue(tripTimes, PLANNING_PERCENTILE));
  const typicalWait = Math.round(waitTimes.median);
  const typicalTravel = Math.round(tripTimes.median); // note: can have NaN issues here due to lack of trip data between stops


  const popoverContentTotalScore = grades
  ? <Fragment> 
    
    Trip score of { grades.totalScore } is the average of the following subscores:
      <Box pt={2}>
      <Table>
      <TableBody>
      <TableRow>
  
      <TableCell>
      Wait</TableCell><TableCell align="right">{grades.medianWaitScore}
      </TableCell>
      </TableRow>
      <TableRow>
      
      <TableCell>
      20 min wait</TableCell><TableCell align="right">{grades.longWaitScore}
      </TableCell>
      </TableRow>
      <TableRow>
  
      <TableCell>
      Median speed</TableCell><TableCell align="right"> {grades.speedScore}
      </TableCell>
      </TableRow>
      <TableRow>
  
      <TableCell>
      Extra travel</TableCell><TableCell align="right"> {grades.travelVarianceScore}
      </TableCell>
      </TableRow>
      </TableBody>
      </Table>
      </Box>
  </Fragment>
  : null;

  const popoverContentWait = grades
  ? <Fragment>
    Median wait of { waitTimes.median.toFixed(1) } min gets a score of {grades.medianWaitScore}.
    <Box pt={2}>
      <InfoScoreLegend rows={[
      { label: '5 min or less', value: 100 },
      { label: '6.25 min', value: 75 },
      { label: '7.5 min', value: 50 },
      { label: '8.75', value: 25 },
      { label: '10 min or more', value: 0 },
      ]}/>
    </Box>
  </Fragment>
  : null;

  
  const popoverContentLongWait = grades
  ? <Fragment>      
    20 min wait probability of { (longWaitProbability * 100).toFixed(1) /* be more precise than card */ }%
    gets a score of {grades.longWaitScore}.
    <Box pt={2}>
    <InfoScoreLegend rows={[
    { label: '10% or less', value: 100 },
    { label: '15.75%', value: 75 },
    { label: '21.5%', value: 50 },
    { label: '27.25%', value: 25 },
    { label: '33% or more', value: 0 },
    ]}/>
    </Box>
  </Fragment>
  : null;

  
  const popoverContentSpeed = grades
  ? <Fragment>
    Median speed of { speed.toFixed(1) /* be more precise here than card */ }
    {' '}mph gets a score of {grades.speedScore}.
    <Box pt={2}>
    <InfoScoreLegend rows={[
    { label: '10 mph or more', value: 100 },
    { label: '8.75 mph', value: 75 },
    { label: '7.5 mph', value: 50 },
    { label: '6.25 mph', value: 25 },
    { label: '5 mph or less', value: 0 },
    ]}/>
    </Box>
  </Fragment>
  : null;
  
  const popoverContentTravelVariance = grades
  ? <Fragment>
    Extra travel time of { planningTravel - typicalTravel } min gets a score of {grades.travelVarianceScore}.
    <Box pt={2}>
    <InfoScoreLegend rows={[
    { label: '5 min or less', value: 100 },
    { label: '6.25 min', value: 75 },
    { label: '7.5 min', value: 50 },
    { label: '8.75 min', value: 25 },
    { label: '10 min or more', value: 0 },
    ]}/>
    </Box>
  </Fragment>
  : null;
  
  return (
    <Fragment>
      <div style={{ padding: 8 }}>

      { grades ? 
      <Fragment>

          
        <Grid container spacing={4}> {/* spacing doesn't work exactly right here, just pads the Papers */}
          
          <Grid item xs component={Paper} className={classes.uncolored}>
              <Typography variant="overline">90% of trips</Typography>
              <br />

              <Typography variant="h3" display="inline">
                { planningWait + planningTravel }
              </Typography>
              <Typography variant="h5" display="inline">
                &nbsp;min
              </Typography>

              <Box pt={2}>
                <Typography variant="body1">
                  
                { planningWait } min wait + { planningTravel } min
                  
                </Typography>
              </Box>
          </Grid>

          <Grid item xs component={Paper} className={classes.uncolored}>
              <Typography variant="overline">typical trip</Typography>
              <br />

              <Typography variant="h3" display="inline">
                { typicalWait + typicalTravel }
              </Typography>
              <Typography variant="h5" display="inline">
                &nbsp;min
              </Typography>

              <Box pt={2}>
                <Typography variant="body1">
                  
                { typicalWait } min wait + { typicalTravel } min
                  
                </Typography>
              </Box>
          </Grid>

          <InfoScoreCard
            grades={ grades }
            gradeName={ 'totalScore' }
            hideRating={ true }
            title={ 'Trip Score' }
            largeValue={ grades ? grades.totalScore : '--'}
            smallValue={'/' + (grades ? grades.highestPossibleScore : '--')}
            bottomContent='&nbsp;'
            popoverContent={ popoverContentTotalScore }
          />

          <InfoScoreCard
            grades={ grades }
            gradeName={ 'medianWaitScore' }
            title={ 'Median Wait' }
            largeValue={ Math.round(waitTimes.median) }
            smallValue='&nbsp;min' 
            bottomContent='&nbsp;'
            popoverContent={ popoverContentWait }
          />

          <InfoScoreCard
            grades={ grades }
            gradeName={ 'longWaitScore' }
            title={ '20 Min Wait' }
            largeValue={ Math.round(longWaitProbability * 100) }
            smallValue='%' 
            bottomContent={
                longWaitProbability > 0
                ? `1 time out of ${Math.round(1 / longWaitProbability)}`
                : ''
            }
            popoverContent={ popoverContentLongWait }
          />

          <InfoScoreCard
            grades={ grades }
            gradeName={ 'speedScore' }
            title={ 'Median Speed' }
            largeValue={ speed.toFixed(0) }
            smallValue='&nbsp;mph' 
            bottomContent={ distance.toFixed(1) + ' miles' }
            popoverContent={ popoverContentSpeed }
          />

          <InfoScoreCard
            grades={ grades }
            gradeName={ 'travelVarianceScore' }
            title={ 'Extra Travel' }
            largeValue={ planningTravel - typicalTravel }
            smallValue='&nbsp;min' 
            bottomContent={ 'In ' + PLANNING_PERCENTILE + '% of trips' }
            popoverContent={ popoverContentTravelVariance }
          />
        </Grid>
      </Fragment>
            
      : 'No trip summary (' + whyNoData + ')'} 
      
      </div>
    </Fragment>
  )
}
