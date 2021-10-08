export type bandSelector = {
	id?: number;
	description?: regexp|string;
	metaData?: object;
}

export type geosubOptions = {
	id?: number;
	description?: regexp|string;
	metaData?: object;
}


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
  export function retrieve(opts: geosubOptions): Promise<void>
