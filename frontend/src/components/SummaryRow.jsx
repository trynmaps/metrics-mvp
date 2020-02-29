import React, { useState } from 'react';

import { TableCell, TableRow } from '@material-ui/core';

import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Popover from '@material-ui/core/Popover';
import InfoIcon from '@material-ui/icons/InfoOutlined';

export default function SummaryRow(props) {
  const {
    columns,
    baseColumn,
    precision,
    units,
    goodDiffDirection,
    infoContent,
  } = props;

  const firstColumn = columns[0];
  const secondColumn = columns[1];

  const firstValue = props[firstColumn];
  const secondValue = props[secondColumn];

  const baseValue = baseColumn ? props[baseColumn] : null;
  const otherValue =
    baseColumn === firstColumn ? props[secondColumn] : props[firstColumn];

  let unitsSuffix = '';
  if (units) {
    unitsSuffix = units !== '%' ? ` ${units}` : units;
  }

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

  const firstColumnText = renderValue(firstValue);
  const secondColumnText = renderValue(secondValue);

  const positiveDiffDesc = props.positiveDiffDesc || 'more';
  const negativeDiffDesc = props.negativeDiffDesc || 'less';

  /* const diffPercent =
    typeof observed === 'number' && typeof scheduled === 'number' && scheduled > 0
      ? (observed / scheduled - 1) * 100
      : null;

  const diffPercentStr =
    diffPercent != null ? `(${Math.abs(diffPercent).toFixed(0)}%)` : '';
  */

  const diff =
    typeof firstValue === 'number' && typeof secondValue === 'number'
      ? otherValue - baseValue
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

  let comparisonCellColor = 'green';
  if (
    goodDiffDirection != null &&
    diff != null &&
    firstColumnText !== secondColumnText &&
    goodDiffDirection * diff < 0
  ) {
    comparisonCellColor = '#f07d02';
  }

  let comparisonText = null;
  if (diff != null && firstColumnText !== secondColumnText) {
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
        {firstColumnText}
      </TableCell>
      <TableCell
        align="right"
        padding="none"
        style={{ ...cellStyle, minWidth: 80 }}
      >
        {secondColumnText}
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
        {baseValue === 'TODO' && otherValue
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
