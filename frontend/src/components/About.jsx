import React, { Component, Fragment } from 'react';
import { Link, NavLink } from 'redux-first-router-link';

class About extends Component {
  render() {
    return (
      <Fragment>
        <button><NavLink 
        to={{ type: 'HOME' }}
        activeStyle={{ fontWeight: "bold", color: 'purple' }}
        exact={true}
        strict={true}
        >Home</NavLink></button>
        <button><NavLink 
        to={{ type: 'ABOUT' }}
        activeStyle={{ fontWeight: "bold", color: 'purple' }}
        exact={true}
        strict={true}
        >About</NavLink></button>
        <button><NavLink 
        to={{ type: 'LANDING' }}
        activeStyle={{ fontWeight: "bold", color: 'purple' }}
        exact={true}
        strict={true}
        >Landing</NavLink></button>
        <h3>About Us</h3>
      </Fragment>
    );
  }
}

export default About;
