import React, { Fragment, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import HomeIcon from '@material-ui/icons/Home';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';
import Link from 'redux-first-router-link';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import Typography from '@material-ui/core/Typography';
import { connect } from 'react-redux';
import AppBarLogo from '../components/AppBarLogo';
import Info from '../components/Info';
import MapStops from '../components/MapStops';
import DateTimePanel from '../components/DateTimePanel';
import SidebarButton from '../components/SidebarButton';
import { getAgency } from '../config';
import ControlPanel from '../components/ControlPanel';
import RouteSummary from '../components/RouteSummary';

import { fetchRoutes } from '../actions';

const useStyles = makeStyles(theme => ({
  breadCrumbStyling: {
    fontWeight: 'bold',
    textTransform: 'initial',
    display: 'inline',
  },
  darkLinks: {
    color: theme.palette.primary.dark,
  },
  breadCrumbsWrapper: {
    padding: '1%',
    paddingRight: '0',
  },
  homeIcon: {
    color: 'gray',
    fontSize: 20,
    alignSelf: 'center',
    marginRight: '5px',
  },
  linkContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'flex-start',
    textDecorationColor: theme.palette.primary.dark,
  },
}));

const BreadCrumbHomeLink = props => {
  const { agencyId } = props;
  const { breadCrumbStyling, darkLinks, homeIcon, linkContainer } = useStyles();
  const agency = getAgency(agencyId);
  const agencyTitle = agency.title;
  return (
    <Fragment>
      <Link
        className={linkContainer}
        to={{ type: 'DASHBOARD', query: props.query }}
        exact
        strict
      >
        <HomeIcon className={homeIcon} />
        <Typography
          variant="subtitle1"
          className={`${breadCrumbStyling} ${darkLinks}`}
        >
          {agencyTitle}
        </Typography>
      </Link>
    </Fragment>
  );
};

const BreadCrumbLink = props => {
  const { hasNextValue, label, specialLabel, link } = props;
  const { breadCrumbStyling, darkLinks } = useStyles();
  return hasNextValue ? (
    <Typography
      variant="subtitle1"
      className={`${breadCrumbStyling} ${darkLinks}`}
    >
      {' '}
      {specialLabel}{' '}
      <Link to={link} className={`${breadCrumbStyling} ${darkLinks}`}>
        {' '}
        {label}{' '}
      </Link>{' '}
    </Typography>
  ) : (
    <Typography variant="subtitle1" className={breadCrumbStyling}>
      {' '}
      {specialLabel} {label}{' '}
    </Typography>
  );
};

function BreadCrumbBar(props) {
  const { direction, selectedRoute, linkQuery, agencyId } = props;
  const { startStopInfo, endStopInfo } = props;
  const classes = useStyles();
  const { breadCrumbStyling, breadCrumbsWrapper } = classes;

  const renderBreadCrumbs = paths => {
    let link = {
      type: 'ROUTESCREEN',
      query: linkQuery,
    };

    const params = ['routeId', 'directionId', 'startStopId', 'endStopId'];
    const getLabel = (param, title) => {
      const specialLabels = {};
      specialLabels.startStopId = 'from: ';
      specialLabels.endStopId = 'to: ';
      return {
        label: title,
        specialLabel: specialLabels[param] ? specialLabels[param] : null,
      };
    };
    const bradCrumbLinks = paths
      .filter(path => {
        // return paths with non null values
        return !!path;
      })
      .map((path, index) => {
        const hasNextValue = paths[index + 1];
        const param = params[index];
        const payload = {};
        payload[param] = path.id;
        const updatedPayload = Object.assign({ ...link.payload }, payload);
        link = Object.assign({ ...link }, { payload: updatedPayload });
        const { label, specialLabel } = getLabel(param, path.title);
        return (
          <BreadCrumbLink
            hasNextValue={hasNextValue}
            label={label}
            specialLabel={specialLabel}
            link={link}
            key={label}
          />
        );
      });
    return [<BreadCrumbHomeLink agencyId={agencyId} />, ...bradCrumbLinks];
  };

  return (
    <Fragment>
      <Paper className={breadCrumbsWrapper}>
        <Breadcrumbs
          separator={
            <NavigateNextIcon
              fontSize="default"
              className={breadCrumbStyling}
            />
          }
        >
          {renderBreadCrumbs([
            selectedRoute,
            direction,
            startStopInfo,
            endStopInfo,
          ])}
        </Breadcrumbs>
      </Paper>
    </Fragment>
  );
}

function RouteScreen(props) {
  const {
    tripMetrics,
    tripMetricsLoading,
    tripMetricsError,
    graphParams,
    routes,
  } = props;
  const myFetchRoutes = props.fetchRoutes;
  const agencyId = graphParams ? graphParams.agencyId : null;
  const linkQuery = props.query;
  const selectedRoute =
    routes && graphParams && graphParams.routeId
      ? routes.find(
          route =>
            route.id === graphParams.routeId && route.agencyId === agencyId,
        )
      : null;

  const direction =
    selectedRoute && graphParams.directionId
      ? selectedRoute.directions.find(
          myDirection => myDirection.id === graphParams.directionId,
        )
      : null;

  const startStopInfo =
    direction && graphParams.startStopId
      ? Object.assign(
          { ...selectedRoute.stops[graphParams.startStopId] },
          { id: graphParams.startStopId },
        )
      : null;
  const endStopInfo =
    direction && graphParams.endStopId
      ? Object.assign(
          { ...selectedRoute.stops[graphParams.endStopId] },
          { id: graphParams.endStopId },
        )
      : null;

  useEffect(() => {
    if (!routes && agencyId) {
      myFetchRoutes({ agencyId });
    }
  }, [agencyId, routes, myFetchRoutes]);

  const agency = getAgency(agencyId);

  return (
    <Fragment>
      <AppBar position="relative">
        <Toolbar>
          <SidebarButton />
          <AppBarLogo />
          <div className="page-title">{agency ? agency.title : null}</div>
          <div style={{ flexGrow: 1 }} />
          <DateTimePanel dateRangeSupported />
        </Toolbar>
      </AppBar>
      <BreadCrumbBar
        selectedRoute={selectedRoute}
        startStopInfo={startStopInfo}
        endStopInfo={endStopInfo}
        linkQuery={linkQuery}
        direction={direction}
        agencyId={agencyId}
      />
      <Grid container spacing={0}>
        <Grid item xs={12} sm={6}>
          <MapStops routes={routes} />
        </Grid>
        <Grid item xs={12} sm={6}>
          {/* control panel and map are full width for 640px windows or smaller, else half width */}
          <ControlPanel routes={routes} />
          {tripMetrics ||
          tripMetricsError ||
          tripMetricsLoading /* if we have trip metrics or an error, then show the info component */ ? (
            <Info
              tripMetrics={tripMetrics}
              tripMetricsError={tripMetricsError}
              tripMetricsLoading={tripMetricsLoading}
              graphParams={graphParams}
              routes={routes}
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
  tripMetrics: state.tripMetrics.data,
  tripMetricsError: state.tripMetrics.error,
  tripMetricsLoading: state.loading.TRIP_METRICS,
  routes: state.routes.data,
  graphParams: state.graphParams,
  query: state.location.query,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: params => dispatch(fetchRoutes(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteScreen);
