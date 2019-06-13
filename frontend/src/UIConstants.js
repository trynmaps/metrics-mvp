/**
 * Constants for the UI that allow for reconfiguration.
 */

export const CHART_COLORS = ['#a4a6a9', '#aa82c5']; // placeholder colors: gray and purple from nyc busstats

export const PLANNING_PERCENTILE = 90; // use this percentile (e.g. 90th) for waits/travel times for planning purposes
// the idea here is to filter out extreme/maximum wait/travel values so that the user knows long the trip
// will "usually" take.  So for 90th percentile this would be the historic performance 9 times out of 10.

export const REACT_VIS_CROSSHAIR_NO_LINE = { line: { background: 'none' } }; // a commonly used style option for react-vis
// Crosshairs (hovers) where we don't want a crosshair line spanning the chart, just the hover.
