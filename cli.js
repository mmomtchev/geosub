#!/usr/bin/env node

const {program} = require('commander');
const retrieve = require('.');

program
    .option('-b <bands>', 'bands to extract, comma-separated list of strings and/or numbers')
    .option(
        '-w <win>',
        'window to extract, comma-separated list of WGS84 coordinates in left, top, right, bottom order'
    )
    .option('-v', 'verbose output')
    .option('-q', 'suppress all output')
    .parse();

const opts = program.opts();
const bands = opts.b
    ? opts.b.split(',').map((band) => {
        if (!isNaN(band))
            return {id: +band};
        if (band.startsWith('/') && band.endsWith('/'))
            return {description: new RegExp(band.substring(0, band.length - 1).substring(1))};
        return {description: band};
    })
    : [];
const bbox = opts.w ? opts.w.split(',').map((coord) => +coord) : undefined;
const url = program.args[0];
const filename = program.args[1];

retrieve({
    url,
    filename,
    bands,
    bbox,
    verbose: opts.quiet ? () => undefined : opts.v ? console.debug : () => process.stdout.write('.')
})
    .then(() => {
        if (!opts.quiet) process.stdout.write('\n');
    })
    .catch((e) => {
        console.error(e.message);
        console.log('Usage:');
        console.log('geosub [-b band1,band2...] [-w left,top,right,bottom] [-v] [-q] url destination');
        process.exit(1);
    });
