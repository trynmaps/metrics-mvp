import React from 'react';
import {
  withStyles,
  makeStyles,
  createMuiTheme,
} from '@material-ui/core/styles';
import { ThemeProvider } from '@material-ui/styles';
import grey from '@material-ui/core/colors/grey';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@material-ui/core';
import IconButton from '@material-ui/core/IconButton';
import ShareIcon from '@material-ui/icons/Share';

import {
  TwitterShareButton,
  TwitterIcon,
  RedditShareButton,
  RedditIcon,
  FacebookShareButton,
  FacebookIcon,
} from 'react-share';

const StyledMenu = withStyles({
  paper: {
    border: '1px solid #d3d4d5',
  },
})(props => (
  <Menu
    elevation={0}
    getContentAnchorEl={null}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'center',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'center',
    }}
    {...props}
  />
));

const StyledMenuItem = withStyles(theme => ({
  root: {
    '&:focus': {
      backgroundColor: theme.palette.primary.main,
      '& .MuiListItemIcon-root, & .MuiListItemText-primary': {
        color: theme.palette.common.white,
      },
    },
  },
}))(MenuItem);

function Share() {
  const shareComponents = {
    twitter: TwitterShareButton,
    reddit: RedditShareButton,
    facebook: FacebookShareButton,
  };
  const iconComponents = {
    twitter: TwitterIcon,
    reddit: RedditIcon,
    facebook: FacebookIcon,
  };
  const dropDownItems = [
    {
      shareComponent: shareComponents.twitter,
      icon: iconComponents.twitter,
      label: 'Twitter',
    },
    {
      shareComponent: shareComponents.reddit,
      icon: iconComponents.reddit,
      label: 'Reddit',
    },
    {
      shareComponent: shareComponents.facebook,
      icon: iconComponents.facebook,
      label: 'Facebook',
    },
  ];

  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };
  const useStyles = makeStyles({
    flex: {
      display: 'flex',
    },
  });
  const classes = useStyles();
  const { flex } = classes;
  const url = window.location.href;
  const theme = createMuiTheme({
    palette: {
      primary: { main: grey[50] },
    },
  });
  return (
    <div>
      <IconButton
        aria-controls="customized-menu"
        aria-haspopup="true"
        color="primary"
        onClick={handleClick}
      >
        <div>
          <Typography variant="subtitle1">SHARE</Typography>
        </div>
        <ThemeProvider theme={theme}>
          <ShareIcon color="primary" />
        </ThemeProvider>
      </IconButton>
      <StyledMenu
        id="customized-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        {dropDownItems.map(dropDownItem => {
          const ShareButton = dropDownItem.shareComponent;
          const Icon = dropDownItem.icon;
          return (
            <StyledMenuItem>
              <ShareButton url={url}>
                <div className={flex}>
                  <ListItemIcon>
                    <Icon size={32} round />
                  </ListItemIcon>
                  <ListItemText primary={dropDownItem.label} />
                </div>
              </ShareButton>
            </StyledMenuItem>
          );
        })}
      </StyledMenu>
    </div>
  );
}

export default Share;
