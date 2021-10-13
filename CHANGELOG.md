# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# [1.0.0-alpha.3] 2021-10-13

Release with `gdal-async@3.4.0-alpha.3`
Support crossing both the AM and the PM with both [-180,180] and [0,360] longitudes
Support writing datasets that do not fit in memory

# [1.0.0-alpha.2] 2021-10-07

Release with `gdal-async@3.4.0-alpha.2`
More unit tests
Support 0-360 longitudes on the command line
Fix a crash in the low-level GRIB driver in GDAL when specifying an invalid window
Support reading the configuration from a JSON file

# [1.0.0-alpha.1] 2021-10-02

Release with `gdal-async@3.4.0-alpha.1`
Unit test the CLI
Support RegExps in the CLI
Fix calling the CLI without `-b`
Correctly copy the dataset and the band metadata
Partial support for extracting NetCDF subwindows

# [1.0.0-alpha.0] 2021-09-30

First release with `gdal-async@3.4.0-alpha.0`