import React from 'react';

import Navlink from 'redux-first-router-link';
import { connect } from 'react-redux';

function Home(props) {
  return (
    <div style={{ padding: '0px 20px', maxWidth: '800px' }}>
      <p>
        <strong>Welcome to OpenTransit!</strong> This project is dedicated to
        empowering people around the world to work with local governments to
        improve public transit using data.
      </p>
      <p>
        OpenTransit provides statistics and visualizations of the performance of
        public transit systems, such as on-time rates, service frequencies, wait
        times, and trip times, based on historical GPS data collected from
        transit vehicles.
      </p>
      <p>
        This app is still in development, but feel free to check out our data
        through the following tools:
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
