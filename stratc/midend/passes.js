module.exports = [
  // works with the AST
  [ 'includes', 'midend/includes/index' ],
  [ 'public', 'midend/includes/public' ],
  [ 'names', 'midend/names/index'],
  [ 'namegen', 'midend/names/nameGen'],
  [ 'libinclude', 'midend/libs/include'],
  [ 'loader', 'midend/artifacts/loader'],
  [ 'id', 'midend/id.js'],
  [ 'sysir', 'midend/sys/toSysIr.js'],

  // works with the sysIR
  [ 'collapse', 'midend/hostCollapse/collapse.js'],
  [ 'sysfile', 'midend/sys/sys.js']
];