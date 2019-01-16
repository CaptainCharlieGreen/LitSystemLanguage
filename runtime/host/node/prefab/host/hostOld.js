module.exports = function (event, context, callback) {
  respond(event, callback);
}

/*
Hosts respond to requests using a map with these properties:
[data, componentRejection, componentFailure, systemRejection, systemFailure]

data: Execution finished normally
componentRejection: Execution finished normally with a rejected promise
componentFailure: Execution aborted with an exception
systemRejection: The host is not configured properly and cannot handle the event
systemFailure: The host failed in executing the handler
*/
function respond (event, cb) {
  const workDoing = work();
  if (typeof workDoing.then === 'function') {
    workDoing
      .then(result => cb(null, result));
  } else {
    cb(workDoing, null);
  }

  function work () {
    //todo: dynamically pick which handler we need to use based on the
    // callee property of the argument
    // if no callee is supplied, then use the event receiver for this host
    var handlerPath;
    try {
      const config = require('../node_modules/lit/config.json');
      require('../node_modules/lit/index.js');
      handlerPath = config.handlerPath;
    } catch (e) {
      return {
        systemFailure: {
          message: 'Failed to initialize the Lit host.',
          error: e.message
        }
      };
    }

    var handler;
    try {
      handler = require(handlerPath);
    } catch (e) {
      if (e.message === `Cannot find module '${handlerPath}'`) {
        return {
          systemRejection: {
            message: `Could not find handler module ${handlerPath}`,
            error: `Could not find handler module ${handlerPath}`
          }
        };
      }
      return {
        componentFailure: {
          message: 'Failed while requiring component',
          error: e
        }
      };
    }

    if (typeof handler !== 'function') {
      return {
        systemRejection: {
          message: 'Handler is not a function',
          error: `The handler exported by ${handlerPath} is not a function`
        }
      };
    }

    const argument = getArg(event);

    try {
      const promise = handler(argument);
      if (typeof promise !== 'object' || typeof promise.then !== 'function') {
        return {
          data: promise
        };
      }
      return promise
        .then(result => Promise.resolve({
          data: result
        }))
        .catch(e => Promise.resolve({
          componentRejection: {
            message: `Executing ${handlerPath} rejected`,
            error: e
          }
        }));
    } catch (e) {
      return {
        componentFailure: {
          message: `Unhandled exception while executing ${handlerPath}`,
          error: e
        }
      };
    }
  }
}

function getArg (event) {
  if (typeof event !== 'object' || event.hostTransport === undefined) {
    // if its not a host-host communication, assume its an event from
    // an event source library and pass it along unchanged
    return event;
  }
  return event.data;
}