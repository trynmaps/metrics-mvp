import React, { Fragment } from 'react';
import { NavLink } from 'redux-first-router-link';

export default function AppBarLogo(props) {
  const logoStyle = {
    maxHeight: '38px',
    paddingTop: '5px',
    paddingLeft: '5px',
    paddingRight: '14px',
  };

  return (
    <Fragment>
      <NavLink to={{ type: 'DASHBOARD', query: props.query }} exact strict>
        <img
          src={`${process.env.PUBLIC_URL}/images/OpenTransit.png?v3`}
          style={logoStyle}
          alt="logo"
        />
      </NavLink>
    </Fragment>
  );
}
