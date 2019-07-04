/**
 * Renders an SVG "shield" representing a Muni route.
 */
export default function MapShield(props) {

  const routeText = props.routeText;
  const color = props.color;
  const waitScaled = props.waitScaled; // 0, 1, or 2 (small/medium/large)
  
  let html = null;

  const r = 9 + waitScaled * 1.25;

  // rapid and express routes get rectangular/rounded rect shields respectively
  
  if (routeText.endsWith("R") || routeText.endsWith("X")) {     

    html = '<div style="width:30px; height:' + (r*2) + 'px; ' +
      'border-radius:' + (routeText.endsWith("X") ? r : 0) + 'px; ';

  } else { // all other routes get circular shields

    html = '<div style="width:' + (r*2) + 'px; height:' + (r*2) + 'px; ' +
      'border-radius: ' + r + 'px; ';
  }

  html += 
    'position:relative; top:5px; left:5px; ' + 
    'border-style:solid; border-color:' + color + '; ' +
    'border-width: ' + (waitScaled/1.5 + 1.0) + 'px;' +
    'background-color:white;' +
    'text-align:center; font-size:' + (75+waitScaled*15) + '%; font-weight: ' + (400+waitScaled*75) + '">' +
    routeText + '</div>';

  return html;
}



/**


      html: MapShield({ waitScaled:waitScaled, color:routeColor, routeText:startMarker.routeID})


let html = null;

const r = 9 + waitScaled * 1.25;

if (startMarker.routeID.endsWith("R") || startMarker.routeID.endsWith("X")) {     

  html = '<div style="width:30px; height:' + (r*2) + 'px; ' +
    'border-radius:' + (startMarker.routeID.endsWith("X") ? r : 0) + 'px; ';

} else {

  html = '<div style="width:' + (r*2) + 'px; height:' + (r*2) + 'px; ' +
    'border-radius: ' + r + 'px;';
}

html += 
  'position:relative; top:5px; left:5px; ' + 
  'border-style:solid; border-color:' + routeColor + '; ' +
  'border-width: ' + (waitScaled/1.5 + 1.0) + 'px;' +
  'background-color:white;' +
  'text-align:center; font-size:' + (75+waitScaled*15) + '%; font-weight: ' + (400+waitScaled*75) + '">' +
  startMarker.routeID + '</div>';

const icon = L.divIcon({
  className: 'custom-icon', // this is needed to turn off the default icon styling (blank square)
//  html: ReactDOMServer.renderToString(<MapShield
//      waitScaled={waitScaled} color={routeColor} routeText={startMarker.routeID}/>)
  html: html

*/





/*

old svg implementation:  

<svg width="36px" height="36px" viewBox="0 0 36 36" role="img">

{
  // rapid and express routes get rectangular/rounded rect shields respectively

  routeText.endsWith("R") || routeText.endsWith("X") ? 

      (<rect width="30" height={18 + waitScaled*2} x="3" y={10 - waitScaled}
          rx={routeText.endsWith("X") ? (9+waitScaled) : 0}
      fill="white" stroke={color} strokeWidth={waitScaled/1.5 + 1}/>)

      : // all other routes get circular shields

        (<circle className="donut-hole" cx="18" cy="18" r={9 + waitScaled*1.25} role="presentation"
        fill="white" stroke={color} strokeWidth={waitScaled/1.5 + 1}/>)

}

<g className="chart-text">
<text fontSize={75+waitScaled*15 + '%'} fontWeight={400+waitScaled*75} textAnchor="middle" dominant-baseline="middle" className="chart-number" x="50%" y="50%">
{routeText}
</text>
</g>
</svg>

*/
