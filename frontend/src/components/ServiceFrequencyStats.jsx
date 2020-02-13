import React from 'react';
import { connect } from 'react-redux';
import {
  XYPlot,
  HorizontalGridLines,
  XAxis,
  YAxis,
  ChartLabel,
  VerticalRectSeries,
  Crosshair,
} from 'react-vis';
import { Typography } from '@material-ui/core';
import { CHART_COLORS, REACT_VIS_CROSSHAIR_NO_LINE } from '../UIConstants';

function ServiceFrequencyStats(props) {
  const { tripMetrics } = props;

  const [crosshairValues, setCrosshairValues] = React.useState({});

  const headways = tripMetrics ? tripMetrics.interval.headways : null;

  const headwayData =
    headways && headways.histogram
      ? headways.histogram.map(bin => ({
          x0: bin.binStart,
          x: bin.binEnd,
          y: bin.count,
        }))
      : null;

  /**
   * Event handler for onMouseLeave.
   * @private
   */
  function onMouseLeave() {
    setCrosshairValues({});
  }

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  function onNearestXHeadway(value, { index }) {
    setCrosshairValues({ headway: [headwayData[index]] });
  }

  return headways ? (
    <>
      <Typography variant="h5">Service Frequency by Time of Day</Typography>
      TODO - bar chart with actual/scheduled headways
      <br />
      <br />
      <Typography variant="h5">
        Distribution of Headways (Time Between Vehicles)
      </Typography>
      <div>
        {headways.count} arrivals, median headway {Math.round(headways.median)}{' '}
        minutes, max headway {Math.round(headways.max)} minutes
      </div>
      <XYPlot
        xDomain={[0, Math.max(60, Math.round(headways.max) + 5)]}
        height={300}
        width={500}
        onMouseLeave={onMouseLeave}
      >
        <HorizontalGridLines />
        <XAxis />
        <YAxis hideLine />

        <VerticalRectSeries
          data={headwayData}
          onNearestX={onNearestXHeadway}
          stroke="white"
          fill={CHART_COLORS[0]}
          style={{ strokeWidth: 2 }}
        />

        <ChartLabel
          text="arrivals"
          className="alt-y-label"
          includeMargin={false}
          xPercent={0.06}
          yPercent={0.06}
          style={{
            transform: 'rotate(-90)',
            textAnchor: 'end',
          }}
        />

        <ChartLabel
          text="minutes"
          className="alt-x-label"
          includeMargin={false}
          xPercent={0.9}
          yPercent={0.94}
        />

        {crosshairValues.headway && (
          <Crosshair
            values={crosshairValues.headway}
            style={REACT_VIS_CROSSHAIR_NO_LINE}
          >
            <div className="rv-crosshair__inner__content">
              Arrivals: {Math.round(crosshairValues.headway[0].y)}
            </div>
          </Crosshair>
        )}
      </XYPlot>
      TODO - show scheduled distribution of headways
      <br />
      <br />
      <Typography variant="h5">Headway Adherence</Typography>
      TODO - distribution of differences between actual headways and scheduled
      headways
    </>
  ) : (
    'Select a direction, origin stop, and destination stop to see service frequency metrics.'
  );
}

const mapStateToProps = state => ({
  tripMetrics: state.tripMetrics.data,
  graphParams: state.graphParams,
});

export default connect(mapStateToProps)(ServiceFrequencyStats);
