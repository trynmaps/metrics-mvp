import React, { Fragment } from 'react';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import { connect } from 'react-redux';

import TravelTimeChart from '../components/TravelTimeChart';
import QuadrantChart from '../components/QuadrantChart';
import SidebarButton from '../components/SidebarButton';

import {
  fetchRoutes,
  fetchPrecomputedWaitAndTripData,
} from '../actions';

/**
 * Data diagnostic screen.  Plots a quadrant chart and travel across stops
 * for all routes.  Access via /dataDiagnostic.
 */
class DataDiagnostic extends React.Component {
  componentDidMount() {
    if (!this.props.routes) {
      this.props.fetchRoutes();
    }
    this.props.fetchPrecomputedWaitAndTripData(this.props.graphParams);   
  }

  render() {
    const {
      graphParams,
      routes,
    } = this.props;

    let charts = null;
    
    if (routes) {
      charts = routes.map(route => 
        route.directions.map(direction => {
          return <Grid item>Route: {route.id} Direction: {direction.id}<TravelTimeChart route_id={route.id} direction_id={direction.id} /></Grid>;
        })
      );
    }
      
    return (
      <Fragment>
        <AppBar position="relative">
          <Toolbar>
            <SidebarButton />        
            <div>Muni</div>
          </Toolbar>
        </AppBar>

        Date: { graphParams.date} Time: { graphParams.start_time } - { graphParams.end_time }
        
        <QuadrantChart/>
        <Grid container spacing={0}>
            { charts }
        </Grid>
      </Fragment>
    );
  }
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
  graphParams: state.routes.graphParams,
  waitTimesCache: state.routes.waitTimesCache,
  tripTimesCache: state.routes.tripTimesCache,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: () => dispatch(fetchRoutes()),
  fetchPrecomputedWaitAndTripData: params => dispatch(fetchPrecomputedWaitAndTripData(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DataDiagnostic);
