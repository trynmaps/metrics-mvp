import React from 'react';
import { css } from 'emotion';
import logo from '../assets/images/logo.png';

const Intro = () => (
  <div
    className={css`
      color: #000;
      border-radius: 5px;
      grid-column: col1-start / col3-start;
      grid-row: row1-start;
    `}
  >
    <h1>
      <img src={logo} alt="OpenTransit Logo" width="15%" />
      OpenTransit
    </h1>
  </div>
);

export default Intro;
