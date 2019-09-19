import React, { useEffect } from 'react';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import { connect } from 'react-redux';
import MapSpider from '../components/MapSpider';
import RouteTable from '../components/RouteTable';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';

import { agencyTitle } from '../locationConstants';
import { fetchRoutes } from '../actions';

function Dashboard(props) {
  
  const { routes, fetchRoutes } = props;
  
  useEffect(() => {
    if (!routes) {
      fetchRoutes();
    }
  }, [routes, fetchRoutes]); // like componentDidMount, this runs only on first render

  return (
    <div className="flex-screen">
      <AppBar position="relative">
        <Toolbar>
          <SidebarButton />
          <div className="page-title">{agencyTitle}</div>
          <DateTimePanel />
        </Toolbar>
      </AppBar>
      <Grid container spacing={0}>
        {/* Using spacing causes horizontal scrolling, see https://material-ui.com/components/grid/#negative-margin */}
        <Grid item xs={12} sm={6}>
          {/* map and table are both full width for 640px windows or smaller, else half width */}
          <MapSpider />
        </Grid>
        <Grid item xs={12} sm={6} style={{ padding: 12 }}>
          {/* Doing the spacing between Grid items ourselves.  See previous comment. */}
          <RouteTable routes={routes} />
        </Grid>
      </Grid>
    </div>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: () => dispatch(fetchRoutes()),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Dashboard);
