// Name of the transit agency
export const agencyTitle = 'SF Muni';
export const agencyName = 'sf-muni';

// Default starting coordinates
export const STARTING_COORDINATES = { lat: 37.7793, lng: -122.4193 };

// List routes to not search for by default
export const DefaultDisabledRoutes = [
  'PH',
  'C',
  'PM', // cable car lines
  'K_OWL',
  'L_OWL',
  'M_OWL',
  'N_OWL',
  'T_OWL',
  '41',
  '88',
  '90',
  '91',
  '714',
  'S',
  'NX',
  '1AX',
  '1BX',
  '7X',
  '8AX',
  '8BX',
  '14X',
  '30X',
  '31AX',
  '31BX',
  '38AX',
  '38BX',
  '81X',
  '82X',
  '83X',
];

// GeoJSON feature collection of the area serviced by the transportation agency
export const ServiceArea = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-122.47352600097655, 37.809919574015545],
            [-122.47833251953122, 37.809919574015545],
            [-122.48691558837888, 37.790116270812824],
            [-122.50099182128905, 37.789302322860244],
            [-122.50923156738278, 37.78821704497659],
            [-122.51678466796874, 37.78034830365157],
            [-122.50751495361327, 37.72089869333032],
            [-122.49961853027342, 37.68952589794135],
            [-122.38941192626953, 37.69061262365255],
            [-122.39078521728513, 37.706775788247036],
            [-122.37155914306639, 37.70813387686182],
            [-122.37808227539061, 37.71112158421217],
            [-122.37052917480466, 37.71845453701034],
            [-122.361946105957, 37.71519553647589],
            [-122.3557662963867, 37.72035555445047],
            [-122.35542297363281, 37.73013144497153],
            [-122.36778259277341, 37.7342043518508],
            [-122.36469268798828, 37.73963454585709],
            [-122.37258911132812, 37.74750761967557],
            [-122.37361907958983, 37.75239393391763],
            [-122.37945556640624, 37.75402263362959],
            [-122.38254547119139, 37.789031004883626],
            [-122.39936828613278, 37.80802085728357],
            [-122.4100112915039, 37.81181824192454],
            [-122.42031097412108, 37.81208947621166],
            [-122.46356964111327, 37.805850835522016],
            [-122.47352600097655, 37.809919574015545],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-122.37396240234375, 37.80842772926478],
            [-122.3609161376953, 37.8065289741725],
            [-122.35954284667967, 37.80815648152641],
            [-122.35954284667967, 37.815751041563544],
            [-122.36846923828125, 37.814123701604466],
            [-122.36846923828125, 37.815751041563544],
            [-122.36022949218749, 37.82009043941308],
            [-122.36778259277344, 37.83148014503288],
            [-122.37361907958984, 37.832835945274034],
            [-122.37911224365234, 37.830666652929224],
            [-122.38048553466797, 37.82795494780686],
            [-122.37224578857423, 37.815751041563544],
            [-122.37396240234375, 37.80842772926478],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-122.47592926025389, 37.842190287869684],
            [-122.55249023437501, 37.84042796619093],
            [-122.55111694335939, 37.83337825839438],
            [-122.54081726074219, 37.83148014503288],
            [-122.53669738769533, 37.82632787689904],
            [-122.53841400146483, 37.82415839321614],
            [-122.52880096435548, 37.81385247479046],
            [-122.52742767333983, 37.819276821747295],
            [-122.52296447753906, 37.824700770115996],
            [-122.51506805419922, 37.824700770115996],
            [-122.49961853027342, 37.81873440498779],
            [-122.49069213867188, 37.82632787689904],
            [-122.48073577880858, 37.82551432799189],
            [-122.47180938720703, 37.83120898199489],
            [-122.47112274169922, 37.83825889708791],
            [-122.47592926025389, 37.842190287869684],
          ],
        ],
      },
    },
  ],
};

// S3 link to routes
export const routesUrl =
  'https://opentransit-precomputed-stats.s3.amazonaws.com/routes_v2_sf-muni.json.gz';

