import React, { Component, Fragment } from 'react';
import Link from 'redux-first-router-link';

class About extends Component {
  render() {
    return (
      <Fragment>
        <h3>About Us</h3>
        <Link to={{ type: 'HOME' }}>Home</Link>
      </Fragment>
    );
  }
}

export default About;
