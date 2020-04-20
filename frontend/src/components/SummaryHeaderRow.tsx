import React from 'react';
import { TableCell, TableRow } from '@material-ui/core';

/*
 * Renders a header row for a table containing SummaryRow components.
 */
export default function SummaryHeaderRow(props) {
  const { headers } = props;
  const headerCellStyle = { padding: 6, fontSize: 16 };

  return (
    <TableRow>
      <TableCell align="right" padding="none"></TableCell>
      <TableCell align="right" padding="none"></TableCell>
      <TableCell align="right" padding="none" style={headerCellStyle}>
        {headers[0]}
      </TableCell>
      <TableCell align="right" padding="none" style={headerCellStyle}>
        {headers[1]}
      </TableCell>
      <TableCell align="right" padding="none"></TableCell>
    </TableRow>
  );
}
