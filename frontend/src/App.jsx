import React from 'react';
import { connect } from 'react-redux';
import { createMuiTheme } from '@material-ui/core/styles';
import { ThemeProvider } from '@material-ui/styles';

import './App.css';

import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';
import { Tab, Tabs } from '@material-ui/core';
import PollIcon from '@material-ui/icons/Poll';
import PersonPinCircleIcon from '@material-ui/icons/PersonPinCircle';
import InfoRoundedIcon from '@material-ui/icons/InfoRounded';
import AppBarLogo from './components/AppBarLogo';
import LoadingIndicator from './components/LoadingIndicator';

import NotFound from './screens/NotFound';
import Isochrone from './screens/Isochrone';
import DataDiagnostic from './screens/DataDiagnostic';
import RouteScreen from './screens/RouteScreen';
import Dashboard from './screens/Dashboard';
import About from './screens/About';
import Home from './screens/Home';

import { Agencies } from './config';

const Screens = {
  About,
  Home,
  Isochrone,
  Dashboard,
  RouteScreen,
  DataDiagnostic,
  NotFound,
};

const theme = createMuiTheme({
  breakpoints: {
    values: {
      md: 1050,
    },
  },
  palette: {
    primary: {
      main: '#0177BF',
    },
    secondary: {
      main: '#D02143',
    },
  },
});

const App = props => {
  const { page, dispatch, type } = props;
  const Screen = Screens[page];

  const agency = Agencies[0];

  let tabValue = type;
  if (tabValue === 'ROUTESCREEN') {
    tabValue = 'DASHBOARD';
  }

  const handleTabChange = (event, newValue) => {
    dispatch({
      type: newValue,
      query: props.query,
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <div>
        <AppBar position="fixed">
          <Toolbar variant="dense" disableGutters>
            <AppBarLogo />
            <div className="page-title">{agency.title}</div>
            <LoadingIndicator />
            <div className="flex-spacing"></div>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab
                label={
                  <div>
                    <PollIcon className="app-tab-icon" />
                    <span className="app-tab-text"> Metrics</span>
                  </div>
                }
                value="DASHBOARD"
              />
              <Tab
                label={
                  <div>
                    <PersonPinCircleIcon className="app-tab-icon" />
                    <span className="app-tab-text"> Isochrone</span>
                  </div>
                }
                value="ISOCHRONE"
              />
              <Tab
                label={
                  <div>
                    <InfoRoundedIcon className="app-tab-icon" />
                    <span className="app-tab-text"> About</span>
                  </div>
                }
                value="ABOUT"
              />
            </Tabs>
          </Toolbar>
        </AppBar>
        <div className="app-toolbar-space">&nbsp;</div>
        <Screen />
      </div>
    </ThemeProvider>
  );
};

const mapStateToProps = state => ({
  page: state.page,
  query: state.location.query,
  type: state.location.type,
});

const mapDispatchToProps = dispatch => {
  return {
    dispatch,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
