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

/**
 * This is a debugging chart that helps finds routes with anomalous
 * overall speeds or waits.  It plots routes by wait on the x-axis (more
 * frequent on the right) and speed on the y-axis (faster on top).
 *
 * @param {any} props
 */
function QuadrantChart(props) {
  const { statsByRouteId } = props;

  const quadrantData = [];

  let maxSpeed = 0;
  let maxWaitTime = 0;

  Object.keys(statsByRouteId).forEach(function(routeId) {
    const stats = statsByRouteId[routeId];
    if (stats.medianWaitTime != null && stats.averageSpeed != null) {
      maxWaitTime = Math.max(maxWaitTime, stats.medianWaitTime);
      maxSpeed = Math.max(maxSpeed, stats.averageSpeed);
      quadrantData.push({
        x: stats.medianWaitTime,
        y: stats.averageSpeed,
        title: stats.routeId,
      });
    }
  });

  return (
    <XYPlot
      height={600}
      width={1000}
      xDomain={[maxWaitTime, 0]}
      yDomain={[0, maxSpeed]}
    >
      <HorizontalGridLines />
      <VerticalGridLines />
      <XAxis top={300} style={{ text: { stroke: 'none', fill: '#cccccc' } }} />
      <YAxis left={500} style={{ text: { stroke: 'none', fill: '#cccccc' } }} />

      <CustomSVGSeries
        className="custom-marking"
        customComponent={row => {
          return (
            <g className="inner-inner-component">
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
  statsByRouteId: state.agencyMetrics.statsByRouteId,
});

export default connect(mapStateToProps)(QuadrantChart);
