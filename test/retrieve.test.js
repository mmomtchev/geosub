const chaiAsPromised = require('chai-as-promised');
const chai = require('chai');
const path = require('path');
chai.use(chaiAsPromised);
const assert = chai.assert;

const retrieve = require('..');

const validate = require('./validate.js');

const grib2 = path.resolve(__dirname, 'data', 'gfs.t06z.pgrb2.0p25.f010');
const grib2Mem = '/vsimem/temp.grb2';

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
        it('w/window w/180 longitudes crossing the PM', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{metaData: {GRIB_ELEMENT: 'TMP', GRIB_SHORT_NAME: '1-ISBL'}}],
                    bbox: [-8.0125, 53.0125, 12.0125, 37.9875],
                    filename: grib2Mem
                }).then(() => validate(grib2Mem, 1, [-15, 60.125, 15, 30.125], {x: 3, y: 3}))
            );
        });
        it('w/window w/360 longitudes crossing the PM', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{metaData: {GRIB_ELEMENT: 'TMP', GRIB_SHORT_NAME: '1-ISBL'}}],
                    bbox: [351.9875, 10, 12.0125, -10],
                    filename: grib2Mem,
                }).then(() => validate(grib2Mem, 1, [-15, 10.125, 15, -19.875], {x: 3, y: 3}))
            );
        });
        it('w/window w/180 longitudes crossing the AM', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{metaData: {GRIB_ELEMENT: 'TMP', GRIB_SHORT_NAME: '1-ISBL'}}],
                    bbox: [170, 10, -170, -10],
                    filename: grib2Mem
                }).then(() => validate(grib2Mem, 1, [165, 10.125, 195, -19.875], {x: 3, y: 3}))
            );
        });
        it('w/window w/360 longitudes crossing the AM', () => {
            return assert.isFulfilled(
                retrieve({
                    url: grib2,
                    bands: [{metaData: {GRIB_ELEMENT: 'TMP', GRIB_SHORT_NAME: '1-ISBL'}}],
                    bbox: [170, 10, 190, -10],
                    filename: grib2Mem
                }).then(() => validate(grib2Mem, 1, [165, 10.125, 195, -19.875], {x: 3, y: 3}))
            );
        });
    });
});
