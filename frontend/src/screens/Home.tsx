import React from 'react';

import Navlink from 'redux-first-router-link';
import { connect } from 'react-redux';

function Home(props) {
  return (
    <div style={{ padding: '0px 20px', maxWidth: '800px' }}>
      <p>
        <em>
          OpenTransit is currently in development. All metrics are unverified
          and unofficial.
        </em>
      </p>
      <div>
        <h3 style={{ marginBottom: '5px' }}>
          <Navlink
            to={{
              type: 'DASHBOARD',
              query: props.query,
            }}
          >
            Metrics
          </Navlink>
        </h3>
        <div>
          Statistics and visualizations of the historical performance of each
          route.
        </div>
      </div>
      <div>
        <h3 style={{ marginBottom: '5px' }}>
          <Navlink
            to={{
              type: 'ISOCHRONE',
              query: props.query,
            }}
          >
            Isochrone
          </Navlink>
        </h3>
        <div>
          Visualize where you can travel in a certain amount of time via public
          transit.
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '5px' }}>
          <Navlink
            to={{
              type: 'ABOUT',
              query: props.query,
            }}
          >
            About
          </Navlink>
        </h3>
        <div>Learn about OpenTransit and our mission.</div>
      </div>
    </div>
  );
}

const mapStateToProps = state => ({
  query: state.location.query,
});

export default connect(mapStateToProps)(Home);
