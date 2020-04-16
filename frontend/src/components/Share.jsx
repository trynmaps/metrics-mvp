import React from 'react';
import { withStyles, makeStyles } from '@material-ui/core/styles';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';

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
    '&:hover': {
      backgroundColor: theme.palette.primary.main,
      '& .MuiListItemIcon-root, & .MuiListItemText-primary': {
        color: theme.palette.common.white,
      },
    },
  },
}))(MenuItem);

const Share = props => {
  const { anchorEl, handleClose } = props;

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

  const useStyles = makeStyles({
    flex: {
      display: 'flex',
    },
  });
  const classes = useStyles();
  const { flex } = classes;
  const url = window.location.href;
  return (
    <div>
      <StyledMenu
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
};

export default Share;
