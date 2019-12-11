import React, { useEffect, useState, Fragment } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { lighten, makeStyles } from '@material-ui/core/styles';
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
import { createMuiTheme } from '@material-ui/core/styles';
import FilterListIcon from '@material-ui/icons/FilterList';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import { connect } from 'react-redux';
import Navlink from 'redux-first-router-link';
import {
  filterRoutes,
  getAllWaits,
  getAllSpeeds,
  getAllScores,
  quartileBackgroundColor,
  quartileContrastColor,
  quartileTextColor,
} from '../helpers/routeCalculations';

import { handleGraphParams, fetchPrecomputedWaitAndTripData } from '../actions';
import { EmojiForRouteType } from './Emoji';
import { RouteIcon } from '../UIConstants';

function desc(a, b, orderBy) {
  // Treat NaN as infinity, so that it goes to the bottom of the table in an ascending sort.
  // NaN needs special handling because NaN < 3 is false as is Nan > 3.

  if (Number.isNaN(a[orderBy]) && Number.isNaN(b[orderBy])) {
    return 0;
  }
  if (Number.isNaN(a[orderBy])) {
    return -1;
  }
  if (Number.isNaN(b[orderBy])) {
    return 1;
  }

  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

/**
 * Sorts the given array using a comparator.  Equal values are ordered by array index.
 *
 * Sorting by title is a special case because the original order of the routes array is
 * better than sorting route title alphabetically.  For example, 1 should be followed by
 * 1AX rather than 10 and 12.
 *
 * @param {Array} array      Array to sort
 * @param {Function} cmp     Comparator to use
 * @param {String} sortOrder Either 'desc' or 'asc'
 * @param {String} orderBy   Column to sort by
 * @returns {Array}          The sorted array
 */
function stableSort(array, cmp, sortOrder, orderBy) {
  // special case for title sorting that short circuits the use of the comparator

  if (orderBy === 'title') {
    if (sortOrder === 'desc') {
      const newArray = [...array].reverse();
      return newArray;
    }
    return array;
  }

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
  { id: 'title', numeric: false, disablePadding: false, label: 'Name' },
  { id: 'totalScore', numeric: true, disablePadding: false, label: 'Score' },
  { id: 'wait', numeric: true, disablePadding: true, label: 'Median Wait (min)' },
  {
    id: 'longWait',
    numeric: true,
    disablePadding: true,
    label: 'Long Wait %',
  },
  { id: 'speed', numeric: true, disablePadding: true, label: 'Average Speed (mph)' },
  {
    id: 'variability',
    numeric: true,
    disablePadding: true,
    label: 'Travel Time Variability (min)',
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
  popover: {
    padding: theme.spacing(2),
    maxWidth: 500,
  },
}));

