import { push, actionToPath } from 'redux-first-router';
import {
  ROUTESCREEN,
  DIRECTION_ID,
  START_STOP_ID,
  END_STOP_ID,
} from './routeConstants';
import routesMap from './routesMap';

export function commitPath(params, routePage = ROUTESCREEN) {
  let payload = { ...params };
  payload[DIRECTION_ID] = payload[DIRECTION_ID] ? payload[DIRECTION_ID] : null;
  payload[START_STOP_ID] = payload[START_STOP_ID]
    ? payload[START_STOP_ID]
    : null;
  payload[END_STOP_ID] = payload[END_STOP_ID] ? payload[END_STOP_ID] : null;
  const action = { type: routePage, payload };
  const path = actionToPath(action, routesMap, null);
  push(path);
}
