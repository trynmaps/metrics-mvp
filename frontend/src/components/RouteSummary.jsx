import React, { Fragment, useEffect } from 'react';

import { connect } from 'react-redux';

import Grid from '@material-ui/core/Grid';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import InfoScoreCard from './InfoScoreCard';
import InfoScoreLegend from './InfoScoreLegend';
import TravelTimeChart from './TravelTimeChart';
import MareyChart from './MareyChart';
import { fetchPrecomputedWaitAndTripData } from '../actions';
import {
  filterRoutes,
  getAllWaits,
  getAllSpeeds,
  getAllScores,
  computeGrades,
  metersToMiles,
} from '../helpers/routeCalculations';
import { PLANNING_PERCENTILE } from '../UIConstants';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
function RouteSummary(props) {
  
  const { graphParams, fetchPrecomputedWaitAndTripData } = props;

  useEffect(() => {
    fetchPrecomputedWaitAndTripData(graphParams);
  }, [graphParams, fetchPrecomputedWaitAndTripData]); // like componentDidMount, this runs only on first render

  let wait = null;
  let speed = null;
  let dist = null;
  let waitObj = null;
  let waitRanking = null;
  let longWait = null;
  let speedObj = null;
  let speedRanking = null;
  let variability = null;
  let grades = null;
  let scoreObj = null;
  let scoreRanking = null;
  let allWaits = null;
  let allSpeeds = null;
  let allScores = null;

  let routes = null;

  if (graphParams.routeId) {
    routes = props.routes ? filterRoutes(props.routes) : [];

    allWaits = getAllWaits(props.waitTimesCache, graphParams, routes);
    allSpeeds = getAllSpeeds(props.tripTimesCache, graphParams, routes);
    allScores = getAllScores(routes, allWaits, allSpeeds);

    const routeId = graphParams.routeId;
    const route = routes.find(thisRoute => thisRoute.id === routeId);
    if (route) {
      const sumOfDistances = route.directions.reduce(
        (total, value) => total + value.distance,
        0,
      );
      dist = sumOfDistances / route.directions.length;
    }

    waitObj = allWaits ? allWaits.find(obj => obj.routeId === routeId) : null;
    waitRanking = waitObj ? allWaits.length - allWaits.indexOf(waitObj) : null; // invert wait ranking to for shortest wait time
    wait = waitObj ? waitObj.wait : null;
    longWait = waitObj ? waitObj.longWait : null;

    speedObj = allSpeeds
      ? allSpeeds.find(obj => obj.routeId === routeId)
      : null;
    speedRanking = speedObj ? allSpeeds.indexOf(speedObj) + 1 : null;
    speed = speedObj ? speedObj.speed : null;
    variability = speedObj ? speedObj.variability : null;

    scoreObj = allScores
      ? allScores.find(obj => obj.routeId === routeId)
      : null;
    scoreRanking = scoreObj ? allScores.indexOf(scoreObj) + 1 : null;

    grades = computeGrades(wait, longWait, speed, variability);
  }

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
    Median wait of {wait === null ? '--' : wait.toFixed(1)} min gets a score of {grades.medianWaitScore}.
    <Box pt={2}>
      <InfoScoreLegend rows={[
      { label: '5 min or less', value: 100 },
      { label: '6.25 min', value: 75 },
      { label: '7.5 min', value: 50 },
      { label: '8.75', value: 25 },
      { label: '10 min or more', value: 0 },
      ]}/>
    </Box>
  </Fragment> : null;  
  
    
  const popoverContentLongWait = grades ?
  <Fragment>
    20 min wait probability of { (longWait * 100).toFixed(1) /* be more precise than card */ }%
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
    Median speed of { speed === null || Number.isNaN(speed)
      ? '--'
          : speed.toFixed(1)} 
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
    Extra travel time of { variability === null ? '--' : variability.toFixed(1) } min gets a score of {grades.travelVarianceScore}.
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
      <div style={{ padding: 24}}>
        <Grid container spacing={4}>
      
            <InfoScoreCard
              grades={ wait && speed && grades ? grades : null }
              gradeName={ 'totalScore' }
              hideRating={ true }
              title={ 'Route Score' }
              largeValue={wait && speed ? grades.totalScore : '--'}
              smallValue={'/' + (grades ? grades.highestPossibleScore : '--')}
              bottomContent={ scoreRanking
                ? `#${scoreRanking} out of ${allScores.length} routes`
                : 'No data'}
              popoverContent={ popoverContentTotalScore }
            />                

            <InfoScoreCard
              grades={ wait && grades ? grades : null }
              gradeName={ 'medianWaitScore' }
              title={ 'Median Wait' }
              largeValue={wait === null ? '--' : wait.toFixed(0)}
              smallValue='&nbsp;min' 
              bottomContent={ <Fragment>{waitRanking
                ? `#${waitRanking} of ${allWaits.length} for shortest wait`
                : null}
              </Fragment> }
              popoverContent={ popoverContentWait }
            />
                
            <InfoScoreCard
              grades={ wait && grades ? grades : null }
              gradeName={ 'longWaitScore' }
              title={ '20 Min Wait' }
              largeValue={(longWait * 100).toFixed(0)}
              smallValue='%' 
              bottomContent={ <Fragment>{longWait > 0
              ? `1 time out of ${Math.round(1 / longWait)}`
                  : ''}
              </Fragment> }
              popoverContent={ popoverContentLongWait }
            />

            <InfoScoreCard
              grades={ speed && grades ? grades : null }
              gradeName={ 'speedScore' }
              title={ 'Median Speed' }
              largeValue={speed === null || Number.isNaN(speed)
                ? '--'
                : speed.toFixed(0)}
              smallValue='&nbsp;mph' 
              bottomContent={ <Fragment>{speedRanking
                ? `#${speedRanking} of ${allSpeeds.length} for fastest`
                : null}
              <br/>
              Length: {metersToMiles(dist).toFixed(1)} miles</Fragment> }
              popoverContent={ popoverContentSpeed }
            />
                
          <InfoScoreCard
            grades={ speed && grades ? grades : null }
            gradeName={ 'travelVarianceScore' }
            title={ 'Extra Travel' }
            largeValue={ variability === null ? '--' : variability.toFixed(0) }
            smallValue='&nbsp;min' 
            bottomContent={ 'In ' + PLANNING_PERCENTILE + '% of trips' }
            popoverContent={ popoverContentTravelVariance }
          />
            
          <TravelTimeChart />
          <MareyChart />
        </Grid>
      </div>
    </Fragment>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
  graphParams: state.routes.graphParams,
  waitTimesCache: state.routes.waitTimesCache,
  tripTimesCache: state.routes.tripTimesCache,
});

const mapDispatchToProps = dispatch => {
  return {
    fetchPrecomputedWaitAndTripData: params =>
      dispatch(fetchPrecomputedWaitAndTripData(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteSummary);
