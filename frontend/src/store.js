import { createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { connectRoutes } from 'redux-first-router';
import thunk from 'redux-thunk';

import routesMap from './routesMap';
import * as reducers from './reducers';
import page from './reducers/page';
import * as actionCreators from './actions';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
  ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({ actionCreators })
  : compose;

export default function configureStore(preloadedState) {
  const { reducer, middleware, enhancer } = connectRoutes(routesMap)

  const rootReducer = combineReducers({ ...reducers, location: reducer })
  const middlewares = applyMiddleware(thunk, middleware)
  const enhancers = composeEnhancers(enhancer, middlewares)

  const store = createStore(rootReducer, preloadedState, enhancers)

  return { store }
}
