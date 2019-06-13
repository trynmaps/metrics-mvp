import React, { Fragment } from 'react';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Drawer from '@material-ui/core/Drawer';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import AppBar from '@material-ui/core/AppBar';

import Navigation from '../components/Navigation';
import Info from '../components/Info';
import MapStops from '../components/MapStops';

export default class Dashboard extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      drawerOpen: false,
    }

    this.handleToggleDrawer = this.handleToggleDrawer.bind(this);
  }

  handleToggleDrawer() {
    this.setState({ drawerOpen: !this.state.drawerOpen })
  }

  render() {
    return (
      <Fragment>
        <Navigation />
        <AppBar position="relative">
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleToggleDrawer}
              edge="start"
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Drawer
          variant="persistent"
          anchor="left"
          open={this.state.drawerOpen}
          style={{ width: 500 }}
        >
          <div style={{ width: 250 }}>
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleToggleDrawer}
              edge="start"
            >
              <ChevronLeftIcon />
            </IconButton>
            <List>
              <ListItem>Test</ListItem>
              <ListItem>Test</ListItem>
            </List>
          </div>
        </Drawer>

        <Grid container spacing={3}>
          <Grid item xs={6}>
            <MapStops />
          </Grid>
          <Grid item xs={6}>
            <Paper>xs=6</Paper>
          </Grid>
        </Grid>
      </Fragment>
    )
  }
}