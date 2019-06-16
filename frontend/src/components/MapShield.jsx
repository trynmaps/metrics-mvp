import React, {Component} from 'react';

export default class MapShield extends Component {
  render() {
    //const perc = this.props.perc || 0;
    const routeText = this.props.routeText;
    const color = this.props.color;
    const waitScaled = this.props.waitScaled; // 0, 1, or 2
    return (
      <svg width="40px" height="40px" viewBox="0 0 40 40" className="donut" aria-labelledby="beers-title beers-desc" role="img">
        
        { routeText.endsWith("R") || routeText.endsWith("X") ? // rapid and express get rectangular/oval shields
            
        (<rect width="30" height={18 + waitScaled*2} x="5" y={10 - waitScaled}
           rx={routeText.endsWith("X") ? (9+waitScaled) : 0}
           fill="white" stroke={color} strokeWidth={waitScaled/1.5 + 1}/>)
        
        : // everything else circular shield
          
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
}

/**
 *
 * original code
 *         <circle className="donut-hole" cx="21" cy="21" r="15.91549430918954" fill="white" role="presentation"></circle>
        <circle className="donut-ring" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#d2d3d4" strokeWidth="3" role="presentation"></circle>
        <circle className="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#ce4b99" strokeWidth="3" 
          strokeDasharray={`${perc} ${100 - perc}`} strokeDashoffset="25" aria-labelledby="donut-segment-1-title donut-segment-1-desc">
        </circle>
*/
