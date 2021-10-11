const chaiAsPromised = require('chai-as-promised');
const chai = require('chai');
const path = require('path');
const {execSync} = require('child_process');
const fs = require('fs');
chai.use(chaiAsPromised);
const assert = chai.assert;

const validate = require('./validate.js');

const grib2 = path.resolve(__dirname, 'data', 'gfs.t06z.pgrb2.0p25.f010');
const grib2Temp = `tmp${process.pid}.grb2`;

describe('geosub CLI', () => {
    it('should retrieve the whole dataset without modification', () => {
        execSync(`node cli.js ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 743, [-185, 90.125, 175, -89.875], {x: 36, y: 18}, 7524);
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected bands by string', () => {
        execSync(`node cli.js -b SPDL ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 12, [-185, 90.125, 175, -89.875], {x: 36, y: 18}, 3387);
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected bands by RegExp', () => {
        execSync(`node cli.js -b /^7.+ISBL/ ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 72, [-185, 90.125, 175, -89.875], {x: 36, y: 18}, 8205);
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected bands by combination of these', () => {
        execSync(`node cli.js -b 10,/^7.+ISBL/,SPDL ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 85, [-185, 90.125, 175, -89.875], {x: 36, y: 18}, 6872);
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected window', () => {
        execSync(`node cli.js -w -8.0125,53.0125,12.0125,37.9875 ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 743, [-15, 60.125, 15, 30.125], {x: 3, y: 3}, 83);
        fs.unlinkSync(grib2Temp);
    });
    it('should retrieve selected window of a single band', () => {
        execSync(`node cli.js -b 10 -w -8.0125,53.0125,12.0125,37.9875 ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 1, [-15, 60.125, 15, 30.125], {x: 3, y: 3}, 74);
        fs.unlinkSync(grib2Temp);
    });
    it('should read the contents of a JSON configuration file', () => {
        execSync(`node cli.js -j test/data/test.conf.json ${grib2} ${grib2Temp}`);
        validate(grib2Temp, 14, [-15, 60.125, 15, 30.125], {x: 3, y: 3}, 83);
        fs.unlinkSync(grib2Temp);
    });
    it('should exit with an error when there is one', () => {
        assert.throws(() => execSync(`node cli.js -q`));
    });
});
