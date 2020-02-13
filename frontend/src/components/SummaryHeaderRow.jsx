import React from 'react';

import { TableCell, TableRow } from '@material-ui/core';

export default function SummaryHeaderRow() {
  const headerCellStyle = { padding: 6, fontSize: 16 };

  return (
    <TableRow>
      <TableCell align="right" padding="none"></TableCell>
      <TableCell align="right" padding="none"></TableCell>
      <TableCell align="right" padding="none" style={headerCellStyle}>
        Observed
      </TableCell>
      <TableCell align="right" padding="none" style={headerCellStyle}>
        Scheduled
      </TableCell>
      <TableCell align="right" padding="none"></TableCell>
    </TableRow>
  );
}
