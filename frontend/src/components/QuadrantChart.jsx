import React from 'react';

import { connect } from 'react-redux';
import {
  XYPlot,
  HorizontalGridLines,
  VerticalGridLines,
  XAxis,
  YAxis,
  ChartLabel,
  CustomSVGSeries,
} from 'react-vis';
import { getAllWaits, getAllSpeeds } from '../helpers/routeCalculations';

/**
 * This is a debugging chart that helps finds routes with anomalous
 * overall speeds or waits.  It plots routes by wait on the x-axis (more
 * frequent on the right) and speed on the y-axis (faster on top).
 *
 * @param {any} props
 */
function QuadrantChart(props) {
  const allWaits = getAllWaits(
    props.waitTimesCache,
    props.graphParams,
    props.routes,
  );
  const allSpeeds = getAllSpeeds(
    props.tripTimesCache,
    props.graphParams,
    props.routes,
  );

  const quadrantData = allSpeeds
    ? allSpeeds.map(speed => {
        const waitObj = allWaits.find(
          myWaitObj => myWaitObj.routeId === speed.routeId,
        );
        return {
          x: waitObj ? waitObj.wait : 0,
          y: speed.speed,
          title: speed.routeId,
        };
      })
    : [];

  return (
    <XYPlot height={600} width={1000} xDomain={[30, 0]} xxyDomain={[0, 30]}>
      <HorizontalGridLines />
      <VerticalGridLines />
      <XAxis top={300} style={{ text: { stroke: 'none', fill: '#cccccc' } }} />
      <YAxis left={500} style={{ text: { stroke: 'none', fill: '#cccccc' } }} />

      <CustomSVGSeries
        className="custom-marking"
        customComponent={(row, positionInPixels) => {
          return (
            <g className="inner-inner-component" dummy-var={positionInPixels}>
              <circle cx="0" cy="0" r={row.size || 3} fill="#aa82c5" />
              <text x={0} y={0} fontSize="75%" fill="#450042">
                <tspan x="5" y="4">{`${row.title}`}</tspan>
              </text>
            </g>
          );
        }}
        data={quadrantData}
      />

      <ChartLabel
        text="speed (mph)"
        className="alt-y-label"
        includeMargin={false}
        xPercent={0.54}
        yPercent={0.06}
        style={{
          transform: 'rotate(-90)',
          textAnchor: 'end',
        }}
      />

      <ChartLabel
        text="avg wait (min)"
        className="alt-x-label"
        includeMargin={false}
        xPercent={0.94}
        yPercent={0.5}
      />
    </XYPlot>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
  graphParams: state.routes.graphParams,
  waitTimesCache: state.routes.waitTimesCache,
  tripTimesCache: state.routes.tripTimesCache,
});

export default connect(mapStateToProps)(QuadrantChart);
