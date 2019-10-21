import React from 'react';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import MenuIcon from '@material-ui/icons/Menu';
import { NavLink } from 'redux-first-router-link';

function SidebarButton() {
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
      <Drawer variant="persistent" anchor="left" open={drawerOpen}>
        <div style={{ width: 250 }}>
          <IconButton
            color="inherit"
            aria-label="Open drawer"
            onClick={toggleDrawer}
            edge="start"
          >
            <ChevronLeftIcon />
          </IconButton>
          <List>
            <ListItem>
              <NavLink
                to={{ type: 'DASHBOARD' }}
                activeStyle={activeStyle}
                exact
                strict
              >
                Dashboard
              </NavLink>
            </ListItem>
            <ListItem>
              <NavLink
                to={{ type: 'ISOCHRONE' }}
                activeStyle={activeStyle}
                exact
                strict
              >
                Isochrone
              </NavLink>
            </ListItem>
            <ListItem>
              <NavLink
                to={{ type: 'DATADIAGNOSTIC' }}
                activeStyle={activeStyle}
                exact
                strict
              >
                .{/* Semi-hidden data diagnostic link for developers */}
              </NavLink>
            </ListItem>
          </List>
        </div>
      </Drawer>
    </div>
  );
}

export default SidebarButton;
