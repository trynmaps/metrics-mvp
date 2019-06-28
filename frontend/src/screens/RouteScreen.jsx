import React, { Fragment } from 'react';
import Grid from '@material-ui/core/Grid';
import Drawer from '@material-ui/core/Drawer';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import AppBar from '@material-ui/core/AppBar';

import Navigation from '../components/Navigation';
import Info from '../components/Info';
import MapStops from '../components/MapStops';

import ControlPanel from '../components/ControlPanel';

import {
  fetchData,
  fetchGraphData,
  fetchIntervalData,
  fetchRoutes,
  fetchRouteConfig,
  resetGraphData,
  resetIntervalData,
} from '../actions';

import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class RouteScreen extends React.Component {
  
  componentDidMount() {
    if (!this.props.routes) {
      this.props.fetchRoutes();
    }
  }
  
  constructor(props) {
    super(props)

    this.state = {
      drawerOpen: false,
    }

    this.handleToggleDrawer = this.handleToggleDrawer.bind(this);
  }

  handleToggleDrawer() {
    this.setState({ drawerOpen: !this.state.drawerOpen })
  }

  render() {
    const {
      graphData,
      graphError,
      graphParams,
      intervalData,
      intervalError,
      routes,
    } = this.props;
    
    const selectedRoute = routes && graphParams && graphParams.route_id ? routes.find(route => route.id === graphParams.route_id) : null;
    const direction = selectedRoute && graphParams.direction_id ? selectedRoute.directions.find(direction => direction.id === graphParams.direction_id) : null;
    const startStopInfo = direction && graphParams.start_stop_id ? selectedRoute.stops[graphParams.start_stop_id] : null;
    const endStopInfo = direction && graphParams.end_stop_id ? selectedRoute.stops[graphParams.end_stop_id] : null;
    
    return (
      <Fragment>
        <Navigation />
        <AppBar position="relative">
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleToggleDrawer}
              edge="start"
            >
              <MenuIcon />
            </IconButton>
            Muni
            { selectedRoute ? ' > ' + selectedRoute.title : null }
            { direction ? ' > ' + direction.title : null }
            &nbsp;
            { startStopInfo ? '(from ' + startStopInfo.title : null }
            { endStopInfo ? ' to ' + endStopInfo.title + ')' : null }
          </Toolbar>
        </AppBar>

        <Drawer
          variant="persistent"
          anchor="left"
          open={this.state.drawerOpen}
          style={{ width: 500 }}
        >
          <div style={{ width: 250 }}>
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleToggleDrawer}
              edge="start"
            >
              <ChevronLeftIcon />
            </IconButton>
            <List>
              <ListItem>Test</ListItem>
              <ListItem>Test</ListItem>
            </List>
          </div>
        </Drawer>

        <Grid container spacing={3}>
          <Grid item xs={6}>
            <ControlPanel
              routes={routes}
              fetchRouteConfig={this.props.fetchRouteConfig}
              resetGraphData={this.props.resetGraphData}
              fetchGraphData={this.props.fetchGraphData}
              resetIntervalData={this.props.resetIntervalData}
              fetchIntervalData={this.props.fetchIntervalData}
              fetchData={this.props.fetchData}
            />
            <MapStops routes={routes}/>

          </Grid>
          <Grid item xs={6}>
              
          { graphData ?  /* if we have graph data, then show the info component */
              <Info
                graphData={graphData}
                graphError={graphError}
                graphParams={graphParams}
                routes={routes}
                intervalData={intervalData}
                intervalError={intervalError}
              />
              
            : /* if no graph data, show the info summary component */
      
            "(Route overview: InfoSummary component will go here)"

          }              
              
          </Grid>
        </Grid>
      </Fragment>
    )
  }
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
  fetchRouteConfig: routeId => dispatch(fetchRouteConfig(routeId)),
});

RouteScreen.propTypes = {
  graphData: PropTypes.instanceOf(Object),
};

export default connect(
    mapStateToProps,
    mapDispatchToProps,
)(RouteScreen);
