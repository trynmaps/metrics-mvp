import React from 'react';
import { css } from 'emotion';


const Header = () => (
  <div className={css`
        color: #000;
        border-radius: 5px;
        grid-column: col1-start / col3-start;
        grid-row: row1-start;
       `
       }
  >
    <div className="text-center">
      <img src="logo.png" height="80" />
    </div>
  </div>
);

export default Header;
