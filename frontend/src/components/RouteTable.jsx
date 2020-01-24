import React, { useState, Fragment } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { lighten, makeStyles } from '@material-ui/core/styles';
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
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import { createMuiTheme } from '@material-ui/core/styles';
import FilterListIcon from '@material-ui/icons/FilterList';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import { connect } from 'react-redux';
import Navlink from 'redux-first-router-link';
import {
  filterRoutes,
  scoreBackgroundColor,
  scoreContrastColor,
} from '../helpers/routeCalculations';

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

function getComparisonFunction(order, orderBy) {
  // Sort null values to bottom regardless of ascending/descending
  var factor = order === 'desc' ? 1 : -1;
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

const headRows = [
  { id: 'title', numeric: false, disablePadding: true, label: 'Name' },
  { id: 'totalScore', numeric: true, disablePadding: true, label: 'Score' },
  { id: 'wait', numeric: true, disablePadding: true, label: 'Median Wait' },
  {
    id: 'longWait',
    numeric: true,
    disablePadding: true,
    label: 'Long Wait %',
  },
  { id: 'speed', numeric: true, disablePadding: true, label: 'Average Speed' },
  {
    id: 'variability',
    numeric: true,
    disablePadding: true,
    label: 'Travel Time Variability',
  },
];

function EnhancedTableHead(props) {
  const { order, orderBy, onRequestSort } = props;
  const createSortHandler = property => event => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {headRows.map(row => (
          <TableCell
            key={row.id}
            align={row.numeric ? 'right' : 'left'}
            padding={row.disablePadding ? 'none' : 'default'}
            style={{ paddingRight: 12 }}
            sortDirection={orderBy === row.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === row.id}
              direction={order}
              onClick={createSortHandler(row.id)}
            >
              {row.label}
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
    flex: '1',
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
  const { numSelected } = props;

  const [anchorEl, setAnchorEl] = useState(null);
  const [currentFilter, setCurrentFilter] = useState('DEMO');

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  const filters = {
    ALL: 'All Routes',
    DEMO: 'Demo Routes',
    LVR: 'Light Rail Routes',
    BUS: 'Bus Routes',
    OWL: 'OWL Routes',
    XR: 'Express and Rapid Routes',
    CABLE: 'Cable Car Routes',
  }

  let filterOptions = [];
  for (let filterName in filters){
    filterOptions.push(
      <MenuItem value={filterName}>{filters[filterName]}</MenuItem>
    );
  }

  const applyFilter = event => {
    let newFilter = event['target']['value'];
    setCurrentFilter(newFilter);
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
        <Select
          value={currentFilter}
          onChange={applyFilter}
          IconComponent={FilterListIcon}
        >
          {filterOptions}
        </Select>
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
        <div className={classes.popover}><b>Score</b> is the average of subscores (0-100) for median wait,
          long wait probability, average speed, and travel time variability.  Click on a route to see its metrics
          and explanations of how the subscores are calculated.
          <p/>
          <b>Median Wait</b> is the 50th percentile (typical) wait time for a rider arriving
          randomly at a stop while the route is running.
          <p/>
          <b>Long wait probability</b> is the chance a rider has of a wait of twenty minutes
          or longer after arriving randomly at a stop.
          <p/>
          <b>Average speed</b> is the speed of the 50th percentile (typical) end to end trip, averaged
          for all directions.
          <p/>
          <b>Travel time variability</b> is the 90th percentile end to end travel time minus the 10th percentile
          travel time.  This measures how much extra travel time is needed for some trips.

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

function RouteTable(props) {
  const classes = useStyles();
  const [order, setOrder] = React.useState('asc');
  const [orderBy, setOrderBy] = React.useState('title');
  const dense = true;
  const theme = createMuiTheme();

  const { routeStats } = props;

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
      ...(routeStats[route.id] || {})
    };
  });

  return (
    <div>
        <EnhancedTableToolbar numSelected={0} />
        <div className={classes.tableWrapper}>
          <Table aria-labelledby="tableTitle" size={dense ? 'small' : 'medium'}>
            <EnhancedTableHead
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
              rowCount={displayedRouteStats.length}
            />
            <TableBody>
              {stableSort(
                displayedRouteStats,
                order,
                orderBy,
              ).map((row, index) => {
                const labelId = `enhanced-table-checkbox-${index}`;

                return (
                  <TableRow hover role="checkbox" tabIndex={-1} key={row.route.id}>
                    <TableCell
                      component="th"
                      id={labelId}
                      scope="row"
                      padding="none"
                      style={{border:'none', paddingTop:6, paddingBottom:6}}
                    >
                      <Navlink
                        style={{color: theme.palette.primary.dark, textDecoration: 'none'}}
                        to={{
                          type: 'ROUTESCREEN',
                          payload: {
                            agencyId: row.route.agencyId,
                            routeId: row.route.id,
                          },
                        }}
                      >
                        {row.route.title}
                      </Navlink>
                    </TableCell>
                    <TableCell
                      align="right"
                      padding="none"
                      style={{border:'none', paddingTop:6, paddingBottom:6}}
                    >
                    <Chip
                      style={{
                        color: scoreContrastColor(row.totalScore),
                        backgroundColor: scoreBackgroundColor(row.totalScore),
                      }}
                      label=
                        {row.totalScore == null ? '--' : row.totalScore}
                    />
                    </TableCell>
                    <TableCell
                      align="right"
                      padding="none"
                      style={{border:'none', paddingTop:6, paddingBottom:6}}
                    >
                    <Chip
                      style={{
                        color: scoreContrastColor(row.medianWaitScore),
                        backgroundColor: scoreBackgroundColor(row.medianWaitScore),
                      }}
                      label=
                        {row.wait == null ? '--' : row.wait.toFixed(0) + ' min'}
                    />

                    </TableCell>

                    <TableCell
                      align="right"
                      style={{border:'none'}}
                      padding="none"
                    >
                    <Chip
                      style={{
                        color: scoreContrastColor(row.longWaitScore),
                        backgroundColor: scoreBackgroundColor(row.longWaitScore),
                      }}
                      label=
                        {row.longWait == null
                        ? '--'
                        : <Fragment>
                            {(row.longWait * 100).toFixed(0)}{'%'}
                          </Fragment>
                      }
                    />
                    </TableCell>
                    <TableCell
                      align="right"
                      padding="none"
                      style={{border:'none', paddingTop:6, paddingBottom:6}}
                    >
                    <Chip
                      style={{
                        color: scoreContrastColor(row.speedScore),
                        backgroundColor: scoreBackgroundColor(row.speedScore),
                      }}
                      label=
                        {row.speed == null ? '--' : row.speed.toFixed(0) + ' mph'}

                    />
                    </TableCell>
                    <TableCell
                      align="right"
                      padding="none"
                      style={{border:'none', paddingTop:6, paddingBottom:6}}
                    >
                    <Chip
                      style={{
                        color: scoreContrastColor(row.travelVarianceScore),
                        backgroundColor: scoreBackgroundColor(row.travelVarianceScore),
                      }}
                      label=
                        {row.variability == null
                          ? '--'
                          : <Fragment>
                              {'\u00b1'} {row.variability.toFixed(0)} min
                            </Fragment>
                        }

                    />

                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
    </div>
  );
}

const mapStateToProps = state => ({
  spiderSelection: state.spiderSelection,
  routeStats: state.routeStats,
  routeFilter: state.routeFilter,
});

const mapDispatchToProps = dispatch => {
  return {};
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteTable);
