import React from 'react';
import { NavLink } from 'redux-first-router-link';
import { connect } from 'react-redux';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import MenuIcon from '@material-ui/icons/Menu';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import MapRoundedIcon from '@material-ui/icons/MapRounded';
import TimelineRoundedIcon from '@material-ui/icons/TimelineRounded';
import CodeRoundedIcon from '@material-ui/icons/CodeRounded';
import InfoRoundedIcon from '@material-ui/icons/InfoRounded';
import Divider from '@material-ui/core/Divider';
import { components } from '../reducers/page.js';

function SidebarButton(props) {
  const currentPage = props.currentPage;
  const [drawerOpen, setDrawer] = React.useState(false);

  function toggleDrawer() {
    setDrawer(!drawerOpen);
  }

  const activeStyle = {
    fontWeight: 'bold',
    color: '#3f51b5',
    textDecoration: 'none',
    cursor: 'default',
  };

  const inactiveStyle = {
    fontWeight: 'normal',
    color: '#000000',
    textDecoration: 'none',
    cursor: 'pointer',
  };

  return (
    <div>
      <IconButton
        color="inherit"
        aria-label="Open drawer"
        onClick={toggleDrawer}
        edge="start"
      >
        <MenuIcon />
      </IconButton>
      <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer}>
        <div style={{ width: 250 }}>
          <IconButton
            color="inherit"
            aria-label="Open drawer"
            onClick={toggleDrawer}
            edge="start"
          >
            <ChevronLeftIcon color="primary" />
          </IconButton>
          <List>
            <ListItem
              component={NavLink}
              to={{
                type: 'DASHBOARD',
                query: props.currentLocation.query,
              }}
              activeStyle={activeStyle}
              exact
              style={inactiveStyle}
              button
              selected={currentPage === components.DASHBOARD}
            >
              <ListItemIcon>
                <MapRoundedIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItem>
            <ListItem
              component={NavLink}
              to={{
                type: 'ISOCHRONE',
                query: props.currentLocation.query,
              }}
              activeStyle={activeStyle}
              exact
              style={inactiveStyle}
              button
              selected={currentPage === components.ISOCHRONE}
            >
              <ListItemIcon>
                <TimelineRoundedIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="Isochrone" />
            </ListItem>
            <ListItem
              component={NavLink}
              to={{
                type: 'DATADIAGNOSTIC',
                query: props.currentLocation.query,
              }}
              activeStyle={activeStyle}
              exact
              style={inactiveStyle}
              button
              selected={currentPage === components.DATADIAGNOSTIC}
            >
              <ListItemIcon>
                <CodeRoundedIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="Developer Tools" />
            </ListItem>
            <Divider light />
            <ListItem
              component="a"
              href="https://sites.google.com/view/opentransit"
              target="_blank"
              onClick={toggleDrawer}
              button
            >
              <ListItemIcon>
                <InfoRoundedIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="About" style={inactiveStyle} />
            </ListItem>
          </List>
        </div>
      </Drawer>
    </div>
  );
}

const mapStateToProps = state => ({
  currentPage: state.page,
  currentLocation: state.location,
});

export default connect(mapStateToProps)(SidebarButton);
