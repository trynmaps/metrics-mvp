/**
 * Constants for the UI that allow for reconfiguration.
 */

import React from 'react';
import indigo from '@material-ui/core/colors/indigo';
import DirectionsBusIcon from '@material-ui/icons/DirectionsBusOutlined';
import DirectionsBoatIcon from '@material-ui/icons/DirectionsBoat';
import DirectionsTransitIcon from '@material-ui/icons/DirectionsTransit';
import SubwayIcon from '@material-ui/icons/Subway';
import TrainIcon from '@material-ui/icons/Train';
import TramIcon from '@material-ui/icons/TramOutlined';



// Colors definition:
// This section its should be use to declare an object color
// that contain the colors used in the application
export const Colors = {
  GRAY: '#a4a6a9',
  PURPLE: '#aa82c5',
  BLUE: 'blue',
  RED: 'red',
  GREEN: 'green',
  INDIGO: indigo[400],
};

// placeholder colors: gray and purple from nyc busstats
export const CHART_COLORS = [Colors.GRAY, Colors.PURPLE];

// use this percentile (e.g. 90th) for waits/travel times
// for planning purposes the idea here is to filter out
// extreme/maximum wait/travel values so that the user knows
// long the trip will "usually" take.  So for 90th percentile
// this would be the historic performance 9 times out of 10.
export const PLANNING_PERCENTILE = 90;
export const TENTH_PERCENTILE = 10;

// a commonly used style option for react-vis
// Crosshairs (hovers) where we don't want a crosshair line
// spanning the chart, just the hover.
export const REACT_VIS_CROSSHAIR_NO_LINE = { line: { background: 'none' } };

// Sentinel value representing the "All Day" time range (no start time and no
// end time).  Cannot use empty string because the Select does not match it
// with a MenuItem having an empty value.
export const TIME_RANGE_ALL_DAY = 'allday';

// Values and labels for time ranges.  The value gets split on '-' to create
// start and end times for the back end.  The shortLabel plus restOfLabel forms
// the label for the MenuItem, and the shortLabel can be used by itself in read-only
// contexts.
export const TIME_RANGES = [
  { value: TIME_RANGE_ALL_DAY, shortLabel: 'All Day', restOfLabel: '' },
  { value: '07:00-19:00', shortLabel: 'Daytime', restOfLabel: ' (7AM - 7PM)' },
  {
    value: '03:00-07:00',
    shortLabel: 'Early Morning',
    restOfLabel: ' (3AM - 7AM)',
  },
  { value: '07:00-10:00', shortLabel: 'AM Peak', restOfLabel: ' (7AM - 10AM)' },
  { value: '10:00-16:00', shortLabel: 'Midday', restOfLabel: ' (10AM - 4PM)' },
  { value: '16:00-19:00', shortLabel: 'PM Peak', restOfLabel: ' (4PM - 7PM)' },
  {
    value: '19:00-03:00+1',
    shortLabel: 'Late Evening',
    restOfLabel: ' (7PM - 3AM)',
  },
];

export const MAX_DATE_RANGE = 90; // largest date range allowed, in days (30 might be more performant)

// RadioGroup expects values to be strings, not numbers.
export const DATE_RANGES = [
  { value: '1', label: 'Yesterday' },
  { value: '7', label: 'Last week' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

// Values are Moment days of the week (0-6)
export const WEEKDAYS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
];

export const WEEKENDS = [
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
];

// Marey chart:  how long of a dwell at a stop results in a second data point for exit.
export const DWELL_THRESHOLD_SECS = 120;

/*
 * Route type emojis.
 *
 * 0 - Tram, Streetcar, Light rail. Any light rail or street level system within a metropolitan area.
 * 1 - Subway, Metro. Any underground rail system within a metropolitan area.
 * 2 - Rail. Used for intercity or long-distance travel.
 * 3 - Bus. Used for short- and long-distance bus routes.
 * 4 - Ferry. Used for short- and long-distance boat service.
 * 5 - Cable car. Used for street-level cable cars where the cable runs beneath the car.
 * 6 - Gondola, Suspended cable car. Typically used for aerial cable cars where the car is suspended from the cable.
 * 7 - Funicular. Any rail system designed for steep inclines.
 */
export const ROUTE_TYPE_EMOJIS = {
  '0': { symbol: '🚈', label: 'Light Rail', muiIcon: TramIcon }, /* light rail, or railway car: 🚃, or tram: 🚊, tram car: 🚋  */
  '1': { symbol: '🚇', label: 'Subway', muiIcon: SubwayIcon }, /* metro */
  '2': { symbol: '🚆', label: 'Rail', muiIcon: TrainIcon }, /* train, or bullet train: 🚅, high-speed train: 🚄, locomotive: 🚂 */
  '3': { symbol: '🚌', label: 'Bus', muiIcon: DirectionsBusIcon}, /* bus, or oncoming bus: 🚍, trolley bus: 🚎 */
  '4': { symbol: '⛴', label: 'Ferry', muiIcon: DirectionsBoatIcon}, /* ferry, or ship: ️🚢 */
  '5': { symbol: '🚋', label: 'Cable Car', muiIcon: TramIcon}, /* tram car (nothing better available) */
  '6': { symbol: '🚠', label: 'Gondola', muiIcon: DirectionsTransitIcon}, /* mountain cableway, or aerial tramway: 🚡 */
  '7': { symbol: '🚞', label: 'Funicular', muiIcon: TramIcon}, /* mountain railway */
}

export function RouteIcon(props) {
  const emojiProps = ROUTE_TYPE_EMOJIS[props.routeType];

  // JSX type can be a capitalized variable.
  if (emojiProps) {
    const IconType = emojiProps.muiIcon;
    return <IconType {...props} />;
  } else {
    return null;
  }
}
