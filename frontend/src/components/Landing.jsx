import React, { Fragment } from 'react';
import { NavLink } from 'redux-first-router-link';

export default function Landing() {
  return (
    <Fragment>
      <button type="button">
        <NavLink
          to={{ type: 'HOME' }}
          activeStyle={{ fontWeight: 'bold', color: 'purple' }}
          exact
          strict
        >
          Home
        </NavLink>
      </button>
      <button type="button">
        <NavLink
          to={{ type: 'ABOUT' }}
          activeStyle={{ fontWeight: 'bold', color: 'purple' }}
          exact
          strict
        >
          About
        </NavLink>
      </button>
      <button type="button">
        <NavLink
          to={{ type: 'LANDING' }}
          activeStyle={{ fontWeight: 'bold', color: 'purple' }}
          exact
          strict
        >
          Landing
        </NavLink>
      </button>
      <h3>Landing Page</h3>
    </Fragment>
  );
}
