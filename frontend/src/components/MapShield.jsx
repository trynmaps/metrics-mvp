/**
 * Renders an SVG "shield" representing a transit route.
 */
export default function MapShield(props) {
  const routeText = props.routeText;
  const color = props.color;
  const waitScaled = props.waitScaled; // 0, 1, or 2

  let html = null;

  const r = 9 + waitScaled * 1.25;

  // rapid and express routes get rectangular/rounded rect shields respectively

  if (routeText.endsWith('R') || routeText.endsWith('X')) {
    html =
      `<div style="width:30px; height:${r * 2}px; ` +
      `border-radius:${routeText.endsWith('X') ? r : 0}px; `;
  } else {
    // all other routes get circular shields

    html =
      `<div style="width:${r * 2}px; height:${r * 2}px; ` +
      `border-radius: ${r+1}px; `;
  }

  html +=
    `${'position:relative; top:5px; left:5px; ' +
      'border-style:solid; border-color:'}${color}; ` +
    `border-width: ${waitScaled / 1.5 + 1.0}px;` +
    `background-color:white;` +
    `text-align:center; font-size:${75 + waitScaled * 15}%; font-weight: ${400 +
      waitScaled * 75}"><span style="vertical-align: -15%">${routeText}</span></div>`;

  return html;
}
