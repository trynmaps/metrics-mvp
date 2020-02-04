import React, { useEffect, useState } from 'react';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import { connect } from 'react-redux';
import { Agencies } from '../config';
import MapSpider from '../components/MapSpider';
import RouteTable from '../components/RouteTable';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';

import { fetchRoutes, handleGraphParams } from '../actions';

function Dashboard(props) {
  const { routes } = props;
  const [hoverRoute, setHoverRoute] = useState(null);
  const myFetchRoutes = props.fetchRoutes;
  const myHandleGraphParams = props.handleGraphParams;

  const agency = Agencies[0];

  useEffect(() => {
    if (!routes) {
      myFetchRoutes();
    }
    // trigger action to fetch precomputed stats for initial graphParams
    myHandleGraphParams({});
  }, [routes, myFetchRoutes, myHandleGraphParams]); // like componentDidMount, this runs only on first render

  return (
    <div className="flex-screen">
      <AppBar position="relative">
        <Toolbar>
          <SidebarButton />
          <div className="page-title">{agency.title}</div>
          <DateTimePanel />
        </Toolbar>
      </AppBar>
      <Grid container spacing={0}>
        {/* Using spacing causes horizontal scrolling, see https://material-ui.com/components/grid/#negative-margin */}
        <Grid item xs={12} sm={6}>
          {/* map and table are both full width for 640px windows or smaller, else half width */}
          <MapSpider hoverRoute={hoverRoute} />
        </Grid>
        <Grid item xs={12} sm={6} style={{ padding: 12 }}>
          {/* Doing the spacing between Grid items ourselves.  See previous comment. */}
          <RouteTable routes={routes} setHoverRoute={setHoverRoute} />
        </Grid>
      </Grid>
    </div>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: params => dispatch(fetchRoutes(params)),
  handleGraphParams: params => dispatch(handleGraphParams(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Dashboard);
