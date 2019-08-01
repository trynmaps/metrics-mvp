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
import { NavLink } from 'redux-first-router-link';

import { connect } from 'react-redux';

import TravelTimeChart from '../components/TravelTimeChart';

import {
  fetchRoutes,
  fetchPrecomputedWaitAndTripData,
} from '../actions';

class DataDiagnostic extends React.Component {
  componentDidMount() {
    if (!this.props.routes) {
      this.props.fetchRoutes();
    }
    this.props.fetchPrecomputedWaitAndTripData(this.props.graphParams);   
  }

  constructor(props) {
    super(props);

    this.state = {
      drawerOpen: false,
    };

    this.handleToggleDrawer = this.handleToggleDrawer.bind(this);
  }

  handleToggleDrawer() {
    this.setState({ drawerOpen: !this.state.drawerOpen });
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
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleToggleDrawer}
              edge="start"
            >
              <MenuIcon />
            </IconButton>
        <NavLink
        to={{ type: 'DASHBOARD' }}
        activeStyle={{ fontWeight: "bold", color: 'purple' }}
        exact={true}
        strict={true}
      >
        Muni
        </NavLink>

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

        Date: { graphParams.date} Time: { graphParams.start_time } - { graphParams.end_time }
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
