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
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import { CHART_COLORS, REACT_VIS_CROSSHAIR_NO_LINE } from '../UIConstants';
import { renderDateRange } from '../helpers/dateTime';

function ServiceFrequencyStats(props) {
  const { tripMetrics, graphParams } = props;

  const [crosshairValues, setCrosshairValues] = React.useState({});

  const headways = tripMetrics ? tripMetrics.interval.headways : null;

  const headways2 =
    tripMetrics && tripMetrics.interval2
      ? tripMetrics.interval2.headways
      : null;

  const headwayData =
    headways && headways.histogram && headways.count
      ? headways.histogram.map(bin => ({
          x0: bin.binStart,
          x: bin.binEnd,
          y: (100 * bin.count) / headways.count,
          count: bin.count,
        }))
      : null;

  const headwayData2 =
    headways2 && headways2.histogram && headways2.count
      ? headways2.histogram.map(bin => ({
          x0: bin.binStart,
          x: bin.binEnd,
          y: (100 * -bin.count) / headways2.count,
          count: bin.count,
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

  const legendItems = graphParams.secondDateRange
    ? [
        {
          title: `${renderDateRange(graphParams.firstDateRange)} (Observed)`,
          color: CHART_COLORS[0],
          strokeWidth: 10,
        },
        {
          title: `${renderDateRange(graphParams.secondDateRange)} (Observed)`,
          color: CHART_COLORS[2],
          strokeWidth: 10,
        },
      ]
    : null;

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
        height={200}
        width={500}
        onMouseLeave={onMouseLeave}
      >
        <HorizontalGridLines />
        <XAxis />
        <YAxis hideLine tickFormat={value => `${Math.abs(value)}%`} />

        <VerticalRectSeries
          data={headwayData}
          onNearestX={onNearestXHeadway}
          stroke="white"
          fill={CHART_COLORS[0]}
          style={{ strokeWidth: 2 }}
        />

        {headwayData2 ? (
          <VerticalRectSeries
            cluster="second"
            data={headwayData2}
            onNearestX={onNearestXHeadway}
            stroke="white"
            fill={CHART_COLORS[2]}
            style={{ strokeWidth: 2 }}
          />
        ) : null}

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
              Arrivals:{' '}
              {crosshairValues.headway[0]
                ? Math.round(crosshairValues.headway[0].count)
                : null}
            </div>
          </Crosshair>
        )}
      </XYPlot>
      {headwayData2 ? (
        <DiscreteColorLegend
          orientation="vertical"
          height={100}
          items={legendItems}
        />
      ) : null}
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
