import React, { Fragment, useState } from 'react';
import {
  XYPlot,
  HorizontalGridLines,
  VerticalBarSeries,
  XAxis,
  YAxis,
  ChartLabel,
  Crosshair,
} from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import { useTheme } from '@material-ui/core/styles';
import StartStopIcon from '@material-ui/icons/DirectionsTransit';
import WatchLaterOutlinedIcon from '@material-ui/icons/WatchLaterOutlined';
import { REACT_VIS_CROSSHAIR_NO_LINE } from '../UIConstants';
import '../../node_modules/react-vis/dist/style.css';

/**
 * Bar chart of average and planning percentile wait and time across the day.
 */
function InfoJourneyChart(props) {
  const [crosshairValues, setCrosshairValues] = useState([]); // tooltip starts out empty

  /**
   * Event handler for onMouseLeave.
   * @private
   */
  const onMouseLeave = () => {
    setCrosshairValues([]);
  };

  /**
   * Event handler for onValueMouseOver.
   * @param {Object} value Data point hovered over..
   * @private
   */
  const onValue = value => {
    setCrosshairValues([value]);
  };

  const theme = useTheme();

  const { firstWaits, secondWaits, firstTravels, secondTravels } = props;

  const legendItems = (travelColor, waitColor) => [
    {
      title: (
        <Fragment>
          <StartStopIcon fontSize="small" style={{ verticalAlign: 'sub' }} />
          &nbsp;Travel
        </Fragment>
      ),
      color: travelColor,
      strokeWidth: 10,
    },
    {
      title: (
        <Fragment>
          <WatchLaterOutlinedIcon
            fontSize="small"
            style={{ verticalAlign: 'sub' }}
          />
          &nbsp;Wait
        </Fragment>
      ),
      color: waitColor,
      strokeWidth: 10,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex' }}>
        <XYPlot
          xType="ordinal"
          height={125}
          width={175}
          margin={{ left: 40, right: 10, top: 0, bottom: 30 }}
          stackBy="y"
          onMouseLeave={onMouseLeave}
        >
          <HorizontalGridLines />
          <XAxis />
          <YAxis hideLine />

          <VerticalBarSeries
            cluster="first"
            color={theme.palette.primary.dark}
            onValueMouseOver={onValue}
            data={[
              { x: 'Typical', y: firstWaits[0] },
              { x: 'Planning', y: firstWaits[1] },
            ]}
          />

          <VerticalBarSeries
            cluster="first"
            color={theme.palette.primary.light}
            onValueMouseOver={onValue}
            data={[
              { x: 'Typical', y: firstTravels[0] },
              { x: 'Planning', y: firstTravels[1] },
            ]}
          />

          <VerticalBarSeries
            cluster="second"
            color={theme.palette.secondary.dark}
            onValueMouseOver={onValue}
            data={[
              { x: 'Typical', y: secondWaits[0] },
              { x: 'Planning', y: secondWaits[1] },
            ]}
          />

          <VerticalBarSeries
            cluster="second"
            color={theme.palette.secondary.light}
            onValueMouseOver={onValue}
            data={[
              { x: 'Typical', y: secondTravels[0] },
              { x: 'Planning', y: secondTravels[1] },
            ]}
          />

          <ChartLabel
            text="minutes"
            className="alt-y-label"
            includeMargin={false}
            xPercent={0.0}
            yPercent={0.06}
            style={{
              transform: 'rotate(-90)',
              textAnchor: 'end',
            }}
          />

          {crosshairValues.length > 0 && (
            <Crosshair
              values={crosshairValues}
              style={REACT_VIS_CROSSHAIR_NO_LINE}
            >
              <div className="rv-crosshair__inner__content">
                {Math.round(
                  crosshairValues[0].y -
                    (crosshairValues[0].y0 ? crosshairValues[0].y0 : 0),
                )}{' '}
                min
              </div>
            </Crosshair>
          )}
        </XYPlot>
        <DiscreteColorLegend
          orientation="vertical"
          width={110}
          items={legendItems(
            theme.palette.primary.light,
            theme.palette.primary.dark,
          )}
        />
        <DiscreteColorLegend
          orientation="vertical"
          width={110}
          items={legendItems(
            theme.palette.secondary.light,
            theme.palette.secondary.dark,
          )}
        />
      </div>
    </div>
  );
}

export default InfoJourneyChart;
