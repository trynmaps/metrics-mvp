import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import './App.css';
import Home from './components/Home';
import About from './components/About';
import Landing from './components/Landing';
import NotFound from './components/NotFound';

const App = ({ page }) => {
  const components = {
    Home: <Home />,
    About: <About />,
    Landing: <Landing />,
    NotFound: <NotFound />
  };
  return (
    <Fragment>
      {components[page]}
    </Fragment>
  );
};

const mapStateToProps = ({ page }) => ({ page });

export default connect(mapStateToProps)(App);
