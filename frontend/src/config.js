// When running in dev mode via docker-compose or GitPod
// REACT_APP_METRICS_BASE_URL is set
// to the URL of the metrics API server.
// When REACT_APP_METRICS_BASE_URL is not set, metrics
// will be loaded from the same domain as the React app.
// eslint-disable-next-line import/prefer-default-export
export const metricsBaseURL = process.env.REACT_APP_METRICS_BASE_URL;
