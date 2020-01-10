// When running in dev mode via docker-compose or GitPod
// REACT_APP_METRICS_BASE_URL is set
// to the URL of the metrics API server.
// When REACT_APP_METRICS_BASE_URL is not set, metrics
// will be loaded from the same domain as the React app.
// eslint-disable-next-line import/prefer-default-export
export const MetricsBaseURL = process.env.REACT_APP_METRICS_BASE_URL;

// index.html loads script tag from /api/js_config before React scripts, which sets window.OpentransitConfig object
const config = window.OpentransitConfig;

export const S3Bucket = config.S3Bucket;
export const Agencies = config.Agencies;
export const WaitTimesVersion = config.WaitTimesVersion;
export const TripTimesVersion = config.TripTimesVersion;
export const RoutesVersion = config.RoutesVersion;
export const ArrivalsVersion = config.ArrivalsVersion;

const agenciesMap = {};
Agencies.forEach(agency => {
  agenciesMap[agency.id] = agency;
});

export function getAgency(agencyId) {
  return agenciesMap[agencyId];
}
