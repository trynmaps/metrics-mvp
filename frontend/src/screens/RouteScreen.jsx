import React, { Fragment, useEffect } from 'react';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import { connect } from 'react-redux';
import Info from '../components/Info';
import MapStops from '../components/MapStops';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';

import { getAgency } from '../config';
import ControlPanel from '../components/ControlPanel';
import RouteSummary from '../components/RouteSummary';

import { fetchRoutes } from '../actions';

function RouteScreen(props) {
  const {
    graphData,
    graphError,
    graphParams,
    intervalData,
    intervalError,
    routes,
    myFetchRoutes,
  } = props;

  const agencyId = graphParams ? graphParams.agencyId : null;

  useEffect(() => {
    if (!routes && agencyId) {
      myFetchRoutes({agencyId: agencyId});
    }
  }, [agencyId, routes, myFetchRoutes]); // like componentDidMount, this runs only on first render

  const agency = getAgency(agencyId);

  const selectedRoute =
    routes && graphParams && graphParams.routeId
      ? routes.find(route => (route.id === graphParams.routeId && route.agencyId === agencyId))
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

  return (
    <Fragment>
      <AppBar position="relative">
        <Toolbar>
          <SidebarButton />
          <div className="page-title">
            {agency ? agency.title : null}
          </div>
          <div style={{flexGrow: 1}}/>
          <DateTimePanel dateRangeSupported={graphData || graphError}/>
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

      <Grid container spacing={0} className="grid-container">
        <Grid item xs={12} sm={6}>
          <MapStops routes={routes} />
        </Grid>
        <Grid item xs={12} sm={6} className="grid-info-box">
          {/* control panel and map are full width for 640px windows or smaller, else half width */}
          <ControlPanel routes={routes} />
          {graphData ||
          graphError /* if we have graph data or an error, then show the info component */ ? (
            <Info
              graphData={graphData}
              graphError={graphError}
              graphParams={graphParams}
              routes={routes}
              intervalData={intervalData}
              intervalError={intervalError}
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
  graphData: state.fetchGraph.graphData,
  routes: state.routes.routes,
  graphError: state.fetchGraph.err,
  intervalData: state.fetchGraph.intervalData,
  intervalError: state.fetchGraph.intervalErr,
  graphParams: state.routes.graphParams,
});

const mapDispatchToProps = dispatch => ({
  myFetchRoutes: params => dispatch(fetchRoutes(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteScreen);
