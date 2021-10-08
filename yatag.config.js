module.exports = {
  include: [ 'index.js' ],
  output: 'index.d.ts',
  filter: (name) => !name.match(/opts\./g)
};
