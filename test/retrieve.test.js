const chaiAsPromised = require('chai-as-promised');
const chai = require('chai');
const path = require('path');
const {execSync} = require('child_process');
const fs = require('fs');
chai.use(chaiAsPromised);
const assert = chai.assert;

const gdal = require('gdal-async');

const retrieve = require('..');

const grib2 = path.resolve(__dirname, 'data', 'gfs.t06z.pgrb2.0p25.f010');

const grib2Mem = '/vsimem/temp.grb2';
const grib2Temp = `tmp${process.pid}.grb2`;

function validate(file, bands, bbox, size) {
    console.log('checking', file)
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
    ds.close();
}

describe('retrieve()', () => {
    it('should retrieve the whole dataset without modification', () => {
        return assert.isFulfilled(
            retrieve({
                url: grib2,
                filename: grib2Mem
            }).then(() => validate(grib2Mem, 743, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
        );
    });
    it('should retrieve bands by id', () => {
        return assert.isFulfilled(
            retrieve({
                url: grib2,
                bands: [{id: 11}, {id: 17}, {id: 34}],
                filename: grib2Mem
            }).then(() => validate(grib2Mem, 3, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
        );
    });
    describe('should retrieve bands by description', () => {
        it('w/string', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{description: 'PVL'}],
                    filename: grib2Mem
                }).then(() => validate(grib2Mem, 12, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
            );
        });
        it('w/RegExp', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{description: new RegExp(/PVL.+$/)}],
                    filename: grib2Mem
                }).then(() => validate(grib2Mem, 12, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
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
                    filename: grib2Mem
                }).then(() => validate(grib2Mem, 2, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
            );
        });
        it('w/RegExp', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{metaData: {GRIB_ELEMENT: RegExp(/^CP.+$/)}}],
                    filename: grib2Mem
                }).then(() => validate(grib2Mem, 3, [-185, 90.125, 175, -89.875], {x: 36, y: 18}))
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
                    filename: grib2Mem
                }).then(() => validate(grib2Mem, 1, [-15, 60.125, 15, 30.125], {x: 3, y: 3}))
            );
        });
    });
});

describe('geosub CLI', () => {
    it('should retrieve the whole dataset without modification', () => {
        execSync(`node cli.js ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 743, [-185, 90.125, 175, -89.875], {x: 36, y: 18});
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected bands by string', () => {
        execSync(`node cli.js -b SPDL ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 12, [-185, 90.125, 175, -89.875], {x: 36, y: 18});
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected bands by RegExp', () => {
        execSync(`node cli.js -b /^7.+ISBL/ ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 72, [-185, 90.125, 175, -89.875], {x: 36, y: 18});
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected bands by combination of these', () => {
        execSync(`node cli.js -b 2,/^7.+ISBL/,SPDL ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 85, [-185, 90.125, 175, -89.875], {x: 36, y: 18});
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected window', () => {
        execSync(`node cli.js -w -8.0125,53.0125,12.0125,37.9875 ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 743, [-15, 60.125, 15, 30.125], {x: 3, y: 3});
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected window of a single band', () => {
        execSync(`node cli.js -b 10 -w -8.0125,53.0125,12.0125,37.9875 ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 1, [-15, 60.125, 15, 30.125], {x: 3, y: 3});
        fs.unlinkSync(grib2Temp);
    });
    it('should exit with an error when there is one', () => {
        assert.throws(() => execSync(`node cli.js`));
    });
});
