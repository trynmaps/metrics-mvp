import React, { useEffect } from 'react';
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
  const { routes, myFetchRoutes, myHandleGraphParams } = props;

  // for now, only supports 1 agency at a time.
  // todo: support multiple agencies on one map
  const agency = Agencies[0];

  useEffect(() => {
    myHandleGraphParams({agencyId: agency.id}); // temporary hack, probably should remove once frontend can show routes from multiple agencies at once

    if (!routes) {
      myFetchRoutes({agencyId: agency.id});
    }
  }, [routes, myFetchRoutes, myHandleGraphParams, agency]); // like componentDidMount, this runs only on first render

  return (
    <div className="flex-screen">
      <AppBar position="relative">
        <Toolbar>
          <SidebarButton />
          <div className="page-title">{agency.title}</div>
          <DateTimePanel />
        </Toolbar>
      </AppBar>
      <Grid container spacing={0} className="grid-container">
        {/* Using spacing causes horizontal scrolling, see https://material-ui.com/components/grid/#negative-margin */}
        <Grid item xs={12} sm={6}>
          {/* map and table are both full width for 640px windows or smaller, else half width */}
          <MapSpider />
        </Grid>
        <Grid item xs={12} sm={6} style={{ padding: 12 }} className="grid-info-box">
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
  myFetchRoutes: props => dispatch(fetchRoutes(props)),
  myHandleGraphParams: props => dispatch(handleGraphParams(props)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Dashboard);
