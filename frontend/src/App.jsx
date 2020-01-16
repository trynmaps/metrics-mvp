import React from 'react';
import { connect } from 'react-redux';

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
  NotFound
};

const App = ({ page }) => {
  const Component = Components[page];
  return <Component />;
};

const mapStateToProps = ({ page }) => ({ page });

export default connect(mapStateToProps)(App);
