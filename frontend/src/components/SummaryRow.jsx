import React, { useState } from 'react';

import { TableCell, TableRow } from '@material-ui/core';

import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Popover from '@material-ui/core/Popover';
import InfoIcon from '@material-ui/icons/InfoOutlined';

export default function SummaryRow(props) {
  const {
    precision,
    units,
    actual,
    scheduled,
    goodDiffDirection,
    infoContent,
  } = props;

  let unitsSuffix = '';
  if (units) {
    unitsSuffix = units !== '%' ? ` ${units}` : units;
  }

  const positiveDiffDesc = props.positiveDiffDesc || 'more';
  const negativeDiffDesc = props.negativeDiffDesc || 'less';

  const renderValue = value => {
    if (value === null) {
      return '--';
    }
    if (typeof value === 'number') {
      const valueStr =
        precision != null ? value.toFixed(precision) : `${value}`;
      if (units != null) {
        return `${valueStr}${unitsSuffix}`;
      }
      return valueStr;
    }

    return value;
  };

  /* const diffPercent =
    typeof actual === 'number' && typeof scheduled === 'number' && scheduled > 0
      ? (actual / scheduled - 1) * 100
      : null;

  const diffPercentStr =
    diffPercent != null ? `(${Math.abs(diffPercent).toFixed(0)}%)` : '';
  */

  const diff =
    typeof actual === 'number' && typeof scheduled === 'number'
      ? actual - scheduled
      : null;

  const [anchorEl, setAnchorEl] = useState(null);

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  const useStyles = makeStyles(theme => ({
    popover: {
      padding: theme.spacing(2),
      maxWidth: 500,
    },
  }));

  const classes = useStyles();

  const cellStyle = {
    border: 'none',
    padding: 6,
    fontSize: 16,
  };

  const actualText = renderValue(actual);
  const scheduledText = renderValue(scheduled);

  let comparisonCellColor = 'green';
  if (
    goodDiffDirection != null &&
    diff != null &&
    actualText !== scheduledText &&
    goodDiffDirection * diff < 0
  ) {
    comparisonCellColor = '#f07d02';
  }

  let comparisonText = null;
  if (diff != null && actualText !== scheduledText) {
    const absDiff = Math.abs(diff);
    let diffStr = absDiff.toFixed(precision);
    if (diffStr === '0') {
      diffStr = '< 1';
    }
    comparisonText = `${diffStr}${unitsSuffix} ${
      diff > 0 ? positiveDiffDesc : negativeDiffDesc
    }`; // ${diffPercentStr}`;
  }

  return (
    <TableRow hover role="checkbox" tabIndex={-1}>
      <TableCell component="th" scope="row" padding="none" style={cellStyle}>
        {props.label}
      </TableCell>
      <TableCell component="th" scope="row" padding="none" style={cellStyle}>
        {infoContent ? (
          <IconButton size="small" onClick={handleClick}>
            <InfoIcon fontSize="small" />
          </IconButton>
        ) : null}
      </TableCell>
      <TableCell
        align="right"
        padding="none"
        style={{ ...cellStyle, minWidth: 80 }}
      >
        {actualText}
      </TableCell>
      <TableCell
        align="right"
        padding="none"
        style={{ ...cellStyle, minWidth: 80 }}
      >
        {scheduledText}
      </TableCell>
      <TableCell
        align="right"
        padding="none"
        style={{
          ...cellStyle,
          minWidth: 150,
          color: comparisonCellColor,
        }}
      >
        {scheduled === 'TODO' && actual
          ? `##${unitsSuffix} ${positiveDiffDesc}/${negativeDiffDesc} (#%)`
          : null}
        {comparisonText}
      </TableCell>
      {infoContent ? (
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
        >
          <div className={classes.popover}>{infoContent}</div>
        </Popover>
      ) : null}
    </TableRow>
  );
}
