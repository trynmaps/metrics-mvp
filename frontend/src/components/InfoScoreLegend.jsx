/**
 * New legend for explaining how scores are derived from metrics.
 */

import React from 'react';

import {
Table,
TableBody,
TableCell,
TableRow,
} from '@material-ui/core';

import {
  quartileBackgroundColor,
  quartileForegroundColor,
} from '../helpers/routeCalculations';

export default function InfoScoreLegend(props) {

  const { rows } = props;
  
  return (
    <Table>
      <TableBody>

        { rows.map(row => {

          return <TableRow key={row.value}>
                   <TableCell>
                     {row.label}
                   </TableCell>
                   <TableCell align="right" style={{color: quartileForegroundColor(row.value/100), backgroundColor: quartileBackgroundColor(row.value/100)}}>
                     {row.value}
                  </TableCell>
                </TableRow>
        })}
        
      </TableBody>
    </Table>
  )
}