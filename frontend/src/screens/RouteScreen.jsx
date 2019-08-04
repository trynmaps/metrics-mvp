import React, { useEffect, Fragment } from 'react';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';
import { makeStyles } from '@material-ui/core/styles';

import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Info from '../components/Info';
import MapStops from '../components/MapStops';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';

import ControlPanel from '../components/ControlPanel';
import RouteSummary from '../components/RouteSummary';

import {
  fetchData,
  fetchGraphData,
  fetchIntervalData,
  fetchRoutes,
  resetGraphData,
  resetIntervalData,
} from '../actions';

function RouteScreen(props) {

  useEffect(() => {
    if (!props.routes) {
      props.fetchRoutes();
    }
  }, []);  // like componentDidMount, this runs only on first render

    const {
      graphData,
      graphError,
      graphParams,
      intervalData,
      intervalError,
      routes,
    } = props;

    const selectedRoute =
      routes && graphParams && graphParams.route_id
        ? routes.find(route => route.id === graphParams.route_id)
        : null;
    const direction =
      selectedRoute && graphParams.direction_id
        ? selectedRoute.directions.find(
            direction => direction.id === graphParams.direction_id,
          )
        : null;
    const startStopInfo =
      direction && graphParams.start_stop_id
        ? selectedRoute.stops[graphParams.start_stop_id]
        : null;
    const endStopInfo =
      direction && graphParams.end_stop_id
        ? selectedRoute.stops[graphParams.end_stop_id]
        : null;

    return (
      <Fragment>
        <AppBar position="relative">
          <Toolbar>
            <SidebarButton />
            <div className='page-title'>
              Muni
              {selectedRoute ? ` > ${selectedRoute.title}` : null}
              {direction ? ` > ${direction.title}` : null}
              &nbsp;
              {startStopInfo ? `(from ${startStopInfo.title}` : null}
              {endStopInfo ? ` to ${endStopInfo.title})` : null}
            </div>
            <DateTimePanel/>
          </Toolbar>
        </AppBar>

        <Grid container spacing={0}>
          <Grid item xs={6}>
            <ControlPanel
              routes={routes}
              resetGraphData={props.resetGraphData}
              fetchGraphData={props.fetchGraphData}
              resetIntervalData={props.resetIntervalData}
              fetchIntervalData={props.fetchIntervalData}
              fetchData={props.fetchData}
            />
            <MapStops routes={routes} />
          </Grid>
          <Grid item xs={6}>
            {graphData /* if we have graph data, then show the info component */ ? (
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

                <RouteSummary/>
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
  fetchData: (graphParams, intervalParams) =>
    dispatch(fetchData(graphParams, intervalParams)),
  resetGraphData: params => dispatch(resetGraphData()),
  fetchGraphData: params => dispatch(fetchGraphData(params)),
  resetIntervalData: params => dispatch(resetIntervalData()),
  fetchIntervalData: params => dispatch(fetchIntervalData(params)),
  fetchRoutes: () => dispatch(fetchRoutes()),
});

RouteScreen.propTypes = {
  graphData: PropTypes.instanceOf(Object),
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteScreen);
