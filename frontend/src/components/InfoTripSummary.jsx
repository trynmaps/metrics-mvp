/**
 * Stop to stop trip summary component.
 */

import React, { Fragment, useState } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@material-ui/core';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Popover from '@material-ui/core/Popover';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import StartStopIcon from '@material-ui/icons/DirectionsTransit';
import WatchLaterOutlinedIcon from '@material-ui/icons/WatchLaterOutlined';
import { computeGrades } from '../helpers/routeCalculations';
import { getDistanceInMiles } from '../helpers/mapGeometry';
import { PLANNING_PERCENTILE, TENTH_PERCENTILE } from '../UIConstants';
import { getPercentileValue } from '../helpers/graphData';
import InfoScoreCard from './InfoScoreCard';
import InfoScoreLegend from './InfoScoreLegend';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
export default function InfoTripSummary(props) {
  const [typicalAnchorEl, setTypicalAnchorEl] = useState(null);
  const [planningAnchorEl, setPlanningAnchorEl] = useState(null);

  function handleTypicalClick(event) {
    setTypicalAnchorEl(event.currentTarget);
  }

  function handleTypicalClose() {
    setTypicalAnchorEl(null);
  }

  function handlePlanningClick(event) {
    setPlanningAnchorEl(event.currentTarget);
  }

  function handlePlanningClose() {
    setPlanningAnchorEl(null);
  }

  const { graphData, graphParams, routes } = props;
  const waitTimes = graphData ? graphData.waitTimes : null;
  const tripTimes = graphData ? graphData.tripTimes : null;

  const computeDistance = (myGraphParams, myRoutes) => {
    if (myGraphParams && myGraphParams.endStopId) {
      const directionId = myGraphParams.directionId;
      const routeId = myGraphParams.routeId;
      const route = myRoutes.find(thisRoute => thisRoute.id === routeId);
      const directionInfo = route.directions.find(
        dir => dir.id === directionId,
      );
      return getDistanceInMiles(
        route,
        directionInfo,
        myGraphParams.startStopId,
        myGraphParams.endStopId,
      );
    }
    return 0;
  };

  const distance = routes ? computeDistance(graphParams, routes) : null;

  const speed =
    tripTimes && tripTimes.count > 0 && distance
      ? distance / (tripTimes.avg / 60.0)
      : 0; // convert avg trip time to hours for mph

  let longWaitProbability = 0;
  if (waitTimes && waitTimes.histogram) {
    const reducer = (accumulator, currentValue) => {
      const LONG_WAIT = 20; // histogram bins are in minutes
      return currentValue.binStart >= LONG_WAIT
        ? accumulator + currentValue.count
        : accumulator;
    };

    longWaitProbability = waitTimes.histogram.reduce(reducer, 0) / 100;
  }

  let travelVariabilityTime = 0;
  if (tripTimes) {
    travelVariabilityTime =
      (getPercentileValue(tripTimes, PLANNING_PERCENTILE) -
        getPercentileValue(tripTimes, TENTH_PERCENTILE)) /
      2.0;
  }

  const grades =
    speed && waitTimes.median
      ? computeGrades(
          waitTimes.median,
          longWaitProbability,
          speed,
          travelVariabilityTime,
        )
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
    popover: {
      padding: theme.spacing(2),
      maxWidth: 500,
    },
  }));

  const classes = useStyles();

  const planningWait = Math.round(
    getPercentileValue(waitTimes, PLANNING_PERCENTILE),
  );
  const planningTravel = Math.round(
    getPercentileValue(tripTimes, PLANNING_PERCENTILE),
  );
  const travelVariability = Math.round(
    (getPercentileValue(tripTimes, PLANNING_PERCENTILE) -
      getPercentileValue(tripTimes, TENTH_PERCENTILE)) /
      2.0,
  );

  const typicalWait = Math.round(waitTimes.median);
  const typicalTravel = Math.round(tripTimes.median); // note: can have NaN issues here due to lack of trip data between stops

  const popoverContentTotalScore = grades ? (
    <Fragment>
      Trip score of {grades.totalScore} is the average of the following
      subscores:
      <Box pt={2}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Median wait</TableCell>
              <TableCell align="right">{grades.medianWaitScore}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Long wait probability</TableCell>
              <TableCell align="right">{grades.longWaitScore}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Speed for median trip</TableCell>
              <TableCell align="right"> {grades.speedScore}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Travel time variability</TableCell>
              <TableCell align="right"> {grades.travelVarianceScore}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </Fragment>
  ) : null;

  const popoverContentWait = grades ? (
    <Fragment>
      Median wait of {waitTimes.median.toFixed(1)} min gets a score of{' '}
      {grades.medianWaitScore}.
      <Box pt={2}>
        <InfoScoreLegend
          rows={[
            { label: '5 min or less', value: 100 },
            { label: '6.25 min', value: 75 },
            { label: '7.5 min', value: 50 },
            { label: '8.75', value: 25 },
            { label: '10 min or more', value: 0 },
          ]}
        />
      </Box>
    </Fragment>
  ) : null;

  const popoverContentLongWait = grades ? (
    <Fragment>
      Long wait probability is the chance a rider has of a wait of twenty
      minutes or longer after arriving randomly at the "from" stop. Probability
      of{' '}
      {(longWaitProbability * 100).toFixed(1) /* be more precise than card */}%
      gets a score of {grades.longWaitScore}.
      <Box pt={2}>
        <InfoScoreLegend
          rows={[
            { label: '10% or less', value: 100 },
            { label: '15.75%', value: 75 },
            { label: '21.5%', value: 50 },
            { label: '27.25%', value: 25 },
            { label: '33% or more', value: 0 },
          ]}
        />
      </Box>
    </Fragment>
  ) : null;

  const popoverContentSpeed = grades ? (
    <Fragment>
      Speed for median trip of {speed.toFixed(1)} mph gets a score of{' '}
      {grades.speedScore}.
      <Box pt={2}>
        <InfoScoreLegend
          rows={[
            { label: '10 mph or more', value: 100 },
            { label: '8.75 mph', value: 75 },
            { label: '7.5 mph', value: 50 },
            { label: '6.25 mph', value: 25 },
            { label: '5 mph or less', value: 0 },
          ]}
        />
      </Box>
    </Fragment>
  ) : null;

  const popoverContentTravelVariability = grades ? (
    <Fragment>
      Travel time variability is the 90th percentile travel time minus the 10th
      percentile travel time. This measures how much extra travel time is needed
      for some trips. Variability of{' '}
      {`\u00b1${travelVariabilityTime.toFixed(1)}`} min gets a score of{' '}
      {grades.travelVarianceScore}.
      <Box pt={2}>
        <InfoScoreLegend
          rows={[
            { label: '5 min or less', value: 100 },
            { label: '6.25 min', value: 75 },
            { label: '7.5 min', value: 50 },
            { label: '8.75 min', value: 25 },
            { label: '10 min or more', value: 0 },
          ]}
        />
      </Box>
    </Fragment>
  ) : null;

  return (
    <Fragment>
      <div style={{ padding: 8 }}>
        {grades ? (
          <Fragment>
            <Grid container spacing={4}>
              {/* spacing doesn't work exactly right here, just pads the Papers */}
              <Grid item xs component={Paper} className={classes.uncolored}>
                <Typography variant="overline">Typical journey</Typography>
                <br />

                <Typography variant="h3" display="inline">
                  {typicalWait + typicalTravel}
                </Typography>
                <Typography variant="h5" display="inline">
                  &nbsp;min
                </Typography>

                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-end"
                  pt={2}
                >
                  <Typography variant="body1">
                    <WatchLaterOutlinedIcon
                      fontSize="small"
                      style={{ verticalAlign: 'sub' }}
                    />
                    &nbsp;
                    {typicalWait} min
                    <br />
                    <StartStopIcon
                      fontSize="small"
                      style={{ verticalAlign: 'sub' }}
                    />
                    &nbsp;
                    {typicalTravel} min
                  </Typography>
                  <IconButton size="small" onClick={handleTypicalClick}>
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Grid>

              <Grid item xs component={Paper} className={classes.uncolored}>
                <Typography variant="overline">Journey planning</Typography>
                <br />

                <Typography variant="h3" display="inline">
                  {planningWait + planningTravel}
                </Typography>
                <Typography variant="h5" display="inline">
                  &nbsp;min
                </Typography>

                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-end"
                  pt={2}
                >
                  <Typography variant="body1">
                    <WatchLaterOutlinedIcon
                      fontSize="small"
                      style={{ verticalAlign: 'sub' }}
                    />
                    &nbsp;
                    {planningWait} min
                    <br />
                    <StartStopIcon
                      fontSize="small"
                      style={{ verticalAlign: 'sub' }}
                    />
                    &nbsp;
                    {planningTravel} min
                  </Typography>
                  <IconButton size="small" onClick={handlePlanningClick}>
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Grid>
              <InfoScoreCard
                grades={grades}
                gradeName="totalScore"
                hideRating
                title="Trip Score"
                largeValue={grades ? grades.totalScore : '--'}
                smallValue={`/${grades ? grades.highestPossibleScore : '--'}`}
                bottomContent="&nbsp;"
                popoverContent={popoverContentTotalScore}
              />
              <InfoScoreCard
                grades={grades}
                gradeName="medianWaitScore"
                title="Median Wait"
                largeValue={Math.round(waitTimes.median)}
                smallValue="&nbsp;min"
                bottomContent="&nbsp;"
                popoverContent={popoverContentWait}
              />
              <InfoScoreCard
                grades={grades}
                gradeName="longWaitScore"
                title="Long Wait %"
                largeValue={Math.round(longWaitProbability * 100)}
                smallValue="%"
                bottomContent={
                  longWaitProbability > 0
                    ? `1 time out of ${Math.round(1 / longWaitProbability)}`
                    : ''
                }
                popoverContent={popoverContentLongWait}
              />
              <InfoScoreCard
                grades={grades}
                gradeName="speedScore"
                title="Median Trip Speed"
                largeValue={speed.toFixed(0)}
                smallValue="&nbsp;mph"
                bottomContent={`${distance.toFixed(1)} miles`}
                popoverContent={popoverContentSpeed}
              />
              <InfoScoreCard
                grades={grades}
                gradeName="travelVarianceScore"
                title="Travel Time Variability"
                largeValue={`\u00b1${travelVariability}`}
                smallValue="&nbsp;min"
                bottomContent="&nbsp;"
                popoverContent={popoverContentTravelVariability}
              />
            </Grid>

            <Popover
              open={Boolean(typicalAnchorEl)}
              anchorEl={typicalAnchorEl}
              onClose={handleTypicalClose}
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
                This is the median wait time when a rider arrives randomly at a
                stop or a rider starts checking predictions. This is combined
                with the median trip time.
              </div>
            </Popover>

            <Popover
              open={Boolean(planningAnchorEl)}
              anchorEl={planningAnchorEl}
              onClose={handlePlanningClose}
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
                When planning to arrive by a specific time, the 90th percentile
                wait time and 90th percentile travel time suggest how far in
                advance to start checking predictions. Walking time should also
                be added.
              </div>
            </Popover>
          </Fragment>
        ) : (
          `No trip summary (${whyNoData})`
        )}
      </div>
    </Fragment>
  );
}
