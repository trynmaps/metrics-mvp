import React from 'react';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import MenuIcon from '@material-ui/icons/Menu';
import { NavLink } from 'redux-first-router-link';

class SidebarButton extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            drawerOpen: false,
        };

        this.handleToggleDrawer = this.handleToggleDrawer.bind(this);
    }

    handleToggleDrawer() {
        this.setState({ drawerOpen: !this.state.drawerOpen });
    }

    render() {
        const activeStyle = { fontWeight: "bold", color: '#3f51b5', textDecoration: 'none', cursor: 'pointer' };
        return <div>
              <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleToggleDrawer}
              edge="start"
            >
              <MenuIcon />
            </IconButton>
            <Drawer
                variant="persistent"
                anchor="left"
                open={this.state.drawerOpen}
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
                        <ListItem>
                            <NavLink
                              to={{ type: 'DASHBOARD' }}
                              activeStyle={activeStyle}
                              exact={true}
                              strict={true}
                            >
                                Dashboard
                            </NavLink>
                        </ListItem>
                        <ListItem>
                            <NavLink
                              to={{ type: 'ISOCHRONE' }}
                              activeStyle={activeStyle}
                              exact={true}
                              strict={true}
                            >
                                Isochrone
                            </NavLink>
                        </ListItem>
                    </List>
                </div>
            </Drawer>
        </div>;
    }
}

export default SidebarButton;
