
/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { JSONObject, isPrimitive } from 'sql/workbench/services/notebook/common/jsonext';
import { nbformat } from 'sql/workbench/services/notebook/common/nbformat';
import { MimeModel } from 'sql/workbench/services/notebook/browser/outputs/mimemodel';

/**
 * A multiline string.
 */
export type MultilineString = string | string[];

/**
 * A mime-type keyed dictionary of data.
 */
export interface IMimeBundle extends JSONObject {
	[key: string]: MultilineString | JSONObject;
}

/**
 * Get the data from a notebook output.
 */
export function getData(output: nb.ICellOutput): JSONObject {
	let bundle: IMimeBundle = {};
	if (
		nbformat.isExecuteResult(output) ||
		nbformat.isDisplayData(output) ||
		nbformat.isDisplayUpdate(output)
	) {
		bundle = (output as nbformat.IExecuteResult).data;
	} else if (nbformat.isStream(output)) {
		if (output.name === 'stderr') {
			bundle['application/vnd.jupyter.stderr'] = output.text;
		} else {
			bundle['application/vnd.jupyter.stdout'] = output.text;
		}
	} else if (nbformat.isError(output)) {
		let traceback = output.traceback ? output.traceback.join('\n') : undefined;
		bundle['application/vnd.jupyter.stderr'] = undefined;
		if (traceback) {
			bundle['application/vnd.jupyter.stderr'] = traceback;
		} else if (output.evalue) {
			bundle['application/vnd.jupyter.stderr'] = output.ename ? `${output.ename}: ${output.evalue}` : `${output.evalue}`;
		}
	}
	return convertBundle(bundle);
}

/**
 * Get the metadata from an output message.
 */
export function getMetadata(output: nbformat.IOutput): JSONObject {
	let value: JSONObject = Object.create(null);
	if (nbformat.isExecuteResult(output) || nbformat.isDisplayData(output)) {
		for (let key in output.metadata) {
			value[key] = extract(output.metadata, key);
		}
	}
	return value;
}

/**
 * Get the bundle options given output model options.
 */
export function getBundleOptions(options: IOutputModelOptions): MimeModel.IOptions {
	let data = getData(options.value);
	let metadata = getMetadata(options.value);
	let trusted = !!options.trusted;
	return { data, metadata, trusted };
}

/**
 * Extract a value from a JSONObject.
 */
export function extract(value: JSONObject, key: string): {} {
	let item = value[key];
	if (item === undefined || item === null || isPrimitive(item)) {
		return item;
	}
	return JSON.parse(JSON.stringify(item));
}

/**
 * Convert a mime bundle to mime data.
 */
function convertBundle(bundle: nbformat.IMimeBundle): JSONObject {
	let map: JSONObject = Object.create(null);
	for (let mimeType in bundle) {
		map[mimeType] = extract(bundle, mimeType);
	}
	return map;
}

/**
 * The options used to create a notebook output model.
 */
export interface IOutputModelOptions {
	/**
	 * The raw output value.
	 */
	value: nbformat.IOutput;

	/**
	 * Whether the output is trusted.  The default is false.
	 */
	trusted?: boolean;
}