const EnhancedTableToolbar = props => {
  const classes = useToolbarStyles();
  const { numSelected } = props;
  
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

  const { graphParams, myFetchPrecomputedWaitAndTripData } = props;

  useEffect(() => {
    if (graphParams.agencyId && graphParams.date) {
      myFetchPrecomputedWaitAndTripData(graphParams);
    }
  }, [graphParams, myFetchPrecomputedWaitAndTripData]); // like componentDidMount, this runs only on first render

  function handleRequestSort(event, property) {
    const isDesc = orderBy === property && order === 'desc';
    setOrder(isDesc ? 'asc' : 'desc');
    setOrderBy(property);
  }

  let routes = props.routes ? filterRoutes(props.routes) : [];
  const spiderSelection = props.spiderSelection;

  // filter the route list down to the spider routes if needed

  if (spiderSelection && spiderSelection.length > 0) {
    const spiderRouteIds = spiderSelection.map(spider => spider.routeId);
    routes = routes.filter(myRoute => spiderRouteIds.includes(myRoute.id));
  }

  const allWaits = getAllWaits(props.waitTimesCache, props.graphParams, routes);
  const allSpeeds = getAllSpeeds(
    props.tripTimesCache,
    props.graphParams,
    routes,
  );
  const allScores = getAllScores(routes, allWaits, allSpeeds);

  routes = routes.map(route => {
    const waitObj = allWaits.find(
      thisWaitObj => thisWaitObj.routeId === route.id,
    );
    const speedObj = allSpeeds.find(
      thisSpeedObj => thisSpeedObj.routeId === route.id,
    );
    const scoreObj = allScores.find(
      thisScoreObj => thisScoreObj.routeId === route.id,
    );

    return {
      ...route,
      wait: waitObj ? waitObj.wait : NaN,
      longWait: waitObj ? waitObj.longWait : NaN,
      speed: speedObj ? speedObj.speed : NaN,
      variability: speedObj ? speedObj.variability : NaN,
      totalScore: scoreObj ? scoreObj.totalScore : NaN,
      medianWaitScore: scoreObj ? scoreObj.medianWaitScore : NaN,
      longWaitScore: scoreObj ? scoreObj.longWaitScore : NaN,
      speedScore: scoreObj ? scoreObj.speedScore : NaN,
      travelVarianceScore: scoreObj ? scoreObj.travelVarianceScore : NaN,
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
              rowCount={routes.length}
            />
            <TableBody>
              {stableSort(
                routes,
                getSorting(order, orderBy),
                order,
                orderBy,
              ).map((row, index) => {
                const labelId = `enhanced-table-checkbox-${index}`;

                return (
                  <TableRow hover role="checkbox" tabIndex={-1} key={row.id}>
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
                            agencyId: row.agencyId,
                            routeId: row.id,
                            directionId: null,
                            startStopId: null,
                            endStopId: null,
                          },
                        }}
                      >
                        {/*EmojiForRouteType(row.type)*/}
                        {RouteIcon({routeType: row.type, style:{verticalAlign:'sub'}})}
                        {row.title}
                      </Navlink>
                    </TableCell>
                    <TableCell
                      align="right"
                      style={{
                        color: quartileContrastColor(row.totalScore / 100),
                        backgroundColor: quartileBackgroundColor(
                          row.totalScore / 100,
                        ),
                      }}
                    >
                      {Number.isNaN(row.totalScore) ? '--' : row.totalScore}
                    </TableCell>
                    <TableCell
                      align="right"
                      padding="none"
                      style={{
                        color: quartileTextColor(row.medianWaitScore / 100),
                      }}
                    >
                      {Number.isNaN(row.wait) ? '--' : row.wait.toFixed(0)}
                    </TableCell>
                    <TableCell
                      align="right"
                      padding="none"
                      style={{
                        color: quartileTextColor(row.longWaitScore / 100),
                      }}
                    >
                      {Number.isNaN(row.longWait)
                        ? '--'
                        : <Fragment>
                            {(row.longWait * 100).toFixed(0)}<font style={{color:"#8a8a8a"}}>%</font>
                          </Fragment>
                      }
                    </TableCell>
                    <TableCell
                      align="right"
                      padding="none"
                      style={{
                        color: quartileTextColor(row.speedScore / 100),
                      }}
                    >
                      {Number.isNaN(row.speed) ? '--' : row.speed.toFixed(0)}
                    </TableCell>
                    <TableCell
                      align="right"
                      padding="none"
                      style={{
                        color: quartileTextColor(row.travelVarianceScore / 100),
                      }}
                    >
                      {Number.isNaN(row.variability)
                        ? '--'
                        : <Fragment>
                            <font style={{color:"#8a8a8a"}}>{'\u00b1'} </font>{row.variability.toFixed(0)}
                          </Fragment>
                      }
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
  graphParams: state.routes.graphParams,
  spiderSelection: state.routes.spiderSelection,
  waitTimesCache: state.routes.waitTimesCache,
  tripTimesCache: state.routes.tripTimesCache,
});

const mapDispatchToProps = dispatch => {
  return {
    myFetchPrecomputedWaitAndTripData: params =>
      dispatch(fetchPrecomputedWaitAndTripData(params)),
    handleGraphParams: params => dispatch(handleGraphParams(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteTable);
