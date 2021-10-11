#!/usr/bin/env node

const fs = require('fs');
const {program} = require('commander');
const retrieve = require('.');

program
    .option('-b <bands>', 'bands to extract, comma-separated list of strings and/or numbers')
    .option(
        '-w <win>',
        'window to extract, comma-separated list of WGS84 coordinates in left, top, right, bottom order'
    )
    .option('-j <file>', 'read configuration from a JSON file')
    .option('-v', 'verbose output')
    .option('-q', 'suppress all output')
    .parse();

// Replace all /strings/ with a RegExp object
function createRegexp(str) {
    if (typeof str === 'string' && str.startsWith('/') && str.endsWith('/'))
        return new RegExp(str.substring(0, str.length - 1).substring(1));
    return str;
}

function createAllRegexps(o) {
    for (const key of Object.keys(o))
        if (typeof o[key] === 'object') createAllRegexps(o[key]);
        else if (typeof o[key] === 'string') o[key] = createRegexp(o[key]);
}

const opts = program.opts();

// Parse the JSON configuration file
let conf, bands, bbox;
if (opts.j) {
    try {
        conf = JSON.parse(fs.readFileSync(opts.j));
        if (conf.bands) createAllRegexps(conf.bands);
        bands = conf.bands;
        bbox = conf.bbox;
    } catch (e) {
        console.error(`Failed parsing ${opts.j}: ${e}`);
        process.exit(1);
    }
}

// Parse all other CLI options
if (opts.b) {
    bands = opts.b.split(',').map((band) => {
        if (!isNaN(band)) return {id: +band};
        if (band.startsWith('/') && band.endsWith('/'))
            return {description: createRegexp(band)};
        return {description: band};
    });
}
if (opts.w) {
    bbox = opts.w.split(',').map((coord) => +coord);
}
const url = program.args[0];
const filename = program.args[1];

// Download
retrieve({
    url,
    filename,
    bands,
    bbox,
    verbose: opts.q ? () => undefined : opts.v ? console.debug : () => process.stdout.write('.')
})
    .then(() => {
        if (!opts.quiet) process.stdout.write('\n');
    })
    .catch((e) => {
        if (!opts.q) {
            console.error(e.message);
            console.log('Usage:');
            console.log(
                'geosub [-b band1,band2...] [-w left,top,right,bottom] [-v] [-q] url destination'
            );
        }
        process.exit(1);
    });
