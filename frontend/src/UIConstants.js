/**
 * Constants for the UI that allow for reconfiguration.
 */

// placeholder colors: gray and purple from nyc busstats
export const CHART_COLORS = ['#a4a6a9', '#aa82c5'];

// use this percentile (e.g. 90th) for waits/travel times
// for planning purposes the idea here is to filter out
// extreme/maximum wait/travel values so that the user knows
// long the trip will "usually" take.  So for 90th percentile
// this would be the historic performance 9 times out of 10.
export const PLANNING_PERCENTILE = 90;

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
  { value: '03:00-07:00', shortLabel: 'Early Morning', restOfLabel: ' (3AM - 7AM)' },
  { value: '07:00-10:00', shortLabel: 'AM Peak', restOfLabel: ' (7AM - 10AM)' },
  { value: '10:00-16:00', shortLabel: 'Midday', restOfLabel: ' (10AM - 4PM)' },
  { value: '16:00-19:00', shortLabel: 'PM Peak', restOfLabel: ' (4PM - 7PM)' },
  { value: '19:00-03:00+1', shortLabel: 'Late Evening', restOfLabel: ' (7PM - 3AM)' },
]