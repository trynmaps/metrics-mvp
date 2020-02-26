import React from 'react';
import { connect } from 'react-redux';
import { createMuiTheme } from '@material-ui/core/styles';
import { ThemeProvider } from '@material-ui/styles';

import './App.css';
import About from './components/About';
import Landing from './components/Landing';
import NotFound from './components/NotFound';
import Dashboard from './screens/Dashboard';
import RouteScreen from './screens/RouteScreen';
import DataDiagnostic from './screens/DataDiagnostic';
import Isochrone from './screens/Isochrone';

const Components = {
  About,
  Isochrone,
  Landing,
  Dashboard,
  RouteScreen,
  DataDiagnostic,
  NotFound,
};

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#0177BF',
    },
    secondary: {
      main: '#D02143',
    },
  },
});
const App = ({ page }) => {
  const Component = Components[page];
  return (
    <ThemeProvider theme={theme}>
      <Component />
    </ThemeProvider>
  );
};

const mapStateToProps = ({ page }) => ({ page });

export default connect(mapStateToProps)(App);
