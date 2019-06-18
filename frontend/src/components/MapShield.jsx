import React from 'react';

/**
 * Renders an SVG "shield" representing a Muni route.
 */
export default function MapShield(props) {

  const routeText = props.routeText;
  const color = props.color;
  const waitScaled = props.waitScaled; // 0, 1, or 2
  return (
      <svg width="40px" height="40px" viewBox="0 0 40 40" role="img">

      {
        // rapid and express routes get rectangular/rounded rect shields respectively

        routeText.endsWith("R") || routeText.endsWith("X") ? 

            (<rect width="30" height={18 + waitScaled*2} x="5" y={10 - waitScaled}
                rx={routeText.endsWith("X") ? (9+waitScaled) : 0}
            fill="white" stroke={color} strokeWidth={waitScaled/1.5 + 1}/>)

            : // all other routes get circular shields

              (<circle className="donut-hole" cx="20" cy="20" r={9 + waitScaled*1.25} role="presentation"
              fill="white" stroke={color} strokeWidth={waitScaled/1.5 + 1}/>)

      }

      <g className="chart-text">
      <text fontSize={75+waitScaled*15 + '%'} fontWeight={400+waitScaled*75} textAnchor="middle" className="chart-number" x="50%" y="57%">
      {routeText}
      </text>
      </g>
      </svg>
  );
}
