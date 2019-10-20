import React, { Fragment, useEffect } from 'react';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import { connect } from 'react-redux';
import Info from '../components/Info';
import MapStops from '../components/MapStops';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';

import ControlPanel from '../components/ControlPanel';
import RouteSummary from '../components/RouteSummary';

import { fetchRoutes } from '../actions';
import { agencyTitle } from '../locationConstants';

import Link from 'redux-first-router-link';


function RouteScreen(props) {
  
  const {
    graphData,
    graphError,
    graphParams,
    intervalData,
    intervalError,
    routes,
    thisFetchRoutes,
  } = props;

  useEffect(() => {
    if (!routes) {
      thisFetchRoutes();
    }
  }, [routes, thisFetchRoutes]); // like componentDidMount, this runs only on first render
  
  const breadCrumbs = paths => {
    let link = {
      type:'ROUTESCREEN'
    }
   const params = ['route_id', 'direction_id', 'start_stop_id','end_stop_id']
   const labels = (param, title) => {
    const  specialLabels = { 
          'start_stop_id':`(from ${title}`,
           'end_stop_id' : `to ${title})`
        };
        return specialLabels[param] ? specialLabels[param] : title;
   }
   return paths.filter(path => {
     return  path ?  true : false;
    }).map((path, index, paths) => {
      const nextValue = paths[index+1];
      const param = params[index];
      let payload = {};
      payload[param] = path.id;
      const updatedPayload = Object.assign({...link.payload}, payload);
      link = Object.assign({...link}, {payload:updatedPayload});
      const label = labels(param, path.title);
      debugger;
      return nextValue ? (
        <span> > <Link to={link}>
        {label}> </Link> </span> ) :
      (<span> > {label} </span>)
    });
  }

  const selectedRoute =
    routes && graphParams && graphParams.routeId
      ? routes.find(route => route.id === graphParams.routeId)
      : null;
  const direction =
    selectedRoute && graphParams.directionId
      ? selectedRoute.directions.find(
          thisDirection => thisDirection.id === graphParams.directionId,
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
      debugger;
  
  return (
    <Fragment>
      <AppBar position="relative">
        <Toolbar>
          <SidebarButton />
          <div className="page-title">
          { /*
            
            {selectedRoute ? <span> > <Link to={Object.assign({...link}, {payload: { route_id: selectedRoute.id}})}> {selectedRoute.title} </Link> </span> : null}
            {direction ?  <span> > <Link to={Object.assign({...link}, {payload: { route_id: selectedRoute.id, direction_id: direction.id}})}> {direction.title} </Link> </span> : null}
            &nbsp;
            {startStopInfo ? <span> > <Link to={Object.assign({...link}, {payload: { route_id: selectedRoute.id, direction_id: direction.id, start_stop_id: graphParams.startStopId}})}> {`(from ${startStopInfo.title}`} </Link> </span> : null}
            {endStopInfo ? <span> > <Link to={Object.assign({...link}, {payload: { route_id: selectedRoute.id, direction_id: direction.id, start_stop_id: graphParams.startStopId, end_stop_id: graphParams.endStopId }})}> {`to ${endStopInfo.title})`} </Link> </span>  : null}
          */}
          <Link to="/">{agencyTitle}</Link>
          {breadCrumbs([selectedRoute,direction,startStopInfo,endStopInfo])}
          </div>
          <DateTimePanel />
        </Toolbar>
      </AppBar>

      <Grid container spacing={0}>
        <Grid item xs={12} sm={6}>
          <MapStops routes={routes} />
        </Grid>
        <Grid item xs={12} sm={6}>
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
  thisFetchRoutes: () => dispatch(fetchRoutes()),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteScreen);
