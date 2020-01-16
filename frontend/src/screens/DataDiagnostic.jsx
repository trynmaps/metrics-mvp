import React, { useEffect, Fragment } from 'react';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import { connect } from 'react-redux';

import { makeStyles } from '@material-ui/core/styles';
import { Agencies } from '../config';
import TravelTimeChart from '../components/TravelTimeChart';
import QuadrantChart from '../components/QuadrantChart';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';

import {
  fetchRoutes,
  fetchPrecomputedWaitAndTripData,
  handleGraphParams,
} from '../actions';

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
  const {
    graphParams,
    routes,
    myFetchRoutes,
    myFetchPrecomputedWaitAndTripData,
    myHandleGraphParams,
  } = props;

  const agency = Agencies[0];

  useEffect(() => {
    myHandleGraphParams({ agencyId: agency.id });

    if (!routes) {
      myFetchRoutes({ agencyId: agency.id });
    }
    myFetchPrecomputedWaitAndTripData(graphParams);
  }, [
    routes,
    myFetchRoutes,
    myFetchPrecomputedWaitAndTripData,
    graphParams,
    myHandleGraphParams,
    agency,
  ]); // like componentDidMount, this runs only on first render

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
          <div className={classes.title}>{agency.title}</div>
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
  myFetchRoutes: props => dispatch(fetchRoutes(props)),
  myFetchPrecomputedWaitAndTripData: params =>
    dispatch(fetchPrecomputedWaitAndTripData(params)),
  myHandleGraphParams: props => dispatch(handleGraphParams(props)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DataDiagnostic);
