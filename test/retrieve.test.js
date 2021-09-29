const chaiAsPromised = require('chai-as-promised');
const chai = require('chai');
chai.use(chaiAsPromised);
const assert = chai.assert;

const gdal = require('gdal-async');

const retrieve = require('..');

const grib2 = __dirname + '/data/gfs.t06z.pgrb2.0p25.f010';

const grib2Temp = '/vsimem/temp.grb2';

function validate(file, bands, bbox, size) {
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
}

describe('retrieve', () => {
    it('should retrieve the whole dataset without modification', () => {
        return assert.isFulfilled(
            retrieve({
                url: grib2,
                filename: grib2Temp
            }).then(() => validate(grib2Temp, 743, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
        );
    });
    it('should retrieve bands by id', () => {
        return assert.isFulfilled(
            retrieve({
                url: grib2,
                bands: [{id: 11}, {id: 17}, {id: 34}],
                filename: grib2Temp
            }).then(() => validate(grib2Temp, 3, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
        );
    });
    describe('should retrieve bands by description', () => {
        it('w/string', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{description: 'SIGML'}, {description: 'PVL'}],
                    filename: grib2Temp
                }).then(() => validate(grib2Temp, 12, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
            );
        });
        it('w/RegExp', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{description: new RegExp(/PVL.+$/)}],
                    filename: grib2Temp
                }).then(() => validate(grib2Temp, 12, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
            );
        });
    });
    describe('should retrieve bands by meta data', () => {
        it('w/string', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [
                        {metaData: {GRIB_ELEMENT: 'PRMSL'}},
                        {metaData: {GRIB_ELEMENT: 'TMP', GRIB_SHORT_NAME: '1-ISBL'}}
                    ],
                    filename: grib2Temp
                }).then(() => validate(grib2Temp, 2, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
            );
        });
        it('w/RegExp', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{metaData: {GRIB_ELEMENT: RegExp(/^CP.+$/)}}],
                    filename: grib2Temp
                }).then(() => validate(grib2Temp, 3, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
            );
        });
    });
    describe('should retrieve partial windows', () => {
        it('w/window', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{metaData: {GRIB_ELEMENT: 'TMP', GRIB_SHORT_NAME: '1-ISBL'}}],
                    bbox: [-8.0125, 53.0125, 12.0125, 37.9875],
                    filename: grib2Temp
                }).then(() => validate(grib2Temp, 1, [-15, 60.125, 15, 30.125], {x: 3, y: 3}))
            );
        });
    });
});
