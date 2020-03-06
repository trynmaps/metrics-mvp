/* eslint-disable react/no-array-index-key */
import React, { useState } from 'react';

import {
  XYPlot,
  HorizontalGridLines,
  XAxis,
  YAxis,
  ChartLabel,
  Crosshair,
} from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';

function getDefaultYDomain(series) {
  let yMin = 0;
  let yMax = 0;

  series.forEach(s => {
    if (s.data != null) {
      s.data.forEach(d => {
        const y = d.y;
        if (y != null) {
          yMin = Math.min(y, yMin);
          yMax = Math.max(y, yMax);
        }
      });
    }
  });
  return [yMin, yMax];
}

/*
 * Wrapper around react-vis XYPlot that makes it easier to create line charts, bar charts, histograms, etc.
 * with consistent UI.
 *
 * SimpleChart automatically manages crosshairs and positions labels, so that it isn't necessary to
 * handle this behavior directly via the low-level APIs provided by react-vis.
 */
export default function SimpleChart(props) {
  const {
    series,
    component,
    xType,
    height,
    width,
    yUnits,
    xUnits,
    stackBy,
  } = props;

  const [crosshairValues, setCrosshairValues] = useState(null);

  const dataHasX0 =
    series.length > 0 &&
    series[0].data != null &&
    series[0].data.length > 0 &&
    series[0].data[0].x0 != null;

  let xAxisMaxTicks = props.xAxisMaxTicks;
  if (dataHasX0 && xAxisMaxTicks == null) {
    xAxisMaxTicks = series[0].data.length;
  }

  const xFormat = props.xFormat || (x => `${x}`);
  const yFormat = props.yFormat || (y => `${y}`);

  const yDomain =
    props.yDomain ||
    (stackBy === 'y' ? null : getDefaultYDomain(series, stackBy));

  const getDataValues = xValue => {
    return series.map(s => (s.data ? s.data.find(d => d.x === xValue) : null));
  };

  const onValueMouseOver = d => {
    setCrosshairValues(getDataValues(d.x));
  };

  const onNearestX = d => {
    setCrosshairValues(getDataValues(d.x));
  };

  const onMouseLeave = () => {
    setCrosshairValues(null);
  };

  const nonNullCrosshairValue = crosshairValues
    ? crosshairValues.find(v => v != null)
    : null;

  return (
    <>
      <XYPlot
        height={height}
        width={width}
        xType={xType}
        margin={{ left: 50, right: 25, top: 25 }}
        yDomain={yDomain}
        stackBy={stackBy}
        onMouseLeave={onMouseLeave}
      >
        <HorizontalGridLines />
        <XAxis
          tickFormat={xFormat}
          tickTotal={xAxisMaxTicks}
          style={{ text: { fontSize: '13px' } }}
        />
        <YAxis
          hideLine
          tickFormat={yFormat}
          style={{ text: { fontSize: '13px' } }}
        />
        {series.map((s, index) => {
          const SeriesComponent = s.component || component;
          return (
            <SeriesComponent
              key={index}
              getNull={d => d.y !== null}
              onNearestX={!dataHasX0 ? onNearestX : null}
              onValueMouseOver={dataHasX0 ? onValueMouseOver : null}
              onValueMouseOut={dataHasX0 ? onMouseLeave : null}
              {...s}
            />
          );
        })}
        {yUnits ? (
          <ChartLabel
            text={yUnits}
            includeMargin={false}
            className="alt-y-label"
            xPercent={0}
            yPercent={height ? 20 / height : 0.05}
            style={{
              textAnchor: 'end',
            }}
          />
        ) : null}
        {xUnits ? (
          <ChartLabel
            text={xUnits}
            includeMargin={false}
            className="alt-x-label"
            xPercent={0.5}
            yPercent={1 + (height ? 80 / height : 0)}
            style={{
              textAnchor: 'middle',
            }}
          />
        ) : null}

        {crosshairValues && (
          <Crosshair
            values={crosshairValues}
            style={{ line: { background: 'none' } }}
          >
            <div
              className="rv-crosshair__inner__content"
              style={{ whiteSpace: 'nowrap' }}
            >
              {nonNullCrosshairValue.x0 != null
                ? `${xFormat(nonNullCrosshairValue.x0)} to `
                : null}
              {xFormat(nonNullCrosshairValue.x)} {xUnits}
              {series.length > 1 ? (
                series.map((s, index) =>
                  crosshairValues[index] ? (
                    <div key={index}>
                      {s.title}: {yFormat(crosshairValues[index].y)} {yUnits}
                    </div>
                  ) : null,
                )
              ) : (
                <>
                  : {yFormat(nonNullCrosshairValue.y)} {yUnits}
                </>
              )}
            </div>
          </Crosshair>
        )}
      </XYPlot>
      {series[0].title ? (
        <DiscreteColorLegend
          width={width}
          items={series.map(s => {
            return { ...s, strokeWidth: 14 };
          })}
        />
      ) : null}
    </>
  );
}
