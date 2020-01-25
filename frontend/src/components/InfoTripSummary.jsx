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
import {
  computeScores,
  HighestPossibleScore
} from '../helpers/routeCalculations';
import {
  getDistanceInMiles
} from '../helpers/mapGeometry';
import { PLANNING_PERCENTILE, TENTH_PERCENTILE } from '../UIConstants';
import { getPercentileValue } from '../helpers/graphData';
import InfoScoreCard from './InfoScoreCard';
import InfoScoreLegend from './InfoScoreLegend';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import StartStopIcon from '@material-ui/icons/DirectionsTransit';
import WatchLaterOutlinedIcon from '@material-ui/icons/WatchLaterOutlined';

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

  const { tripMetrics, graphParams, routes } = props;
  const waitTimes = tripMetrics ? tripMetrics.interval.waitTimes : null;
  const tripTimes = tripMetrics ? tripMetrics.interval.tripTimes : null;
  const scheduleAdherence = tripMetrics ? tripMetrics.interval.departureScheduleAdherence : null;

  const computeDistance = (myGraphParams, myRoutes) => {
    if (myGraphParams && myGraphParams.endStopId) {
      const directionId = myGraphParams.directionId;
      const routeId = myGraphParams.routeId;
      const route = myRoutes.find(thisRoute => thisRoute.id === routeId);
      const directionInfo = route.directions.find(
        dir => dir.id === directionId,
      );
      return getDistanceInMiles(route, directionInfo, myGraphParams.startStopId, myGraphParams.endStopId);
    } else {
      return 0;
    }
  };

  const distance = routes ? computeDistance(graphParams, routes) : null;

  const speed =
    tripTimes && tripTimes.count > 0 && distance
      ? distance / (tripTimes.avg / 60.0)
      : 0; // convert avg trip time to hours for mph

  let onTimeRate = scheduleAdherence && scheduleAdherence.scheduledCount > 0 ? (scheduleAdherence.onTimeCount / scheduleAdherence.scheduledCount) : null;

  let travelVariabilityTime = 0;
  if (tripTimes) {
    travelVariabilityTime =
      (getPercentileValue(tripTimes, PLANNING_PERCENTILE) -
      getPercentileValue(tripTimes, TENTH_PERCENTILE)) / 2.0;
  }

  const scores =
    speed && waitTimes.median
      ? computeScores(
          waitTimes.median,
          onTimeRate,
          speed,
          travelVariabilityTime,
        )
      : {};

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
     getPercentileValue(tripTimes, TENTH_PERCENTILE)) / 2.0,
  );

  const typicalWait = Math.round(waitTimes.median);
  const typicalTravel = Math.round(tripTimes.median); // note: can have NaN issues here due to lack of trip data between stops

  const popoverContentTotalScore = (
    <Fragment>
      Trip score of {scores.totalScore} is the average of the following
      subscores:
      <Box pt={2}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Median wait</TableCell>
              <TableCell align="right">{scores.medianWaitScore}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Long wait probability</TableCell>
              <TableCell align="right">{scores.longWaitScore}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Speed for median trip</TableCell>
              <TableCell align="right"> {scores.speedScore}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Travel time variability</TableCell>
              <TableCell align="right"> {scores.travelVarianceScore}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </Fragment>
  );

  const popoverContentWait = (
    <Fragment>
      Median wait of {(waitTimes && waitTimes.median != null) ? waitTimes.median.toFixed(1) : '--'} min gets a score of{' '}
      {scores.medianWaitScore}.
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
  );

  const popoverContentOnTimeRate = (
    <Fragment>
      Probability of{' '}
      {(onTimeRate * 100).toFixed(1) /* be more precise than card */}%
      gets a score of {scores.onTimeRateScore}.
    </Fragment>
  );

  const popoverContentSpeed = (
    <Fragment>
      Speed for median trip of {speed.toFixed(1)}{' '}
      mph gets a score of {scores.speedScore}.
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
  );

  const popoverContentTravelVariability = (
    <Fragment>
      Travel time variability is the 90th percentile travel time minus the 10th percentile
      travel time.  This measures how much extra travel time is needed for some trips.
      Variability of {'\u00b1' + travelVariabilityTime.toFixed(1)} min gets a score of{' '}
      {scores.travelVarianceScore}.
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
  );

  return (
    <Fragment>
      <div style={{ padding: 8 }}>
        {scores ? (
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
                    <WatchLaterOutlinedIcon fontSize="small" style={{verticalAlign: 'sub'}} />&nbsp;
                    {typicalWait} min
                    <br/>
                    <StartStopIcon fontSize="small" style={{verticalAlign: 'sub'}} />&nbsp;
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
                    <WatchLaterOutlinedIcon fontSize="small" style={{verticalAlign: 'sub'}} />&nbsp;
                    {planningWait} min
                    <br/>
                    <StartStopIcon fontSize="small" style={{verticalAlign: 'sub'}} />&nbsp;
                    {planningTravel} min
                  </Typography>
                  <IconButton size="small" onClick={handlePlanningClick}>
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Grid>
              <InfoScoreCard
                score={scores.totalScore}
                hideRating
                title="Trip Score"
                largeValue={scores.totalScore != null ? scores.totalScore : '--'}
                smallValue={`/${HighestPossibleScore}`}
                bottomContent="&nbsp;"
                popoverContent={popoverContentTotalScore}
              />
              <InfoScoreCard
                score={scores.medianWaitScore}
                title="Median Wait"
                largeValue={Math.round(waitTimes.median)}
                smallValue="&nbsp;min"
                bottomContent="&nbsp;"
                popoverContent={popoverContentWait}
              />
              <InfoScoreCard
                score={scores.onTimeRateScore}
                title="On Time %"
                largeValue={Math.round(onTimeRate * 100)}
                smallValue="%"
                bottomContent={scheduleAdherence  ? `${scheduleAdherence.onTimeCount} times out of ${scheduleAdherence.scheduledCount}` : null}
                popoverContent={popoverContentOnTimeRate}
              />
              <InfoScoreCard
                score={scores.speedScore}
                title="Median Trip Speed"
                largeValue={speed.toFixed(0)}
                smallValue="&nbsp;mph"
                bottomContent={`${distance != null ? distance.toFixed(1) : '--'} miles`}
                popoverContent={popoverContentSpeed}
              />
              <InfoScoreCard
                score={scores.travelVarianceScore}
                title="Travel Time Variability"
                largeValue={'\u00b1' + travelVariability}
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
              <div className={classes.popover}>This is the median wait time when a rider arrives
              randomly at a stop or a rider starts checking predictions.  This is combined with the
              median trip time.</div>
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
              <div className={classes.popover}>When planning to arrive by a specific time,
                the 90th percentile wait time and 90th percentile travel time suggest how far
                in advance to start checking predictions.  Walking time should also be added.</div>
            </Popover>

          </Fragment>
        ) : (
          `No trip summary (${whyNoData})`
        )}
      </div>
    </Fragment>
  );
}
