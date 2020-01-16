import React, { Fragment, useEffect } from 'react';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';
import IconButton from '@material-ui/core/IconButton';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { NavLink } from 'redux-first-router-link';
import { connect } from 'react-redux';

import Info from '../components/Info';
import MapStops from '../components/MapStops';
import DateTimePanel from '../components/DateTimePanel';

import { getAgency } from '../config';
import ControlPanel from '../components/ControlPanel';
import RouteSummary from '../components/RouteSummary';

import { fetchRoutes } from '../actions';

function RouteScreen(props) {
  const {
    tripMetrics,
    tripMetricsLoading,
    tripMetricsError,
    graphParams,
    routes,
  } = props;

  const myFetchRoutes = props.fetchRoutes;
  const agencyId = graphParams ? graphParams.agencyId : null;

  useEffect(() => {
    if (!routes && agencyId) {
      myFetchRoutes({ agencyId: agencyId });
    }
  }, [agencyId, routes, myFetchRoutes]); // like componentDidMount, this runs only on first render

  const agency = getAgency(agencyId);

  const selectedRoute =
    routes && graphParams && graphParams.routeId
      ? routes.find(
          route =>
            route.id === graphParams.routeId && route.agencyId === agencyId,
        )
      : null;

  const direction =
    selectedRoute && graphParams.directionId
      ? selectedRoute.directions.find(
          myDirection => myDirection.id === graphParams.directionId,
        )
      : null;
  const startStopInfo =
    direction && graphParams.startStopId
      ? selectedRoute.stops[graphParams.startStopId]
      : null;
  const endStopInfo =
    direction && graphParams.endStopId
      ? selectedRoute.stops[graphParams.endStopId]
      : null;

  const backArrowStyle = {
    color: '#ffffff',
  };

  return (
    <Fragment>
      <AppBar position="relative">
        <Toolbar>
          <NavLink to={{ type: 'DASHBOARD' }} exact strict>
            <IconButton aria-label="Back to dashboard" edge="start">
              <ArrowBackIcon style={backArrowStyle} />
            </IconButton>
          </NavLink>
          <div className="page-title">{agency ? agency.title : null}</div>
          <div style={{ flexGrow: 1 }} />
          <DateTimePanel
            dateRangeSupported={
              tripMetrics || tripMetricsError || tripMetricsLoading
            }
          />
        </Toolbar>
      </AppBar>

      <Paper>
        <Box p={2} className="page-title">
          {selectedRoute ? ` ${selectedRoute.title}` : null}
          {direction ? ` > ${direction.title}` : null}
          &nbsp;
          {startStopInfo ? `(from ${startStopInfo.title}` : null}
          {endStopInfo ? ` to ${endStopInfo.title})` : null}
        </Box>
      </Paper>

      <Grid container spacing={0}>
        <Grid item xs={12} sm={6}>
          <MapStops routes={routes} />
        </Grid>
        <Grid item xs={12} sm={6}>
          {/* control panel and map are full width for 640px windows or smaller, else half width */}
          <ControlPanel routes={routes} />
          {tripMetrics ||
          tripMetricsError ||
          tripMetricsLoading /* if we have trip metrics or an error, then show the info component */ ? (
            <Info
              tripMetrics={tripMetrics}
              tripMetricsError={tripMetricsError}
              tripMetricsLoading={tripMetricsLoading}
              graphParams={graphParams}
              routes={routes}
            />
          ) : (
            /* if no graph data, show the info summary component */
            <RouteSummary />
          )}
        </Grid>
      </Grid>
    </Fragment>
  );
}

const mapStateToProps = state => ({
  tripMetrics: state.tripMetrics.data,
  tripMetricsError: state.tripMetrics.error,
  tripMetricsLoading: state.loading.TRIP_METRICS,
  routes: state.routes.data,
  graphParams: state.graphParams,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: params => dispatch(fetchRoutes(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteScreen);
