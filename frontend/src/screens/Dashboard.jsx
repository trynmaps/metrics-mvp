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
import MapSpider from '../components/MapSpider';
import RouteTable from '../components/RouteTable';

import {
  fetchData,
  fetchGraphData,
  fetchIntervalData,
  fetchRoutes,
  resetGraphData,
  resetIntervalData,
} from '../actions';

import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class Dashboard extends React.Component {
  
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
      routes,
    } = this.props;    
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
            <MapSpider routes={routes} />
          </Grid>
          <Grid item xs={6}>
            <RouteTable routes={routes} />
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
