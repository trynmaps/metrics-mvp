import React from 'react';
import { connect } from 'react-redux';

import './App.css';
import Home from './components/Home';
import About from './components/About';
import NotFound from './components/NotFound';

const App = ({ page }) => {
  const components = {
    Home: <Home />,
    About: <About />,
    NotFound: <NotFound />
  };
  return (
    <div>{components[page]}</div>
  );
};

const mapStateToProps = ({ page }) => ({ page });

export default connect(mapStateToProps)(App);
