import React, { Fragment } from 'react';
import { NavLink } from 'redux-first-router-link';
import { connect } from 'react-redux';

function AppBarLogo(props) {
  return (
    <Fragment>
      <NavLink to={{ type: 'HOME', query: props.query }} exact strict>
        <img
          src={`${process.env.PUBLIC_URL}/images/OpenTransit.png?v3`}
          className="app-logo"
          alt="logo"
        />
      </NavLink>
    </Fragment>
  );
}

const mapStateToProps = state => ({
  query: state.location.query,
});

export default connect(mapStateToProps)(AppBarLogo);
