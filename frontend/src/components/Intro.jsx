import React from 'react';
import { css } from 'emotion';


const Intro = () => (
  <div className={css`
        color: #000;
        border-radius: 5px;
        grid-column: col1-start / col3-start;
        grid-row: row1-start;
       `
       }
  >
    <h1> Open transit logo</h1>
    <p>
      {' '}
      some infosome infosome infosome infosome infosome infosome infosome
      infosome infosome infosome infosome infosome infosome infosome
      infosome infosome infosome infosome infosome infosome
      infosome infosome infosome infosome infosome infosome
       infosome infosome infosome infosome info
    </p>
  </div>
);

export default Intro;
