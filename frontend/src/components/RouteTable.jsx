import React, { useState, Fragment } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { lighten, makeStyles, createMuiTheme } from '@material-ui/core/styles';
import Chip from '@material-ui/core/Chip';
import Popover from '@material-ui/core/Popover';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';

import FilterListIcon from '@material-ui/icons/FilterList';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import { connect } from 'react-redux';
import Navlink from 'redux-first-router-link';
import {
  filterRoutes,
  scoreBackgroundColor,
  scoreContrastColor,
} from '../helpers/routeCalculations';

function getComparisonFunction(order, orderBy) {
  // Sort null values to bottom regardless of ascending/descending
  const factor = order === 'desc' ? 1 : -1;
  return (a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];

    if (aValue == null && bValue == null) {
      return 0;
    }
    if (aValue == null) {
      return 1;
    }
    if (bValue == null) {
      return -1;
    }

    if (bValue < aValue) {
      return -factor;
    }
    if (bValue > aValue) {
      return factor;
    }
    return 0;
  };
}

/**
 * Sorts the given array by an object property.  Equal values are ordered by array index.
 *
 * Sorting by title is a special case because the original order of the routes array is
 * better than sorting route title alphabetically.  For example, 1 should be followed by
 * 1AX rather than 10 and 12.
 *
 * @param {Array} array      Array to sort
 * @param {String} sortOrder Either 'desc' or 'asc'
 * @param {String} orderBy   Property to sort by
 * @returns {Array}          The sorted array
 */
function stableSort(array, sortOrder, orderBy) {
  // special case for title sorting that short circuits the use of the comparator

  if (orderBy === 'title') {
    if (sortOrder === 'desc') {
      const newArray = [...array].reverse();
      return newArray;
    }
    return array;
  }

  const cmp = getComparisonFunction(sortOrder, orderBy);

  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = cmp(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map(el => el[0]);
}

function EnhancedTableHead(props) {
  const { order, orderBy, onRequestSort, columns } = props;
  const createSortHandler = property => event => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {columns.map(column => (
          <TableCell
            key={column.id}
            align={column.numeric ? 'right' : 'left'}
            padding="none"
            style={{ paddingRight: 6, paddingBottom: 3 }}
            sortDirection={orderBy === column.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === column.id}
              direction={order}
              onClick={createSortHandler(column.id)}
            >
              {column.label}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

EnhancedTableHead.propTypes = {
  onRequestSort: PropTypes.func.isRequired,
  order: PropTypes.string.isRequired,
  orderBy: PropTypes.string.isRequired,
};

const useToolbarStyles = makeStyles(theme => ({
  root: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(1),
  },
  highlight:
    theme.palette.type === 'light'
      ? {
          color: theme.palette.secondary.main,
          backgroundColor: lighten(theme.palette.secondary.light, 0.85),
        }
      : {
          color: theme.palette.text.primary,
          backgroundColor: theme.palette.secondary.dark,
        },
  spacer: {
    flex: '1 1 100%',
  },
  actions: {
    color: theme.palette.text.secondary,
  },
  title: {
    flex: '0 0 auto',
  },
  popover: {
    padding: theme.spacing(2),
    maxWidth: 500,
  },
}));

const EnhancedTableToolbar = props => {
  const classes = useToolbarStyles();
  const { numSelected, columns } = props;

  const [anchorEl, setAnchorEl] = useState(null);

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  return (
    <Toolbar
      className={clsx(classes.root, {
        [classes.highlight]: numSelected > 0,
      })}
    >
      <div className={classes.title}>
        {numSelected > 0 ? (
          <Typography color="inherit" variant="subtitle1">
            {numSelected} selected
          </Typography>
        ) : (
          <Typography variant="h6" id="tableTitle">
            Routes
            <IconButton size="small" onClick={handleClick}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Typography>
        )}
      </div>
      <div className={classes.spacer} />
      <div className={classes.actions}>
        <Tooltip title="Filter list">
          <IconButton aria-label="Filter list">
            <FilterListIcon />
          </IconButton>
        </Tooltip>
      </div>

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
        <div className={classes.popover}>
          {columns.map(column => {
            return column.helpContent ? <p>{column.helpContent}</p> : null;
          })}
        </div>
      </Popover>
    </Toolbar>
  );
};

EnhancedTableToolbar.propTypes = {
  numSelected: PropTypes.number.isRequired,
};

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    marginTop: theme.spacing(3),
  },
  tableWrapper: {
    overflowX: 'auto',
  },
}));

function makeChip(label, score) {
  return (
    <Chip
      style={{
        color: scoreContrastColor(score),
        backgroundColor: scoreBackgroundColor(score),
      }}
      label={label}
    />
  );
}

