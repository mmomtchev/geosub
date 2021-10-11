const gdal = require('gdal-async');
const WGS84 = gdal.SpatialReference.fromEPSG(4326);

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

function metaData2XML(md) {
    let xml = '<Metadata>';
    for (const key of Object.keys(md)) xml += `<MDI key="${key}">${md[key]}</MDI>`;
    xml += '</Metadata>';
    return xml;
}

async function band2XML(filename, i, band, src, dst, width, height) {
    let vrtXML = '\t\t<SimpleSource>\n';
    vrtXML += `\t\t\t<SourceFilename>${filename}</SourceFilename>\n`;
    vrtXML += `\t\t\t<Description>${band.description}</Description>\n`;
    vrtXML += `\t\t\t<SourceBand>${band.id}</SourceBand>\n`;
    vrtXML += `\t\t\t<SrcRect xOff="${src.x}" yOff="${src.y}" xSize="${width}" ySize="${height}" />\n`;
    vrtXML += `\t\t\t<DstRect xOff="${dst.x}" yOff="${dst.y}" xSize="${width}" ySize="${height}" />\n`;
    vrtXML += '\t\t</SimpleSource>\n';
    return vrtXML;
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

    // Compute window
    const size = await source.rasterSizeAsync;
    let ul, lr, width, height;
    if (opts.bbox) {
        const bbox = opts.bbox;
        try {
            const xform = new gdal.CoordinateTransformation(WGS84, source);
            ul = xform.transformPoint(lon360to180(bbox[0]), lon360to180(bbox[1]));
            lr = xform.transformPoint(lon360to180(bbox[2]), lon360to180(bbox[3]));
            if (ul.x < 0) ul.x += size.x;
            if (lr.x < 0) lr.x += size.x;
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
        if (width < 0) width += size.x;
    } else {
        ul = {x: 0, y: 0};
        lr = {x: size.x - 1, y: size.y - 1};
        width = size.x;
        height = size.y;
    }

    // Create a temporary VRT dataset
    const bands = [];
    for (const b of source.bands) if (matchAllSelectors(opts.bands, b)) bands.push(b);
    if (!bands.length) throw new Error('No bands to download');

    let vrtXML = `<VRTDataset rasterXSize="${width}" rasterYSize="${height}">\n\n`;
    const srs = await source.srsAsync;
    if (srs) vrtXML += `\t<SRS>${srs.toWKT()}</SRS>\n`;
    const geoTransform = await source.geoTransformAsync;
    if (geoTransform) {
        const targetGeoTransform = [];
        targetGeoTransform[0] = geoTransform[0] + ul.x * geoTransform[1];
        targetGeoTransform[1] = geoTransform[1];
        targetGeoTransform[2] = geoTransform[2];
        targetGeoTransform[3] = geoTransform[3] + ul.y * geoTransform[5];
        targetGeoTransform[4] = geoTransform[4];
        targetGeoTransform[5] = geoTransform[5];
        vrtXML += `\t<GeoTransform>${targetGeoTransform.join(',')}</GeoTransform>\n`;
    }
    const md = await source.getMetadataAsync();
    if (Object.keys(md).length) vrtXML += '\t' + metaData2XML(md) + '\n';

    for (const i in bands) {
        const band = bands[i];
        vrtXML += `\n\t<VRTRasterBand dataType="${band.dataType}" band="${+i+1}">\n`;
        const md = await band.getMetadataAsync();
        if (Object.keys(md).length) vrtXML += '\t\t' + metaData2XML(md) + '\n';

        vrtXML += await band2XML(opts.url, +i+1, band,
            ul,
            {x: 0, y: 0}, 
            Math.min(size.x - ul.x, width), height
        );
        if (ul.x + width > size.x)
            vrtXML += await band2XML(opts.url, +i+1, band,
                {x: 0, y: ul.y},
                {x: ul.x + width - size.x, y: 0}, 
                width - (size.x - ul.x), height
            );
        vrtXML += `\t</VRTRasterBand>\n`;
    }
    vrtXML += '\n</VRTDataset>\n';
    verbose(vrtXML);
    gdal.vsimem.set(Buffer.from(vrtXML), '/vsimem/remote.vrt');
    const temp = await gdal.openAsync('/vsimem/remote.vrt');

    // Retrieve and copy data
    verbose(
        `retrieving ${ul.x}:${ul.y} to ${lr.x}:${lr.y} (${width}x${height}), bands ${bands
            .map((x) => x.id)
            .join(',')}`
    );

    // Write output
    const response = await source.driver.createCopyAsync(opts.filename, temp, {}, false, (complete, msg) => {
        verbose(`${Math.round(complete * 100)}% ${msg ? msg : ''}`)
    }, undefined);
    await response.flushAsync();
    verbose(`wrote ${opts.filename}`);

    temp.close();
    gdal.vsimem.release('/vsimem/remote.vrt');
    source.close();
    response.close();
};
