/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { nb } from 'azdata';
import * as op from 'sql/workbench/contrib/notebook/browser/models/outputProcessor';
import { JSONObject } from 'sql/workbench/services/notebook/common/jsonext';
import { nbformat as nbformat } from 'sql/workbench/services/notebook/common/nbformat';
import { getRandomString } from 'vs/editor/test/common/model/linesTextBuffer/textBufferAutoTestUtils';


suite('OutputProcessor functions', function (): void {
	suite('getData', async function (): Promise<void> {
		const text = getRandomString(1, 10);

		// data tests
		for (const outputType of ['execute_result', 'display_data', 'update_display_data'] as nbformat.OutputType[]) {
			const output = <nbformat.IExecuteResult>{
				output_type: outputType,
				data: <op.IMimeBundle>{
					result: text  // free form fields of the IMimeBundle. This is just an arbitrarily cooked-up hardcoded example for the test.
				}
			};
			test(`test for outputType:${output.output_type}`, async () => {
				verifyGetDataForDataOutput(output);
			});
		}

		// error tests
		for (const traceback of [undefined, [], [''], [getRandomString(0, 10), getRandomString(0, 10)]]) {
			for (const evalue of [undefined, getRandomString(1, 10)]) {
				for (const ename of [text, '']) {
					const output = <nbformat.IError>{
						output_type: 'error',
						ename: ename,
						evalue: evalue,
						traceback: traceback
					};
					test(`test for outputType:'${output.output_type}', ename:'${ename}', evalue:${evalue}, and traceback:${JSON.stringify(traceback)}`, async () => {
						verifyGetDataForErrorOutput(output);
					});
				}
			}
		}

		// stream tests
		for (const name of ['stderr', 'stdout'] as nbformat.StreamType[]) {
			const output = <nbformat.IStream>{
				output_type: 'stream',
				text: text,
				name: name
			};
			test(`test for outputType:'${output.output_type} and name:${name}`, async () => {
				verifyGetDataForStreamOutput(output);
			});
		}
	});

	suite('getMetadata', async function (): Promise<void> {
		for (const outputType of ['execute_result', 'display_data', getRandom('update_display_data', 'stream', 'error')] as nbformat.OutputType[]) {
			const text = getRandomString(1, 10);
			const output: nb.ICellOutput = {
				output_type: outputType
			};
			test(`test for outputType:${outputType}`, async () => {
				const metadata: JSONObject = { key: text };
				output.metadata = metadata;
				const result = op.getMetadata(output);
				if (nbformat.isExecuteResult(output) || nbformat.isDisplayData(output)) {
					assert.deepEqual(result, metadata, `getData should return the metadata object passed in the output object to the getMetadata() call`);
				} else {
					assert.deepEqual(result, {}, `getMetadata should return an empty object when output_type is ont IDisplayData or IExecuteResult`);
				}
			});
		}
	});

	suite('getBundleOptions', async function (): Promise<void> {
		for (const trusted of [true, false]) {
			const outputType = getRandom('execute_result', 'display_data') as nbformat.OutputType;
			const output: nb.ICellOutput = {
				output_type: outputType,
				metadata: {
					azdata_chartOptions: {
						scale: true,
						dataGrid: false
					}
				}
			};
			const options: op.IOutputModelOptions = {
				value: output,
				trusted: trusted
			};
			test(`test for outputType:${outputType}, bundleOptions.trusted:${trusted}`, async () => {
				const result = op.getBundleOptions(options);
				const expected = {
					data: op.getData(output),
					metadata: op.getMetadata(output),
					trusted: trusted
				};
				assert.deepEqual(result, expected, `getBundleOptions should return an object that has data and metadata fields as returned by getData and getMetadata calls and a trusted field as the value of the 'trusted' field in options passed to it`);
			});
		}
	});
});

function verifyGetDataForDataOutput(output: nbformat.IExecuteResult | nbformat.IDisplayData | nbformat.IDisplayUpdate) {
	const result = op.getData(output);
	// getData just returns the data property object for ExecutionResults/DisplayData/DisplayUpdate Output object sent to it.
	assert.deepEqual(result, output.data, `getData should return the expectedData:${output.data} object`);
}

function verifyGetDataForStreamOutput(output: nbformat.IStream): void {
	//expected return value is an object with a single property of 'application/vnd.jupyter.stderr' or 'application/vnd.jupyter.stdout' corresponding to the stream name
	const expectedData = output.name === 'stderr'
		? {
			'application/vnd.jupyter.stderr': output.text,
		}
		: {
			'application/vnd.jupyter.stdout': output.text,
		};
	const result = op.getData(output);
	assert.deepEqual(result, expectedData, `getData should return the expectedData:${expectedData} object`);
}

function verifyGetDataForErrorOutput(output: nbformat.IError): void {
	const result = op.getData(output);
	const tracedata = (output.traceback === undefined || output.traceback === []) ? undefined : output.traceback.join('\n');
	// getData returns an object with single property: 'application/vnd.jupyter.stderr'
	// this property is assigned to a '\n' delimited traceback data when it is present.
	// when absent ths property gets ename and evalue information information ': ' delimited unless
	// ename is empty in which case it is just evalue information.
	let expectedData: JSONObject = {
		'application/vnd.jupyter.stderr': undefined
	};
	if (tracedata) {
		expectedData = {
			'application/vnd.jupyter.stderr': tracedata
		};
	}
	else if (output.evalue) {
		if (output.ename !== '') {
			expectedData = {
				'application/vnd.jupyter.stderr': `${output.ename}: ${output.evalue}`
			};
		}
		else {
			expectedData = {
				'application/vnd.jupyter.stderr': `${output.evalue}`
			};
		}
	}
	assert.deepEqual(result, <JSONObject>expectedData, `getData should return the expectedData:'${JSON.stringify(expectedData)}' object`);
}

function getRandom<T>(...list: T[]): T {
	return list[Math.floor((Math.random() * list.length))];
}
