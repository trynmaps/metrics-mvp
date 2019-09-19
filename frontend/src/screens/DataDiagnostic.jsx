import React, { useEffect, Fragment } from 'react';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import { connect } from 'react-redux';

import { makeStyles } from '@material-ui/core/styles';
import TravelTimeChart from '../components/TravelTimeChart';
import QuadrantChart from '../components/QuadrantChart';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';

import { fetchRoutes, fetchPrecomputedWaitAndTripData } from '../actions';
import { agencyTitle } from '../locationConstants';

const useStyles = makeStyles({
  title: {
    flexGrow: 1,
  },
});

/**
 * Data diagnostic screen.  Plots a quadrant chart and travel across stops
 * for all routes.  Access via /dataDiagnostic.
 */
function DataDiagnostic(props) {
  
  const { graphParams, routes, fetchRoutes, fetchPrecomputedWaitAndTripData } = props;
  
  useEffect(() => {
    if (!routes) {
      fetchRoutes();
    }
    fetchPrecomputedWaitAndTripData(graphParams);
  }, [ routes, fetchRoutes, fetchPrecomputedWaitAndTripData, graphParams ]); // like componentDidMount, this runs only on first render

  const classes = useStyles();


  let charts = null;

  if (routes) {
    charts = routes.map(route =>
      route.directions.map(direction => {
        return (
          <Grid item key={route.id + direction.id}>
            Route: {route.id} Direction: {direction.id}
            <TravelTimeChart routeId={route.id} directionId={direction.id} />
          </Grid>
        );
      }),
    );
  }

  return (
    <Fragment>
      <AppBar position="relative">
        <Toolbar>
          <SidebarButton />
          <div className={classes.title}>{agencyTitle}</div>
          <DateTimePanel />
        </Toolbar>
      </AppBar>
      Date: {graphParams.date} Time: {graphParams.startTime} -{' '}
      {graphParams.endTime}
      <QuadrantChart />
      <Grid container spacing={0}>
        {charts}
      </Grid>
    </Fragment>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
  graphParams: state.routes.graphParams,
  waitTimesCache: state.routes.waitTimesCache,
  tripTimesCache: state.routes.tripTimesCache,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: () => dispatch(fetchRoutes()),
  fetchPrecomputedWaitAndTripData: params =>
    dispatch(fetchPrecomputedWaitAndTripData(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DataDiagnostic);
