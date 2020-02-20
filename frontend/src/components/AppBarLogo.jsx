import React, { Fragment } from 'react';
import { NavLink } from 'redux-first-router-link';

export default function AppBarLogo(props) {
  const logoStyle = {
    maxHeight: '48px',
    paddingRight: '8px',
  };

  return (
    <Fragment>
      <NavLink to={{ type: 'DASHBOARD', query: props.query }} exact strict>
        <img
          src={`${process.env.PUBLIC_URL}/images/OpenTransit.png`}
          style={logoStyle}
          alt="logo"
        />
      </NavLink>
    </Fragment>
  );
}
