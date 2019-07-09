import React from 'react';
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

import { filterRoutes } from '../helpers/routeCalculations';
import { connect } from 'react-redux';
import { push } from 'redux-first-router'
import Link from 'redux-first-router-link'

import { handleGraphParams } from '../actions';

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
  return order === 'desc' ? (a, b) => desc(a, b, orderBy) : (a, b) => -desc(a, b, orderBy);
}

const headRows = [
  { id: 'title', numeric: false, disablePadding: true, label: 'Name' },
  { id: 'wait', numeric: true, disablePadding: false, label: 'Wait (min)' },
  { id: 'speed', numeric: true, disablePadding: false, label: 'Speed (mph)' },
  { id: 'score', numeric: true, disablePadding: false, label: 'Score' },
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
  table: {
    minWidth: 750,
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

  function handleRequestSort(event, property) {
    const isDesc = orderBy === property && order === 'desc';
    setOrder(isDesc ? 'asc' : 'desc');
    setOrderBy(property);
  }

  function handleClick(event, route) {
    const selectedIndex = selected.indexOf(route.title);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = [route.title];//newSelected.concat(selected, name);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1),
      );
    }

    setSelected(newSelected);

    props.onGraphParams({
      route_id: route.id,
      direction_id: null,
      start_stop_id: null,
      end_stop_id: null,
    });
    push('/route');
  }

  const isSelected = name => selected.indexOf(name) !== -1;
  
  let routes = props.routes ? filterRoutes(props.routes) : [];
  const spiderSelection = props.spiderSelection;
  
  // filter the route list down to the spider routes if needed
  
  if (spiderSelection && spiderSelection.length > 0) {
    const spiderRouteIDs = spiderSelection.map(spider => spider.routeID);
    routes = routes.filter(route => spiderRouteIDs.includes(route.id));
  }
  
  // put in temporarily hard-coded average waits
  
  const allWaits = getAllWaits();
  routes = routes.map(route => {
    const waitObj = allWaits.find(wait => wait.routeID === route.id);
    if (waitObj) {
      route.wait = waitObj.wait;
    } else {
      route.wait = 0;
    }
    return route;
  });

    return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <EnhancedTableToolbar numSelected={selected.length} />
        <div className={classes.tableWrapper}>
          <Table
            className={classes.table}
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
              {stableSort(routes, getSorting(order, orderBy))
                .map((row, index) => {
                  const isItemSelected = isSelected(row.title);
                  const labelId = `enhanced-table-checkbox-${index}`;

                  return (
                    <TableRow
                      hover
                      onClick={ null /*event => handleClick(event, row)*/}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      key={row.id}
                      selected={isItemSelected}
                    >
                      <TableCell component="th" id={labelId} scope="row" padding="none">
                        <Link to={{type: 'RECEIVED_GRAPH_PARAMS', payload: {
                      route_id: row.id,
                      direction_id: null,
                      start_stop_id: null,
                      end_stop_id: null,
                    }, query: { route_id: row.id } }} >{row.title}</Link>
                      </TableCell>
                      <TableCell align="right">{row.wait.toFixed(1)}</TableCell>
                      <TableCell align="right">{row.speed}</TableCell>
                      <TableCell align="right">{row.score}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </Paper>
   </div>
  );    
}


/**
 * These are static placeholder precomputed average waits per route values.  This will be replaced
 * eventually by values generated from the precomputed wait times for all stops on a route.
 * 
 * These are used to draw routes in three widths by frequency: widest is the top third most frequent,
 * medium width for middle third of frequency, and thinnest for the third least frequent.
 */
function getAllWaits() {
  const allWaits = 

[{"routeID":"38BX","wait":169.84285714285716},{"routeID":"38AX","wait":159.70769230769233},
  {"routeID":"1BX","wait":130.49655172413796},{"routeID":"41","wait":110.75636363636364},
  {"routeID":"7X","wait":106.77532467532468},{"routeID":"1AX","wait":102.53235294117647},
  {"routeID":"31BX","wait":97.9939393939394},{"routeID":"8AX","wait":81.05306122448978},
  {"routeID":"82X","wait":77.36500000000002},{"routeID":"30X","wait":72.21538461538461},
  {"routeID":"31AX","wait":48.3780487804878},{"routeID":"14X","wait":45.76607142857143},
  {"routeID":"S","wait":42.98648648648649},{"routeID":"81X","wait":34.93750000000001},
  {"routeID":"56","wait":26.305769230769233},{"routeID":"36","wait":23.021428571428572},
  {"routeID":"23","wait":21.24701492537313},{"routeID":"25","wait":20.81190476190476},
  {"routeID":"67","wait":19.99772727272727},{"routeID":"39","wait":18.764102564102565},
  {"routeID":"18","wait":15.71111111111111},{"routeID":"12","wait":15.61954022988506},
  {"routeID":"52","wait":15.015492957746478},{"routeID":"C","wait":14.902702702702705},
  {"routeID":"PM","wait":14.210869565217392},{"routeID":"8BX","wait":13.026881720430108},
  {"routeID":"PH","wait":12.933333333333332},{"routeID":"54","wait":12.680722891566266},
  {"routeID":"8","wait":12.673636363636362},{"routeID":"35","wait":12.5109375},
  {"routeID":"31","wait":12.00990990990991},{"routeID":"3","wait":11.955172413793104},
  {"routeID":"37","wait":11.766315789473683},{"routeID":"88","wait":11.75263157894737},
  {"routeID":"48","wait":11.725000000000001},{"routeID":"M","wait":11.183636363636365},
  {"routeID":"57","wait":11.163529411764706},{"routeID":"19","wait":11.15373134328358},
  {"routeID":"66","wait":10.487499999999999},{"routeID":"9R","wait":10.371264367816094},
  {"routeID":"10","wait":9.95},{"routeID":"33","wait":9.621839080459772},
  {"routeID":"5","wait":9.588750000000001},{"routeID":"2","wait":9.172},
  {"routeID":"38","wait":8.974850299401195},{"routeID":"27","wait":8.712631578947367},
  {"routeID":"9","wait":8.483185840707964},{"routeID":"KT","wait":8.379761904761907},
  {"routeID":"6","wait":8.184210526315788},{"routeID":"55","wait":7.946428571428571},
  {"routeID":"24","wait":7.747899159663866},{"routeID":"J","wait":7.675000000000001},
  {"routeID":"29","wait":7.4916201117318435},{"routeID":"21","wait":7.115789473684211},
  {"routeID":"7","wait":7.017757009345793},{"routeID":"28R","wait":7.000000000000001},
  {"routeID":"43","wait":6.9662857142857115},{"routeID":"30","wait":6.941176470588235},
  {"routeID":"44","wait":6.82734375},{"routeID":"28","wait":6.578481012658228},
  {"routeID":"45","wait":6.361016949152543},{"routeID":"L","wait":6.295833333333333},
  {"routeID":"22","wait":6.107608695652175},{"routeID":"F","wait":6.010000000000001},
  {"routeID":"NX","wait":5.9375},{"routeID":"N","wait":5.803030303030303},
  {"routeID":"5R","wait":5.579365079365079},{"routeID":"47","wait":5.460344827586206},
  {"routeID":"14","wait":5.4173913043478255},{"routeID":"49","wait":5.0628205128205135},
  {"routeID":"14R","wait":4.806521739130435},{"routeID":"1","wait":3.921875},
  {"routeID":"38R","wait":3.68125}];

  return allWaits;
}

const mapStateToProps = state => ({
  spiderSelection: state.routes.spiderSelection,
});

const mapDispatchToProps = dispatch => {
  return ({
    onGraphParams: params => dispatch(handleGraphParams(params))
  })
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteTable);