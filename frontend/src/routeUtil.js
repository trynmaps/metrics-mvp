import { push } from 'redux-first-router';

//path constants
export const ROUTE = 'route';
export const DIRECTION = 'direction';
export const FROM_STOP = 'from_stop';
export const TO_STOP = 'to_stop';

export const setPath = (pathParam,id,path = document.location.pathname) => {
    //account for trailing / if there is one
    if(path.lastIndexOf('/') === path.length-1) {
      path = path.substring(0,path.length-1);
    }

    let pathArray = path.split('/');
    const endingPathIndex = pathArray.indexOf(pathParam);
    //if we don't have the value of the last param yet in the URL, then just append it
    if(endingPathIndex === -1){
      return `${path}/${pathParam}/${id}`;
       
    }
    //otherwise, we need to cut off the URL and add latest parameter
    pathArray[endingPathIndex+1]=id;
    return pathArray.slice(0,endingPathIndex+2).join('/');

}
export const commitPath = path => push(path);