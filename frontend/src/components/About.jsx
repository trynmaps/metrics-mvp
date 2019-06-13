import React, { Component, Fragment } from 'react';
import { NavLink } from 'redux-first-router-link';

class About extends Component {
  render() {
    return (
      <Fragment>
        <button>
          <NavLink
            to={{ type: 'HOME' }}
            activeStyle={{ fontWeight: 'bold', color: 'purple' }}
            exact
            strict
          >
            Home
          </NavLink>
        </button>
        <button>
          <NavLink
            to={{ type: 'ABOUT' }}
            activeStyle={{ fontWeight: 'bold', color: 'purple' }}
            exact
            strict
          >
            About
          </NavLink>
        </button>
        <button>
          <NavLink
            to={{ type: 'LANDING' }}
            activeStyle={{ fontWeight: 'bold', color: 'purple' }}
            exact
            strict
          >
            Landing
          </NavLink>
        </button>
        <h3>About Us</h3>
      </Fragment>
    );
  }
}

export default About;
