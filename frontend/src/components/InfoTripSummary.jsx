/**
 * Stop to stop trip summary component. 
 */
 
import React, { Fragment, useState } from 'react';
import * as d3 from 'd3';
import { getPercentileValue } from '../helpers/graphData';
import {
  PLANNING_PERCENTILE,
} from '../UIConstants';
import { milesBetween } from '../helpers/routeCalculations';

import { connect } from 'react-redux';
import {
Table,
TableBody,
TableCell,
TableRow,
Typography,
} from '@material-ui/core';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton'
import Paper from '@material-ui/core/Paper';
import Popover from '@material-ui/core/Popover';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles } from '@material-ui/core/styles';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import Rating from '@material-ui/lab/Rating';
import Box from '@material-ui/core/Box';
import InfoScoreLegend from './InfoScoreLegend';
import TravelTimeChart from './TravelTimeChart';
import {
  filterRoutes,
  quartileBackgroundColor,
  quartileForegroundColor,
  metersToMiles,
} from '../helpers/routeCalculations';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
export default function InfoTripSummary(props) {

  // the names here must match ids like 'grade' -> infoGrade and popoverGrade used below  
  const [anchorEl, setAnchorEl] = useState({
    grade: null,
    wait: null,
    speed: null,
    extraTravel: null,
  });
  
  const infoIcon = '<i class="material-icons">info</i>';
  
  function handleClick(event) {
    const newAnchorEl = {};
    newAnchorEl[event.currentTarget.id] = event.currentTarget;
    
    setAnchorEl(Object.assign({}, anchorEl, newAnchorEl));
  }

  function handleClose(name) {

    const newAnchorEl = {};
    newAnchorEl[name] = null;
    setAnchorEl(Object.assign({}, anchorEl, newAnchorEl));
  }  
  
  const computeGrades = (headwayMin, waitTimes, tripTimes, speed) => {
    //
    // grade and score for average wait
    //

    const averageWaitScoreScale = d3
      .scaleLinear()
      .domain([5, 10])
      .rangeRound([100, 0])
      .clamp(true);

    const averageWaitGradeScale = d3
      .scaleThreshold()
      .domain([5, 7.5, 10])
      .range(['A', 'B', 'C', 'D']);

    //
    // grade and score for long wait probability
    //
    // where probability of 20 min wait is:
    //   the sum of counts of bins whose range starts at 20 or more, divided by count
    //

    const reducer = (accumulator, currentValue, index) => {
      const LONG_WAIT = 20; // histogram bins are in minutes
      return currentValue.binStart >= LONG_WAIT
        ? accumulator + currentValue.count
        : accumulator;
    };

    let longWaitProbability = 0;
    if (waitTimes && waitTimes.histogram) {
      longWaitProbability = waitTimes.histogram.reduce(reducer, 0);
      longWaitProbability /= waitTimes.count;
    }

    const longWaitScoreScale = d3
      .scaleLinear()
      .domain([0.1, 0.33])
      .rangeRound([100, 0])
      .clamp(true);

    const longWaitGradeScale = d3
      .scaleThreshold()
      .domain([0.1, 0.2, 0.33])
      .range(['A', 'B', 'C', 'D']);

    // grade and score for travel speed

    const speedScoreScale = d3
      .scaleLinear()
      .domain([5, 10])
      .rangeRound([0, 100])
      .clamp(true);

    const speedGradeScale = d3
      .scaleThreshold()
      .domain([5, 7.5, 10])
      .range(['D', 'C', 'B', 'A']);

    //
    // grade score for travel time variability
    //
    // where variance is planning percentile time minus average time
    //

    let travelVarianceTime = 0;
    if (tripTimes) {
      travelVarianceTime =
        getPercentileValue(tripTimes, PLANNING_PERCENTILE) - tripTimes.avg;
    }

    const travelVarianceScoreScale = d3
      .scaleLinear()
      .domain([5, 10])
      .rangeRound([100, 0])
      .clamp(true);

    const travelVarianceGradeScale = d3
      .scaleThreshold()
      .domain([5, 7.5, 10])
      .range(['A', 'B', 'C', 'D']);

    const totalGradeScale = d3
      .scaleThreshold()
      .domain([25, 50, 75])
      .range(['D', 'C', 'B', 'A']);

    let medianWaitScore = 0;
    let medianWaitGrade = '';
    let longWaitScore = 0;
    let longWaitGrade = '';
    let speedScore = 0;
    let speedGrade = '';
    let travelVarianceScore = 0;
    let travelVarianceGrade = '';
    let totalScore = 0;
    let totalGrade = '';

    if (waitTimes) {

      medianWaitScore = averageWaitScoreScale(waitTimes.median);
      medianWaitGrade = averageWaitGradeScale(waitTimes.median);

      longWaitScore = longWaitScoreScale(longWaitProbability);
      longWaitGrade = longWaitGradeScale(longWaitProbability);

      speedScore = speedScoreScale(speed);
      speedGrade = speedGradeScale(speed);

      travelVarianceScore = travelVarianceScoreScale(travelVarianceTime);
      travelVarianceGrade = travelVarianceGradeScale(travelVarianceTime);

      totalScore =
        Math.round((medianWaitScore + longWaitScore + speedScore + travelVarianceScore) / 4);
      totalGrade = totalGradeScale(totalScore);
    }

    return {
      medianWaitScore,
      medianWaitGrade,
      longWaitProbability,
      longWaitScore,
      longWaitGrade,
      speedScore,
      speedGrade,
      travelVarianceTime,
      travelVarianceScore,
      travelVarianceGrade,
      totalScore,
      totalGrade,
      highestPossibleScore: 100,
    };
  }

  const { graphData, graphParams, routes } = props; 
  const headwayMin = graphData ? graphData.headwayMin : null;
  const waitTimes = graphData ? graphData.waitTimes : null;
  const tripTimes = graphData ? graphData.tripTimes : null;  

  
  const computeDistance = (graphParams, routes) => {
    let miles = 0;

    if (graphParams && graphParams.endStopId) {
      const directionId = graphParams.directionId;
      const routeId = graphParams.routeId;

      const route = routes.find(thisRoute => thisRoute.id === routeId);
      const stopSequence = route.directions.find(dir => dir.id === directionId)
        .stops;
      const startIndex = stopSequence.indexOf(graphParams.startStopId);
      const endIndex = stopSequence.indexOf(graphParams.endStopId);

      for (let i = startIndex; i < endIndex; i++) {
        const fromStopInfo = route.stops[stopSequence[i]];
        const toStopInfo = route.stops[stopSequence[i + 1]];
        miles += milesBetween(fromStopInfo, toStopInfo);
      }
    }

    return miles;
  }

  
  
  const distance = routes ? computeDistance(graphParams, routes) : null;
  const speed =
    tripTimes && tripTimes.count > 0 && distance
      ? (distance / (tripTimes.avg / 60.0)).toFixed(1)
      : 0; // convert avg trip time to hours for mph

  const grades = speed
  ? computeGrades(headwayMin, waitTimes, tripTimes, speed)
  : null;

  const useStyles = makeStyles(theme => ({
    popover: {
        padding: theme.spacing(2),
      },
    uncolored: {
      //padding: theme.spacing(2),
      margin: theme.spacing(1),
    },
    grade: {
      background:
        grades
          ? quartileBackgroundColor(
              grades.totalScore / grades.highestPossibleScore,
            )
          : 'gray',
      color:
        grades
          ? quartileForegroundColor(
              grades.totalScore / grades.highestPossibleScore,
            )
          : 'black',
      //padding: theme.spacing(2),
      margin: theme.spacing(1),
    },
    wait: {
      background:
        grades
          ? quartileBackgroundColor(grades.medianWaitScore / 100.0)
          : 'gray',
      color:
        grades
          ? quartileForegroundColor(grades.medianWaitScore / 100.0)
          : 'black',
      //padding: theme.spacing(2),
      margin: theme.spacing(1),
    },
    longWait: {
      background:
        grades
          ? quartileBackgroundColor(grades.longWaitScore / 100.0)
          : 'gray',
      color:
        grades
          ? quartileForegroundColor(grades.longWaitScore / 100.0)
          : 'black',
      //padding: theme.spacing(2),
      margin: theme.spacing(1),
    },    
    trip: {
      background:
        grades
          ? quartileBackgroundColor(grades.speedScore / 100.0)
          : 'gray',
      color:
        grades
          ? quartileForegroundColor(grades.speedScore / 100.0)
          : 'black',
      //padding: theme.spacing(2),
      margin: theme.spacing(1),
    },
    travelVariance: {
      background:
        grades
          ? quartileBackgroundColor(grades.travelVarianceScore / 100.0)
          : 'gray',
      color:
        grades
          ? quartileForegroundColor(grades.travelVarianceScore / 100.0)
          : 'black',
      //padding: theme.spacing(2),
      margin: theme.spacing(1),
    },    
  }));

  const classes = useStyles();

  const planningWait = Math.round(
      getPercentileValue(waitTimes, PLANNING_PERCENTILE));
  const planningTravel = Math.round(
      getPercentileValue(tripTimes, PLANNING_PERCENTILE));
  const typicalWait = Math.round(waitTimes.median);
  const typicalTravel = Math.round(tripTimes.median); // xxx can have nan issues here due to lack data, affects all speed stuff  
  
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
                
                
                
      
          <Grid item xs component={Paper} className={classes.grade}>
            <Box display="flex" flexDirection="column" justifyContent="flex-start" height="100%">
              <Typography variant="overline">Trip&nbsp;score
              </Typography>
              
              <Box flexGrow={1}> {/* middle area takes all possible height */}
              <Typography variant="h3" display="inline">
                { grades ? grades.totalScore : '--'}
              </Typography>
              <Typography variant="h5" display="inline">
                /{grades ? grades.highestPossibleScore : '--'}
              </Typography>
              </Box>
              
              <Box display="flex" justifyContent="space-between" alignContent="flex-end">
                &nbsp;
                <IconButton id='infoGrade' size='small' onClick={handleClick}><InfoIcon fontSize='small'/></IconButton> 
              </Box>           
            </Box>
                
          </Grid>
                <Popover
                id='popoverGrade'
                open={Boolean(anchorEl.infoGrade)}
                anchorEl={anchorEl.infoGrade}
                onClose={() => handleClose('infoGrade')}
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

                <Typography style={{width:300}}>Trip score of { grades.totalScore } is the average of the following subscores:
                </Typography>
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
                </div>
                
              </Popover>                  
                
                


            <Grid item xs component={Paper} className={classes.wait}>
              <Box display="flex" flexDirection="column" justifyContent="flex-start" height="100%">
                <Typography variant="overline">Median wait</Typography>

                <Box flexGrow={1}> {/* middle area takes all possible height */}
                <Typography variant="h3" display="inline">
                  {Math.round(waitTimes.median)}
                </Typography>
                <Typography variant="h5" display="inline">
                  &nbsp;min
                </Typography>

                <Rating
                  readOnly
                  size="small"
                  value={
                    grades ? Math.round(grades.medianWaitScore / 10.0) / 2.0 : 0
                  }
                  precision={0.5}
                />
                </Box>
                <Box display="flex" justifyContent="space-between" alignContent="flex-end">
                  &nbsp;
                  <IconButton id='infoWait' size='small' onClick={handleClick} ><InfoIcon fontSize='small'/></IconButton> 
                </Box>           

                  
              </Box>
                  
                <Popover
                  id='popoverWait'
                  open={Boolean(anchorEl.infoWait)}
                  anchorEl={anchorEl.infoWait}
                  onClose={() => handleClose('infoWait')}

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

                  <Typography style={{width:300}} component={'div'}>Median wait of { waitTimes.median.toFixed(1) } min gets a score of {grades.medianWaitScore}.

                  <InfoScoreLegend rows={[
                  { label: '5 min or less', value: 100 },
                  { label: '6.25 min', value: 75 },
                  { label: '7.5 min', value: 50 },
                  { label: '8.75', value: 25 },
                  { label: '10 min or more', value: 0 },
                  ]}/>
                  </Typography>
                  </div>
                  
                </Popover>                  
                  
                  
                  

            </Grid>
                  




            <Grid item xs component={Paper} className={classes.longWait}>
              <Box display="flex" flexDirection="column" justifyContent="flex-start" height="100%">
              <Typography variant="overline">20 min wait</Typography>

              <Box flexGrow={1}> {/* middle area takes all possible height */}
              
              <Typography variant="h3" display="inline">
              
              {Math.round(grades.longWaitProbability * 100)}              
              

              </Typography>
              <Typography variant="h5" display="inline">%
              </Typography>

              <Rating
                readOnly
                size="small"
                value={
                  grades ? Math.round(grades.longWaitScore / 10.0) / 2.0 : 0
                }
                precision={0.5}
              />
              </Box>

              <Box display="flex" justifyContent="space-between" alignContent="flex-end" pt={2}>
              {
                grades.longWaitProbability > 0
                  ? `1 time out of ${Math.round(1 / grades.longWaitProbability)}`
                  : ''
              }
              <IconButton id='infoLongWait' size='small' onClick={handleClick} ><InfoIcon fontSize='small'/></IconButton> 
              </Box>
              </Box>
              
              
              <Popover
              id='popoverLongWait'
              open={Boolean(anchorEl.infoLongWait)}
              anchorEl={anchorEl.infoLongWait}
              onClose={() => handleClose('infoLongWait')}

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

              <Typography style={{width:300}}>20 min wait probability of { (grades.longWaitProbability * 100).toFixed(1) }% gets a score of {grades.longWaitScore}.

              <InfoScoreLegend rows={[
              { label: '10% or less', value: 100 },
              { label: '15.75%', value: 75 },
              { label: '21.5%', value: 50 },
              { label: '27.25%', value: 25 },
              { label: '33% or more', value: 0 },
              ]}/>
              </Typography>
              </div>
              
            </Popover>                  
              
            </Grid>

                  

            <Grid item xs component={Paper} className={classes.trip}>
              <Box display="flex" flexDirection="column" justifyContent="flex-start" height="100%">             
                <Typography variant="overline">Median speed</Typography>

                <Box flexGrow={1}> {/* middle area takes all possible height */}
                
                <Typography variant="h3" display="inline">
                {speed}
                  
                  {/*speed === null || Number.isNaN(speed)
                    ? '--'
                    : speed.toFixed(1)*/}
                </Typography>
                <Typography variant="h5" display="inline">
                  &nbsp;mph
                </Typography>
                <Rating
                  readOnly
                  size="small"
                  value={
                    grades ? Math.round(grades.speedScore / 10.0) / 2.0 : 0
                  }
                  precision={0.5}
                />
                </Box>
                <Box display="flex" justifyContent="space-between" alignContent="flex-end" pt={2}>


                  { distance.toFixed(1) } miles
                  <IconButton id='infoSpeed' size='small' onClick={handleClick} ><InfoIcon fontSize='small'/></IconButton>                  
                </Box>
              </Box>
            </Grid>
                  
                  
                  <Popover
                  id='popoverSpeed'
                  open={Boolean(anchorEl.infoSpeed)}
                  anchorEl={anchorEl.infoSpeed}
                  onClose={() => handleClose('infoSpeed')}

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

                  <Typography style={{width:300}}>Median speed of { speed } mph gets a score of {grades.speedScore}.

                  <InfoScoreLegend rows={[
                  { label: '10 mph or more', value: 100 },
                  { label: '8.75 mph', value: 75 },
                  { label: '7.5 mph', value: 50 },
                  { label: '6.25 mph', value: 25 },
                  { label: '5 mph or less', value: 0 },
                  ]}/>
                  </Typography>
                  </div>
                  
                </Popover>                  
                  



            <Grid item xs component={Paper} className={classes.travelVariance}>
              <Box display="flex" flexDirection="column" justifyContent="flex-start" height="100%">                  
              <Typography variant="overline">Extra Travel</Typography>
              
              <Box flexGrow={1}> {/* middle area takes all possible height */}
              
              <Typography variant="h3" display="inline">
              
               {planningTravel - typicalTravel}  
                      
              </Typography>
              <Typography variant="h5" display="inline">
                &nbsp;min
              </Typography>
              <Rating
                readOnly
                size="small"
                value={
                  grades ? Math.round(grades.travelVarianceScore / 10.0) / 2.0 : 0
                }
                precision={0.5}
              />
              </Box>
              <Box display="flex" justifyContent="space-between" alignContent="flex-end" pt={2}>
                In {PLANNING_PERCENTILE}% of trips
                <IconButton id='infoExtraTravel' size='small' onClick={handleClick} ><InfoIcon fontSize='small'/></IconButton>                  
              </Box>
              </Box>
            </Grid>
                
                
                <Popover
                id='popoverExtraTravel'
                open={Boolean(anchorEl.infoExtraTravel)}
                anchorEl={anchorEl.infoExtraTravel}
                onClose={() => handleClose('infoExtraTravel')}

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

                <Typography style={{width:300}}>Extra travel time of { planningTravel - typicalTravel } min gets a score of {grades.travelVarianceScore}.

                <InfoScoreLegend rows={[
                { label: '5 min or less', value: 100 },
                { label: '6.25 min', value: 75 },
                { label: '7.5 min', value: 50 },
                { label: '8.75 min', value: 25 },
                { label: '10 min or more', value: 0 },
                ]}/>
                </Typography>
                </div>
                
              </Popover>                  
                

                
        </Grid>
      </Fragment>
            
         
      : null }
      </div>
    </Fragment>
              )
}
