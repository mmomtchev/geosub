# geosub

[![License: ISC](https://img.shields.io/github/license/mmomtchev/geosub)](https://github.com/mmomtchev/geosub/blob/master/LICENSE)
[![npm version](https://img.shields.io/npm/v/geosub)](https://www.npmjs.com/package/geosub)
[![Node.js CI](https://github.com/mmomtchev/geosub/actions/workflows/node.js.yml/badge.svg)](https://github.com/mmomtchev/geosub/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/mmomtchev/geosub/branch/master/graph/badge.svg?token=VAgvGRNjjc)](https://codecov.io/gh/mmomtchev/geosub)

`geosub` is a tool for partial downloads of geospatial raster datasets from remote data sources

Its main use case is downloading NOAA GFS GRIBs from Amazon S3 but it should be compatible with any raster dataset format supported by GDAL on any remote file system supported by GDAL

It is an AWS-compatible replacement for NOAA's [g2sub](https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl)

# Installation

```sh
# locally in the current project
npm i geosub

# globally as a system-wide accessible command
sudo npm -g i geosub
```

# Usage

## From the command line

*(you should probably install it as a global package in this case)*

```bash
# Download band #1 and all the temperature bands over France from the GFS GRIBs
$ geosub -b 1,TMP -w -8,53,12,38 /vsis3/noaa-gfs-bdp-pds/gfs.20210918/06/atmos/gfs.t06z.pgrb2.0p25.f010 france_temperature.06z.grb2

# Use RegExp to select all 'TMP' but not 'ICETMP' and all PRMSL
$ geosub -b '/^TMP/,PRMSL' -w -8,53,12,38 /vsis3/noaa-gfs-bdp-pds/gfs.20210918/06/atmos/gfs.t06z.pgrb2.0p25.f010 france_temperature.06z.grb2

# Download two temperature bands from the Sigma Atmospheric Model in NetCDF format
# this works only on Linux and (depending on your distribution) may require setting the sysctl vm.unprivileged_userfaultfd=1
$ geosub -b 1,2 NETCDF:"/vsis3/noaa-gfs-bdp-pds/gfs.20210918/06/atmos/gfs.t06z.atmf012.nc":tmp sigma_temperatures.nc
```

### With a JSON configuration file
```json
{
    "bands": [ 
        { "description": "/PVL.+$/" },
        { "id": 2 },
        { "metaData": { "GRIB_ELEMENT": "PRMSL" } }
    ],
    "bbox": [ -8.0125, 53.0125, 12.0125, 37.9875 ]
}
```
```bash
$ geosub -r conf.json /vsis3/noaa-gfs-bdp-pds/gfs.20210918/06/atmos/gfs.t06z.pgrb2.0p25.f010 geosub.06z.grb2
```

Bands can be selected either by id, by a substring of the description or by RegExp by enclosing the string in `//`.

## From a Node.js application

Bands can be selected either by id, by a substring of the description, by RegExp of the description, by metadata selectors or by any combination of these.

```js
const retrieve = require('geosub');
await retrieve({
    url: '/vsis3/noaa-gfs-bdp-pds/gfs.20210918/06/atmos/gfs.t06z.pgrb2.0p25.f010',
    bands: [{id: 1}, {description: /TMP/}],
    bbox: [-8.0125, 53.0125, 12.0125, 37.9875],
    filename: 'france_temperature.06z.grb2'
}).catch((e) => console.error(e));
```

# Import directly into an `ndarray` in `scijs` without writing to disk

```js
const gdal = require('gdal-async');
const ndarray = require('ndarray');
require('ndarray-gdal');
const retrieve = require('retrieve-geo-sub');
await retrieve({
    url: '/vsis3/noaa-gfs-bdp-pds/gfs.20210918/06/atmos/gfs.t06z.pgrb2.0p25.f010',
    bands: [
        {metaData: {GRIB_ELEMENT: 'TMP'}}
    ],
    bbox: [-8.0125, 53.0125, 12.0125, 37.9875],
    filename: '/vsimem/france_temperature.06z.grb2'
});
const ndArray = gdal.open('/vsimem/france_temperature.06z.grb2')
    .bands.get(1).pixels.readArray();

```

# Extracting data

## Extracting individual bands

The *GRIB2* format is very ill-suited for cloud operations - there is no central band index and it requires that the whole file is parsed before any bands can be extracted. In order to allow for partial downloads, NOAA publishes a sidecar index file for every *GRIB2* with a `.idx` extension. This file allows for orders of magnitude faster data extraction as long as only the data contained in it is used - ***that is the band description***. Should you require reading the metadata, in the case of the *GRIB2* format, you will probably be better off with downloading the whole file and extracting the needed bands locally. When using only numerical ids or the description field, only the small sidecar file, the first band and the requested bands will be transferred.

*NetCDF* does not suffer from this problem and allows reading the band metadata without fully transferring it.

## Extracting subwindows and longitude conversions

`geosub` understands both `[-180,180]` and `[0-360]` longitudes and it will automatically convert between these.

*GRIB2s* internally always use `[0-360]` longitudes, all aspects of which are handled correctly by GDAL >= 3.4.0 as per the *GRIB2* specification. Extracted subwindows can cross both the prime meridian and the antimeridian, but be aware that many other tools will fail when reading a partial *GRIB2* dataset that crosses the prime meridian as its left boundary will be greater than its right boundary.

NOAA's *NetCDFs* also use `[0-360]` longitudes, which do not follow the *NetCDF Climate and Forecast Metadata Conventions*. Still, many tools will read them - in the case of GDAL, it will read the raster data but the georeferencing won't be fully functional. GDAL supports explicitly rewrapping such datasets around the antimeridian and converting them to `[-180,180]` which is the standard - [see this for a detailed explanation](https://gis.stackexchange.com/questions/37790/reprojecting-raster-from-0-360-to-180-180-with-cutting-180-meridian-using-gdalw). `geosub` supports extracting partial windows even if they cross the prime meridian or the antimeridian. When reading a `[0-360]` file, it will write a `[0-360]` file and when reading a `[-180,180]` file it will write a `[-180,180]` file.

In the case of the *GRIB2* format partial downloads of a single band, without being completely impossible, are difficult to implement and depend on the type of the compression used. Currently when selecting a subwindow, the whole band is transferred, but only part of it is written.

The *NetCDF* GDAL driver supports partial band transfers but it will still transfer more than the minimum possible - it will usually retrieve full lines but only for the requested rows.
