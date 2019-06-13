import React, { Fragment } from 'react';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Drawer from '@material-ui/core/Drawer';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import AppBar from '@material-ui/core/AppBar';

import Navigation from '../components/Navigation';

export default (props) => {
  return (
    <Fragment>
      <Navigation />
      <AppBar>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="Open drawer"
            onClick={(a) => { console.log("OPEN") }}
            edge="start"
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
        {/* <Toolbar>
          <IconButton
            color="inherit"
            aria-label="Open drawer"
            onClick={() => { console.log("OPEN") }}
            edge="start"
          >
            <MenuIcon />
          </IconButton>
        </Toolbar> */}
      </AppBar>

      <Grid container spacing={3}>
        <Grid item xs={6}>
          <Paper>MAP GOES HERE</Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper>xs=6</Paper>
        </Grid>
      </Grid>
    </Fragment>
  )
}