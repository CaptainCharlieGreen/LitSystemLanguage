const ArchiveBuilder = require('../../../../util/archiveBuilder');
const stdPath = require('path');
const hostPrefab = stdPath.resolve(__dirname, 'prefab');
const invocationsDir = 'node_modules/strat/invocations';
const configDest = 'node_modules/strat/config.json';

module.exports = async function (hostWithScope) {
  const host = new NodeHost(hostWithScope);
  await host.build()
  return host.data();
};

const NodeHost = function (config) {
  this.archiveBuilder = new ArchiveBuilder();
  this.host = config.host;
  this.scope = config.scope;
};

NodeHost.prototype.build = async function () {
  await this.archiveBuilder.copyDirectory(hostPrefab);

  this.host.artifacts.forEach(artifact => {
    this.archiveBuilder.addDataAsFile(artifact.data, `${artifact.name}/index.js`);
  });

  this.copyInvocations();

  this.archiveBuilder.addDataAsFile(this.getConfig(), configDest);
};

NodeHost.prototype.copyInvocations = function () {
  const invocations = this.scope
    .values()
    .reduce((invocations, dependency) => {
      invocations[dependency.service] = dependency.invoke;
      return invocations;
    }, {});

  invocations
    .purge()
    .pairs()
    .map(kvp =>
      this.archiveBuilder.copy(kvp[1],
        stdPath.join(invocationsDir, kvp[0], 'index.js')));
};

NodeHost.prototype.getConfig = function () {
  const config = {
    defaultFunction: this.host.name,
    scope: this.scope
      .keys()
      .reduce((newScope, functionName) => {
        if (this.scope[functionName].hostName === this.host.name) {
          newScope[functionName] = {
            service: 'onHost',
            config: {
              declaration: this.scope[functionName].declaration,
              functionName: functionName,
              shouldntWrap: this.host.name === functionName
            }
          }
        } else {
          newScope[functionName] = {
            service: this.scope[functionName].service,
            config: this.scope[functionName].config
          }
        }
        return newScope;
      }, {})
  };
  return Buffer.from(JSON.stringify(config));
};

NodeHost.prototype.data = function () {
  return this.archiveBuilder.data();
};