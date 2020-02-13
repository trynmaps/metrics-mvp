import React, { useEffect } from 'react';
import Grid from '@material-ui/core/Grid';

import { connect } from 'react-redux';
import MapSpider from '../components/MapSpider';
import RouteTable from '../components/RouteTable';

import { fetchRoutes, handleGraphParams } from '../actions';

function Dashboard(props) {
  const { routes } = props;
  const myFetchRoutes = props.fetchRoutes;
  const myHandleGraphParams = props.handleGraphParams;

  useEffect(() => {
    if (!routes) {
      myFetchRoutes();
    }
    // trigger action to fetch precomputed stats for initial graphParams
    myHandleGraphParams({});
  }, [routes, myFetchRoutes, myHandleGraphParams]); // like componentDidMount, this runs only on first render

  return (
    <Grid container spacing={0}>
      {/* Using spacing causes horizontal scrolling, see https://material-ui.com/components/grid/#negative-margin */}
      <Grid item xs={12} md={6} style={{ padding: 12 }}>
        {/* Doing the spacing between Grid items ourselves.  See previous comment. */}
        <RouteTable routes={routes} />
      </Grid>
      <Grid item xs={12} md={6}>
        {/* map and table are both full width for 1050px windows or smaller, else half width */}
        <MapSpider />
      </Grid>
    </Grid>
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