/**
 * Generate S3 url for trips
 * @param dateStr - date
 * @param statPath - the statistical measure (e.g. median)
 * @param timePath - the time of day
 * @returns {string} S3 url
 */
export function generateTripURL(dateStr, statPath, timePath) {
  return `https://opentransit-precomputed-stats.s3.amazonaws.com/trip-times/v1/sf-muni/${dateStr.replace(
    /-/g,
    '/',
  )}/trip-times_v1_sf-muni_${dateStr}_${statPath}${timePath}.json.gz`;
}

/**
 * Generate S3 url for wait times
 * @param dateStr - date
 * @param statPath - the statistical measure (e.g. median)
 * @param timePath - the time of day
 * @returns {string} S3 url
 */
export function generateWaitTimeURL(dateStr, statPath, timePath) {
  return `https://opentransit-precomputed-stats.s3.amazonaws.com/wait-times/v1/sf-muni/${dateStr.replace(
    /-/g,
    '/',
  )}/wait-times_v1_sf-muni_${dateStr}_${statPath}${timePath}.json.gz`;
}

/**
 * Returns a data object with centralized declarations of "per route" heuristic rules
 * to apply when doing systemwide computations.
 *
 * For example, for routes with directions that should be ignored:
 *
 * {
 *   <routeID>: {
 *     directionsToIgnore: [<directionID>]
 *   }
 * }
 *
 * Other cases:
 * - Routes to filter out completely:
 *   - S due to lack of regular route and schedule
 *   - Owls due to the date boundary problem.
 * - Routes that have non-code issues with arrivals their first or last stop and so the second or penultimate stop
 *     should be used instead for end-to-end calculations.  Cable car lines are like this.  Also the M has a last
 *     stop that it normally does not go to.
 * - Possibly special handling for routes with back end issues (currently 5, 9, 9R) as a temporary workaround.
 *   - The 9 has multiple terminals so use the last common stop.
 *   - The 5 was reconfigured and Nextbus stop configs are out of sync with historic data.  Use last good stop.
 */
export const routeHeuristics = {
  J: {
    directionsToIgnore: ['J____I_D10'], // this is to 23rd and 3rd
  },
  L: {
    directionsToIgnore: ['L____I_U53'],
  },
  M: {
    M____O_D00: {
      ignoreFirstStop: true, // Embarcadero & Folsom is not a real stop
    },
  },
  N: {
    N____O_F10: {
      ignoreFirstStop: true, // 4th and King to 2nd and King trip times are skewed by a few hyperlong trips
    },
  },
  S: {
    ignoreRoute: true,
  },
  '5': {
    '5____I_F00': {
      ignoreFirstStop: '4218', // no data for 3927, and first few stop ids are now different.  Problem is even worse on outbound side, no good fix there.
    },
  },
  '9': {
    '9____I_N00': {
      ignoreFirstStop: '7297', // use Bayshore as actual first stop (daytime)
    },
    '9____O_N00': {
      ignoreLastStop: '7297', // use Bayshore as actual terminal (daytime)
    },
  },
  '24': {
    directionsToIgnore: ['24___I_D10'],
  },
  '90': {
    ignoreRoute: true,
  },
  '91': {
    ignoreRoute: true,
  },
  K_OWL: {
    ignoreRoute: true,
  },
  L_OWL: {
    ignoreRoute: true,
  },
  M_OWL: {
    ignoreRoute: true,
  },
  N_OWL: {
    ignoreRoute: true,
  },
  T_OWL: {
    ignoreRoute: true,
  },
  PM: {
    PM___O_F00: {
      ignoreLastStop: true, // long time to Taylor and Bay (probably in holding area)
    },
    PM___I_F00: {
      ignoreFirstStop: true, // 30 minutes from Hyde & Beach to Hyde & North Point
    },
  },
  PH: {
    PH___I_F00: {
      ignoreFirstStop: true, // 30 minutes from Hyde & Beach to Hyde & North Point
    },
  },
  C: {
    C____I_F00: {
      ignoreLastStop: true, // long time to California & Drumm (probably in holding area)
    },
  },
};