function RouteTable(props) {
  const classes = useStyles();
  const [order, setOrder] = React.useState('asc');
  const [orderBy, setOrderBy] = React.useState('title');
  const dense = true;
  const theme = createMuiTheme();

  const { statsByRouteId } = props;

  function handleRequestSort(event, property) {
    const isDesc = orderBy === property && order === 'desc';
    setOrder(isDesc ? 'asc' : 'desc');
    setOrderBy(property);
  }

  let routes = props.routes ? filterRoutes(props.routes) : [];
  const spiderStops = props.spiderSelection.stops;

  // filter the route list down to the spider routes if needed

  if (spiderStops && spiderStops.length > 0) {
    const spiderRouteIds = spiderStops.map(spider => spider.routeId);
    routes = routes.filter(myRoute => spiderRouteIds.includes(myRoute.id));
  }

  const displayedRouteStats = routes.map(route => {
    return {
      route,
      ...(statsByRouteId[route.id] || {}),
    };
  });

  const columns = [
    {
      id: 'title',
      numeric: false,
      disablePadding: true,
      label: 'Name',
      rowValue: row => {
        return (
          <Navlink
            style={{
              color: theme.palette.primary.dark,
              textDecoration: 'none',
            }}
            to={{
              type: 'ROUTESCREEN',
              payload: {
                agencyId: row.route.agencyId,
                routeId: row.route.id,
              },
              query: props.query,
            }}
          >
            {row.route.title}
          </Navlink>
        );
      },
    },
    {
      id: 'totalScore',
      numeric: true,
      label: 'Score',
      rowValue: row => {
        return makeChip(
          row.totalScore == null ? '--' : row.totalScore,
          row.totalScore,
        );
      },
      helpContent: (
        <Fragment>
          <b>Score</b> is the average of subscores (0-100) for median wait,
          on-time %, average speed, and travel time variability. Click on a
          route to see its metrics and explanations of how the subscores are
          calculated.
        </Fragment>
      ),
    },
    {
      id: 'medianWaitTime',
      numeric: true,
      label: 'Median Wait',
      rowValue: row => {
        return makeChip(
          row.medianWaitTime == null
            ? '--'
            : `${row.medianWaitTime.toFixed(0)} min`,
          row.medianWaitScore,
        );
      },
      helpContent: (
        <Fragment>
          <b>Median Wait</b> is the 50th percentile (typical) wait time for a
          rider arriving randomly at a stop while the route is running.
        </Fragment>
      ),
    },
    {
      id: 'onTimeRate',
      numeric: true,
      label: 'On-Time %',
      rowValue: row => {
        return makeChip(
          row.onTimeRate == null
            ? '--'
            : `${(row.onTimeRate * 100).toFixed(0)}%`,
          row.onTimeRateScore,
        );
      },
      helpContent: (
        <Fragment>
          <b>On-Time %</b> is the percentage of scheduled departure times where
          a vehicle departed less than 5 minutes after the scheduled departure
          time or less than 1 minute before the scheduled departure time.
        </Fragment>
      ),
    },
    {
      id: 'averageSpeed',
      numeric: true,
      label: 'Average Speed',
      rowValue: row => {
        return makeChip(
          row.averageSpeed == null
            ? '--'
            : `${row.averageSpeed.toFixed(0)} mph`,
          row.speedScore,
        );
      },
      helpContent: (
        <Fragment>
          <b>Average Speed</b> is the speed of the 50th percentile (typical) end
          to end trip, averaged for all directions.
        </Fragment>
      ),
    },
    {
      id: 'travelTimeVariability',
      numeric: true,
      label: 'Travel Time Variability',
      rowValue: row => {
        return makeChip(
          row.travelTimeVariability == null
            ? '--'
            : `\u00b1 ${(row.travelTimeVariability / 2).toFixed(0)} min`,
          row.travelVarianceScore,
        );
      },
      helpContent: (
        <Fragment>
          <b>Average Speed</b> is the speed of the 50th percentile (typical) end
          to end trip, averaged for all directions.
        </Fragment>
      ),
    },
  ];

  return (
    <div>
      <EnhancedTableToolbar columns={columns} numSelected={0} />
      <div className={classes.tableWrapper}>
        <Table aria-labelledby="tableTitle" size={dense ? 'small' : 'medium'}>
          <EnhancedTableHead
            order={order}
            orderBy={orderBy}
            onRequestSort={handleRequestSort}
            rowCount={displayedRouteStats.length}
            columns={columns}
          />
          <TableBody>
            {stableSort(displayedRouteStats, order, orderBy).map(
              (row, index) => {
                const labelId = `enhanced-table-checkbox-${index}`;

                return (
                  <TableRow
                    hover
                    role="checkbox"
                    tabIndex={-1}
                    key={row.route.id}
                  >
                    {columns.map(column => {
                      return (
                        <TableCell
                          align={column.numeric ? 'right' : 'left'}
                          padding="none"
                          style={{
                            border: 'none',
                            paddingTop: 6,
                            paddingBottom: 6,
                          }}
                        >
                          {column.rowValue(row)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              },
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const mapStateToProps = state => ({
  spiderSelection: state.spiderSelection,
  statsByRouteId: state.agencyMetrics.statsByRouteId,
  query: state.location.query,
});

export default connect(mapStateToProps)(RouteTable);
