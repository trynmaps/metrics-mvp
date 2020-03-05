import React, { Fragment } from 'react';

import { AppBar, Box, Tab, Tabs } from '@material-ui/core';

import RouteSummaryCards from './RouteSummaryCards';
import TravelTimeChart from './TravelTimeChart';
import MareyChart from './MareyChart';

/**
 * Renders an "nyc bus stats" style summary of a route and direction.
 *
 * @param {any} props
 */
export default function RouteSummary() {
  const [tabValue, setTabValue] = React.useState(0);

  function handleTabChange(event, newValue) {
    setTabValue(newValue);
  }

  function a11yProps(index) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }

  const SUMMARY = 0;
  const TRAVEL_TIME = 1;
  const MAREY_CHART = 2;

  return (
    <Fragment>
      <br />
      <AppBar position="static" color="default">
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="tab bar"
          variant="scrollable"
          scrollButtons="on"
        >
          <Tab
            style={{ minWidth: 72 }}
            label="Summary"
            {...a11yProps(SUMMARY)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Travel Time"
            {...a11yProps(TRAVEL_TIME)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Marey Chart"
            {...a11yProps(MAREY_CHART)}
          />
        </Tabs>
      </AppBar>

      <Box p={2} hidden={tabValue !== SUMMARY}>
        <RouteSummaryCards />
      </Box>
      <Box
        p={2}
        hidden={tabValue !== TRAVEL_TIME}
        style={{ overflowX: 'auto' }}
      >
        <TravelTimeChart />
      </Box>
      <Box
        p={2}
        hidden={tabValue !== MAREY_CHART}
        style={{ overflowX: 'auto' }}
      >
        <MareyChart hidden={tabValue !== MAREY_CHART} />
      </Box>
    </Fragment>
  );
}
