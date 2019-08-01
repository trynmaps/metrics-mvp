import React, { useEffect } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { lighten, makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import FilterListIcon from '@material-ui/icons/FilterList';
import { filterRoutes, getAllWaits, getAllDistances, getAllSpeeds, getAllScores } from '../helpers/routeCalculations';
import { connect } from 'react-redux';
import { push } from 'redux-first-router';
import Link from 'redux-first-router-link';

import { handleGraphParams, fetchPrecomputedWaitAndTripData } from '../actions';

function desc(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function stableSort(array, cmp) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = cmp(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map(el => el[0]);
}

function getSorting(order, orderBy) {
  return order === 'desc'
    ? (a, b) => desc(a, b, orderBy)
    : (a, b) => -desc(a, b, orderBy);
}

const headRows = [
  { id: 'title', numeric: false, disablePadding: true, label: 'Name' },
  { id: 'wait', numeric: true, disablePadding: false, label: 'Wait (min)' },
  { id: 'speed', numeric: true, disablePadding: false, label: 'Speed (mph)' },
  { id: 'totalScore', numeric: true, disablePadding: false, label: 'Score' },
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
    flex: '1 1 100%',
  },
  actions: {
    color: theme.palette.text.secondary,
  },
  title: {
    flex: '0 0 auto',
  },
}));

const EnhancedTableToolbar = props => {
  const classes = useToolbarStyles();
  const { numSelected } = props;

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
  paper: {
    width: '100%',
    marginBottom: theme.spacing(2),
  },
  tableWrapper: {
    overflowX: 'auto',
  },
}));

function RouteTable(props) {
  const classes = useStyles();
  const [order, setOrder] = React.useState('asc');
  const [orderBy, setOrderBy] = React.useState('title');
  const [selected, setSelected] = React.useState([]);
  const dense = true;

  useEffect(() => {
    props.fetchPrecomputedWaitAndTripData(props.graphParams);
  }, []); // like componentDidMount, this runs only on first render

  function handleRequestSort(event, property) {
    const isDesc = orderBy === property && order === 'desc';
    setOrder(isDesc ? 'asc' : 'desc');
    setOrderBy(property);
  }
  
  const isSelected = name => selected.indexOf(name) !== -1;

  let routes = props.routes ? filterRoutes(props.routes) : [];
  const spiderSelection = props.spiderSelection;

  // filter the route list down to the spider routes if needed

  if (spiderSelection && spiderSelection.length > 0) {
    const spiderRouteIDs = spiderSelection.map(spider => spider.routeID);
    routes = routes.filter(route => spiderRouteIDs.includes(route.id));
  }

  const allWaits = getAllWaits(props);
  const allDistances = getAllDistances();
  const allSpeeds = getAllSpeeds(props, allDistances);
  const allScores = getAllScores(routes, allWaits, allSpeeds);
  
  routes = routes.map(route => {
    
    const waitObj = allWaits.find(waitObj => waitObj.routeID === route.id);
    if (waitObj) {
      route.wait = waitObj.wait;
    }
    
    const speedObj = allSpeeds.find(speedObj => speedObj.routeID === route.id);
    if (speedObj) {
      route.speed = speedObj.speed;
    }
    const scoreObj = allScores.find(scoreObj => scoreObj.routeID === route.id);
    if (scoreObj) {
      route.totalScore = scoreObj.totalScore;
    }
    return route;
  });

  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <EnhancedTableToolbar numSelected={selected.length} />
        <div className={classes.tableWrapper}>
          <Table
            aria-labelledby="tableTitle"
            size={dense ? 'small' : 'medium'}
          >
            <EnhancedTableHead
              numSelected={selected.length}
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
              rowCount={routes.length}
            />
            <TableBody>
              {stableSort(routes, getSorting(order, orderBy)).map(
                (row, index) => {
                  const isItemSelected = isSelected(row.title);
                  const labelId = `enhanced-table-checkbox-${index}`;

                  return (
                    <TableRow
                      hover
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      key={row.id}
                      selected={isItemSelected}
                    >
                      <TableCell
                        component="th"
                        id={labelId}
                        scope="row"
                        padding="none"
                      >
                        <Link
                          to={{
                            type: 'ROUTESCREEN',
                            payload: {
                              route_id: row.id,
                              direction_id: null,
                              start_stop_id: null,
                              end_stop_id: null
                            }
                            
                          }}
                        >
                          {row.title}
                        </Link>
                        
                      </TableCell>
                      <TableCell align="right">
                        {isNaN(row.wait) ? '--' : row.wait.toFixed(1)}
                      </TableCell>
                      <TableCell align="right">
                        {isNaN(row.speed) ? '--' : row.speed.toFixed(1)}
                      </TableCell>
                      <TableCell align="right">
                        {row.totalScore}
                      </TableCell>
                    </TableRow>
                  );
                },
              )}
            </TableBody>
          </Table>
        </div>
      </Paper>
    </div>
  );
}

const mapStateToProps = state => ({
  graphParams: state.routes.graphParams,
  spiderSelection: state.routes.spiderSelection,
  waitTimesCache: state.routes.waitTimesCache,
  tripTimesCache: state.routes.tripTimesCache,
});

const mapDispatchToProps = dispatch => {
  return {
    fetchPrecomputedWaitAndTripData: params =>
      dispatch(fetchPrecomputedWaitAndTripData(params)),
    handleGraphParams: params => dispatch(handleGraphParams(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteTable);
