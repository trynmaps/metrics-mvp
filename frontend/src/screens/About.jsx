import React from 'react';

export default function About() {
  return (
    <div style={{ padding: '0px 20px', maxWidth: '800px' }}>
      <p>
        OpenTransit is dedicated to empowering people around the world to work
        with local governments to improve public transit using data.
      </p>
      <p>
        OpenTransit provides statistics and visualizations of the performance of
        public transit systems, such as on-time rates, service frequencies, wait
        times, and trip times, based on historical GPS data collected from
        transit vehicles.
      </p>
      <p>
        OpenTransit can be used by:
        <ul>
          <li>
            Transit riders, to get more accurate expectations about transit, and
            to explore where to use transit
          </li>
          <li>
            Transit advocates, to get data to help advocate for transit service
            improvements
          </li>
          <li>Journalists, as a data source for news articles about transit</li>
          <li>
            Transit agencies, to gain insights about their own performance to
            help improve service
          </li>
        </ul>
      </p>
      <p>
        OpenTransit is an open-source project developed by volunteers at Code
        for PDX and Code for San Francisco.
      </p>
    </div>
  );
}
