import React, { Fragment } from 'react';
import { NavLink } from 'redux-first-router-link';

export default function Landing() {
  return (
    <Fragment>
      <button>
        <NavLink
          to={{ type: 'HOME' }}
          activeStyle={{ fontWeight: "bold", color: 'purple' }}
          exact={true}
          strict={true}
        >
          Home
        </NavLink>
      </button>
      <button>
        <NavLink
          to={{ type: 'ABOUT' }}
          activeStyle={{ fontWeight: "bold", color: 'purple' }}
          exact={true}
          strict={true}
        >
          About
        </NavLink>
      </button>
      <button>
        <NavLink
          to={{ type: 'LANDING' }}
          activeStyle={{ fontWeight: "bold", color: 'purple' }}
          exact={true}
          strict={true}
        >
          Landing
        </NavLink>
      </button>
      <h3>Landing Page</h3>
    </Fragment>
  );
}
