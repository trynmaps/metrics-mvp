import React from 'react';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import MenuIcon from '@material-ui/icons/Menu';


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
                        <ListItem><a href="/">Dashboard</a></ListItem>
                        <ListItem><a href="/isochrone">Isochrone</a></ListItem>
                    </List>
                </div>
            </Drawer>
        </div>;
    }
}

export default SidebarButton;
