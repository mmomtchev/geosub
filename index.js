const gdal = require('gdal-async');
const WGS84 = gdal.SpatialReference.fromEPSG(4326);
const Queue = require('async-await-queue');

function lon360to180(lon) {
    return (((lon + 180) % 360) + 360) % 360 - 180;
}

function matchSelector(selector, band) {
    try {
        if (selector.id !== undefined && selector.id !== band.id) return false;

        if (selector.description !== undefined && !band.description.match(selector.description))
            return false;

        if (selector.metaData === undefined) return true;

        const metaData = band.getMetadata();
        for (const selKey of Object.keys(selector.metaData)) {
            const selData = selector.metaData[selKey];
            if (metaData[selKey] === undefined) return false;
            if (!metaData[selKey].match(selData)) return false;
        }

        return true;
    } catch (e) {
        throw new Error(`Malformed selector: ${selector} : ${e}`);
    }
}

function matchAllSelectors(selectors, band) {
    if (!selectors) return true;

    for (const selector of selectors) if (matchSelector(selector, band)) return true;
    return false;
}

/**
 * A band selector
 * @typedef {object} bandSelector
 * @property {number} [id] select by id
 * @property {regexp|string} [description] description selectors
 * @property {object} [metaData] metaData selectors (must match all)
 */

/**
 * The options object for the retrieve method
 * @typedef {object} geosubOptions
 * @property {number} [id] select by id
 * @property {regexp|string} [description] description selectors
 * @property {object} [metaData] metaData selectors (must match all)
 */

/**
 * The main entrypoint
 * @method retrieve
 * @param {geosubOptions} opts options object
 * @param {string} opts.url url
 * @param {number[]} [opts.bbox] bounding box array: [ left, top, right, bottom ], default is everything
 * @param {bandSelector[]} [opts.bands] bands selectors, default is everything
 * @param {string} opts.filename target filename
 * @param {(string) => void} opts.verbose function to accept verbose output
 * @returns {Promise<void>}
 */
module.exports = async function retrieve(opts) {
    const verbose = opts.verbose || (() => undefined);

    if (!opts.url) throw new Error('No URL specified');
    if (!opts.filename) throw Error('No target filename specified');

    verbose(`retrieving ${opts.url}`);

    gdal.config.set('GRIB_NORMALIZE_UNITS', 'NO');

    // Open the source dataset
    const source = await gdal.openAsync(`${opts.url}`);
    verbose(
        `identified ${source.driver.description} ${source.rasterSize.x}:${
            source.rasterSize.y
        } dataset with ${await source.bands.countAsync()} bands`
    );

    const srs = await source.srsAsync;
    const geoTransform = await source.geoTransformAsync;
    const size = await source.rasterSizeAsync;
    const md = await source.getMetadataAsync();

    // Compute window
    let ul, lr, width, height;
    if (opts.bbox) {
        const bbox = opts.bbox;
        try {
            const xform = new gdal.CoordinateTransformation(WGS84, source);
            ul = xform.transformPoint(lon360to180(bbox[0]), lon360to180(bbox[1]));
            lr = xform.transformPoint(lon360to180(bbox[2]), lon360to180(bbox[3]));
        } catch (e) {
            throw new Error('No valid georeferencing found, '+ 
                'if you are retrieving a NetCDF file, ' +
                'you must specify the URL of a subdataset, not the master dataset'
            );
        }
        ul.x = Math.floor(ul.x);
        ul.y = Math.floor(ul.y);
        lr.x = Math.ceil(lr.x);
        lr.y = Math.ceil(lr.y);
        width = Math.min(lr.x - ul.x, size.x);
        height = Math.min(lr.y - ul.y, size.y);
        if (width < 0 || height < 0)
            throw new Error('Partial datasets crossing the antimeridian are not supported');
    } else {
        ul = {x: 0, y: 0};
        lr = {x: size.x - 1, y: size.y - 1};
        width = size.x;
        height = size.y;
    }

    // Create an in-memory temporary dataset
    const bands = [];
    for (const b of source.bands) if (matchAllSelectors(opts.bands, b)) bands.push(b);
    if (!bands.length) throw new Error('No bands to download');
    const temp = await gdal.openAsync('temp', 'w', 'MEM', width, height, 0, gdal.GDT_Byte);

    // Set target SRS
    if (srs) temp.srs = srs;
    if (geoTransform) {
        const targetGeoTransform = [];
        targetGeoTransform[0] = geoTransform[0] + ul.x * geoTransform[1];
        targetGeoTransform[1] = geoTransform[1];
        targetGeoTransform[2] = geoTransform[2];
        targetGeoTransform[3] = geoTransform[3] + ul.y * geoTransform[5];
        targetGeoTransform[4] = geoTransform[4];
        targetGeoTransform[5] = geoTransform[5];
        temp.geoTransform = targetGeoTransform;
    }
    if (md) temp.setMetadataAsync(md);

    // Create destination bands
    for (const b of bands)
        await temp.bands.createAsync((await source.bands.getAsync(b.id)).dataType);

    // Retrieve and copy data
    verbose(
        `retrieving ${ul.x}:${ul.y} to ${lr.x}:${lr.y} (${width}x${height}), bands ${bands
            .map((x) => x.id)
            .join(',')}`
    );
    const queue = new Queue(16, 0);
    for (const band in bands) {
        const inBandId = bands[band].id;
        const outBandId = +band + 1;
        // This loop is parallelized, band access is sequential
        // but reading and writing can happen on two CPU cores
        queue.run(() =>
            source.bands
                .getAsync(inBandId)
                .then((band) => {
                    verbose(`downloading band ${inBandId}: ${band.description}`);
                    return Promise.all([
                        band.getMetadataAsync(),
                        band.pixels.readAsync(ul.x, ul.y, width, height),
                        temp.bands.getAsync(outBandId)
                    ]);
                })
                .then(([md, data, band]) => Promise.all([
                    band.setMetadataAsync(md),
                    band.pixels.writeAsync(0, 0, width, height, data)
                ]))
        );
    }
    await queue.flush();
    await temp.flushAsync();

    // Write output
    const response = await source.driver.createCopyAsync(opts.filename, temp);
    await response.flushAsync();
    verbose(`wrote ${opts.filename}`);

    source.close();
    temp.close();
    response.close();
};
