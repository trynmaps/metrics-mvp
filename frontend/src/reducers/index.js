import Moment from 'moment';
import { WEEKDAYS, WEEKENDS } from '../UIConstants';
import { addAveragesForAllDirections } from '../helpers/routeCalculations';

export { default as loading } from './loadingReducer';
export { default as title } from './titleReducer';
export { default as page } from './page';

const momentYesterday = Moment(Date.now() - 24 * 60 * 60 * 1000);

export const initialGraphParams = {
  agencyId: null,
  routeId: null,
  directionId: null,
  startStopId: null,
  endStopId: null,

  firstDateRange: {
    startTime: null,
    endTime: null,
    date: momentYesterday.format('YYYY-MM-DD'), // used where date ranges are not supported
    startDate: momentYesterday.format('YYYY-MM-DD'),
    // days of the week is an Object, where the keys are the day's values (0-6), and the value is true for enabled
    daysOfTheWeek: {
      ...WEEKDAYS.reduce((map, obj) => {
        map[obj.value] = true;
        return map;
      }, {}),
      ...WEEKENDS.reduce((map, obj) => {
        map[obj.value] = true;
        return map;
      }, {}),
    },
  },
  secondDateRange: null,
};

export function graphParams(state = initialGraphParams, action) {
  switch (action.type) {
    case 'RECEIVED_GRAPH_PARAMS':
      return { ...state, ...action.params };
    default:
      return state;
  }
}

const initialRoutes = {
  agencyId: null,
  data: null, // array of route config objects for Agencies[0]
};

export function routes(state = initialRoutes, action) {
  switch (action.type) {
    case 'REQUEST_ROUTES':
      return { ...state, agencyId: action.agencyId };
    case 'RECEIVED_ROUTES':
      return { ...state, data: action.data, agencyId: action.agencyId };
    case 'ERROR_ROUTES':
      return state;
    default:
      return state;
  }
}

const initialTripMetrics = {
  data: null, // TripMetrics object returned by GraphQL API, containing 'interval' and 'timeRanges' properties
  error: null,
};

export function tripMetrics(state = initialTripMetrics, action) {
  switch (action.type) {
    case 'REQUEST_TRIP_METRICS':
      return {
        ...state,
        error: null,
        data: null,
      };
    case 'RECEIVED_TRIP_METRICS':
      return {
        ...state,
        error: null,
        data: action.data,
      };
    case 'ERROR_TRIP_METRICS':
      return {
        ...state,
        error: action.error,
        data: null,
      };
    default:
      break;
  }
  return state;
}

const initialArrivals = {
  data: null,
  url: null,
  error: null,
};

export function arrivals(state = initialArrivals, action) {
  switch (action.type) {
    case 'RECEIVED_ARRIVALS':
      return {
        ...state,
        data: action.data,
        url: action.url,
        error: null,
      };
    case 'ERROR_ARRIVALS':
      return {
        ...state,
        data: null,
        error: action.error,
      };
    default:
      return state;
  }
}

const initialSpiderSelection = {
  nearbyLines: [],
  latLng: null,
};

export function spiderSelection(state = initialSpiderSelection, action) {
  switch (action.type) {
    case 'RECEIVED_SPIDER_MAP_CLICK':
      return {
        ...state,
        nearbyLines: action.nearbyLines,
        latLng: action.latLng,
      };
    default:
      return state;
  }
}

function makeStatsByRouteId(agencyMetricsData, intervalName) {
  const routesStats =
    agencyMetricsData && agencyMetricsData[intervalName]
      ? agencyMetricsData[intervalName].routes
      : [];

  const averagedProperties = [
    'medianWaitTime',
    'averageSpeed',
    'onTimeRate',
    'medianHeadway',
  ];
  routesStats.forEach(function(routeStats) {
    averagedProperties.forEach(function(property) {
      addAveragesForAllDirections(routeStats, property);
    });
  });

  const statsByRouteId = {};
  routesStats.forEach(routeStats => {
    statsByRouteId[routeStats.routeId] = routeStats;
  });

  return statsByRouteId;
}

const initialAgencyMetrics = {
  variablesJson: null,
  data: null,
  statsByRouteId: {},
};

export function agencyMetrics(state = initialAgencyMetrics, action) {
  switch (action.type) {
    case 'RECEIVED_AGENCY_METRICS':
      return {
        ...state,
        variablesJson: action.variablesJson,
        data: action.data,
        statsByRouteId: makeStatsByRouteId(action.data, 'interval'),
        statsByRouteId2: makeStatsByRouteId(action.data, 'interval2'),
      };
    case 'REQUEST_AGENCY_METRICS':
      return {
        ...state,
        variablesJson: action.variablesJson,
        data: null,
        statsByRouteId: {},
      };
    default:
      return state;
  }
}

function makeSegmentsMap(routeMetricsData) {
  const segmentsMap = {};

  routeMetricsData.interval.directions.forEach(function(dirMetrics) {
    const dirSegmentsMap = {};
    dirMetrics.segments.forEach(function(segment) {
      dirSegmentsMap[segment.fromStopId] = segment;
    });

    segmentsMap[dirMetrics.directionId] = dirSegmentsMap;
  });
  return segmentsMap;
}

const initialRouteMetrics = {
  variablesJson: null,
  data: null,
  segmentsMap: {},
  error: null,
};

function addAveragedRouteMetricsForAllDirections(intervalMetrics) {
  if (!intervalMetrics) {
    return;
  }
  const averagedProperties = [
    'medianHeadway',
    'medianWaitTime',
    'averageSpeed',
    'onTimeRate',
    'scheduledMedianHeadway',
    'scheduledMedianWaitTime',
    'scheduledAverageSpeed',
  ];
  averagedProperties.forEach(function(property) {
    addAveragesForAllDirections(intervalMetrics, property);
  });
}

export function routeMetrics(state = initialRouteMetrics, action) {
  switch (action.type) {
    case 'RECEIVED_ROUTE_METRICS':
      addAveragedRouteMetricsForAllDirections(action.data.interval);
      addAveragedRouteMetricsForAllDirections(action.data.interval2);
      return {
        ...state,
        variablesJson: action.variablesJson,
        data: action.data,
        segmentsMap: makeSegmentsMap(action.data),
        error: null,
      };
    case 'REQUEST_ROUTE_METRICS':
      return {
        ...state,
        variablesJson: action.variablesJson,
        data: null,
        error: null,
        segmentsMap: {},
      };
    case 'ERROR_ROUTE_METRICS':
      return {
        ...state,
        error: action.error,
        data: null,
      };
    default:
      return state;
  }
}
