import { push } from 'redux-first-router';

// path constants
export const ROUTE = 'route';
export const DIRECTION = 'direction';
export const FROM_STOP = 'fromStop';
export const TO_STOP = 'toStop';
export const DATE = 'date';
export const START_DATE = 'startDate';
export const START_TIME = 'startTime';
export const END_TIME = 'endTime';
export const DAYS_OF_THE_WEEK = 'daysOfTheWeek';

export class Path {
  constructor() {
    this.path = document.location.pathname;
  }

  buildPath = (pathParam, id) => {
    let { path } = this;
    // account for trailing / if there is one
    if (path.lastIndexOf('/') === path.length - 1) {
      path = path.substring(0, path.length - 1);
    }

    const pathArray = path.split('/');
    const endingPathIndex = pathArray.indexOf(pathParam);
    // if we don't have the value of the last param yet in the URL, then just append it
    if (endingPathIndex === -1) {
      this.path = `${path}/${pathParam}/${id}`;
      return this;
    }
    // otherwise, we need to cut off the URL and add latest parameter
    pathArray[endingPathIndex + 1] = id;
    this.path = pathArray.slice(0, endingPathIndex + 2).join('/');
    return this;
  };

  commitPath = () => {
    const { path } = this;
    push(path);
  };
}
