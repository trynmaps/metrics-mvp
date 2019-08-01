import React, { Fragment } from 'react';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import MapSpider from '../components/MapSpider';
import RouteTable from '../components/RouteTable';
import SidebarButton from '../components/SidebarButton';


import {
  fetchData,
  fetchGraphData,
  fetchIntervalData,
  fetchRoutes,
  resetGraphData,
  resetIntervalData,
} from '../actions';

class Dashboard extends React.Component {
  componentDidMount() {
    if (!this.props.routes) {
      this.props.fetchRoutes();
    }
  }

  render() {
    const { routes } = this.props;
    return (
      <Fragment>
        <AppBar position="relative">
          <Toolbar>
            <SidebarButton />
            <div>Muni</div>
          </Toolbar>
        </AppBar>

        <Grid container spacing={0}>
          {' '}
          {/* Using spacing causes horizontal scrolling, see https://material-ui.com/components/grid/#negative-margin */}
          <Grid item xs={6}>
            <MapSpider routes={routes} />
          </Grid>
          <Grid item xs={6} style={{ padding: 12 }}>
            {' '}
            {/* Doing the spacing between Grid items ourselves.  See previous comment. */}
            <RouteTable routes={routes} />
          </Grid>
        </Grid>
      </Fragment>
    );
  }
}

const mapStateToProps = state => ({
  graphData: state.fetchGraph.graphData,
  routes: state.routes.routes,
  graphError: state.fetchGraph.err,
  intervalData: state.fetchGraph.intervalData,
  intervalError: state.fetchGraph.intervalErr,
  graphParams: state.fetchGraph.graphParams,
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

Dashboard.propTypes = {
  graphData: PropTypes.instanceOf(Object),
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Dashboard);
