import React, { Fragment } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import CircleIcon from '@material-ui/icons/FiberManualRecord';
import { generateDateLabels } from '../helpers/dateTime';

const useStyles = makeStyles(theme => ({
  heading: {
    fontSize: theme.typography.pxToRem(15),
  },
  secondaryHeading: {
    fontSize: theme.typography.pxToRem(12),
    color: theme.palette.text.secondary,
    textAlign: 'left',
  },
}));

/**
 * Displays the current date and time selections as styled text.
 *
 * @param {any} props
 */
export default function DateTimeLabel(props) {
  const { dateRangeParams, colorCode, style } = props;

  const classes = useStyles();

  const { dateLabel, smallLabel } = generateDateLabels(dateRangeParams);

  return (
    <Fragment>
      <span style={style}>
        <Typography className={classes.heading} display="inline">
          {dateLabel}&nbsp;
        </Typography>
        <Typography className={classes.secondaryHeading} display="inline">
          {smallLabel}
        </Typography>
      </span>
      {colorCode ? (
        <CircleIcon
          style={{ fill: colorCode, verticalAlign: 'sub' }}
          fontSize="small"
        />
      ) : null}
    </Fragment>
  );
}
