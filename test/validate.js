const { assert } = require('chai');
const gdal = require('gdal-async');

module.exports = function validate(file, bands, bbox, size, cs) {
    const ds = gdal.open(file);
    assert.equal(ds.bands.count(), bands);
    const dsGeo = ds.geoTransform;
    const dsSize = ds.rasterSize;
    const dsBbox = [
        dsGeo[0],
        dsGeo[3],
        dsGeo[0] + dsGeo[1] * dsSize.x,
        dsGeo[3] + dsGeo[5] * dsSize.y
    ];
    assert.deepEqual(dsBbox, bbox);
    assert.deepEqual(dsSize, size);
    assert.include(ds.bands.get(1).getMetadata().GRIB_IDS, 'US-NCEP');
    assert.equal(gdal.checksumImage(ds.bands.get(1)), cs);
    ds.close();
};
