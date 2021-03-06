const crypto = require('crypto');

module.exports = deps => ast => {
  ast.tokens.id = {
    value: crypto.randomBytes(8).toString('hex'),
    line: 0,
    type: 'STRING'
  };
  return ast;
}