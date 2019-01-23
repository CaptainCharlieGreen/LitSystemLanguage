const serializeAST = require('../util/jsExtensions');
const stdPath = require('path');
const frontend = passify(require('./frontend/passes'));
const midend = passify(require('./midend/passes'));
const backend = passify(require('./backend/passes'));
const errorFormat = require('./errors');

function passify (passTuple) {
  return passTuple
    .map(tuple => {
      return {
        name: tuple[0],
        entry: stdPath.resolve(__dirname, tuple[1])
      };
    });
}

const everything = []
  .concat(frontend)
  .concat(midend)
  .concat(backend);

const prebuiltSegments = {
  frontend: frontend,
  midend: midend,
  backend: backend,
  build: frontend.concat(midend),
  deploy: backend
};

function getSegment (start, stop) {
  if (typeof start !== 'string') start = 'scan';
  const segment = [];
  var collecting = false;
  for (var i = 0; i < everything.length; i++) {
    if (everything[i].name === start) collecting = true;
    if (collecting) segment.push(everything[i]);
    if (everything[i].name === stop) break;
  }
  return segment;
}

module.exports = function (dependencies) {
  function runSegment (start, stop, startingInput, filename) {
    return executePasses(getSegment(start, stop), startingInput, filename);
  }

  function runCommand (command, startingInput, filename) {
    const prebuilt = prebuiltSegments[command];
    if (prebuilt) {
      return executePasses(prebuilt, startingInput, filename);
    } else {
      const singleCommand = everything
        .first(potentialCommand => potentialCommand.name === command);
      if (singleCommand) {
        return executePasses([singleCommand], startingInput, filename);
      }
    }
    return J(`Could not find command ${command}`);
  }

  function executePasses (passes, startingInput, filename) {
    return passes
      .reduce((previousResultPromise, nextPass) => {
        return previousResultPromise
          .then(result => dependencies.loader(nextPass.entry)
            (dependencies)
            (result, filename))
      }, R(startingInput))
      .catch(errorFormat);
  }
  return {
    runCommand: runCommand,
    runSegment: runSegment,
    serializeAST: serializeAST
  }
};
