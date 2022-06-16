/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { nb } from 'azdata';
import * as op from 'sql/workbench/contrib/notebook/browser/models/outputProcessor';
import { nbformat as nbformat } from 'sql/workbench/services/notebook/common/nbformat';

suite('OutputProcessor functions', function (): void {
	const text = 'An arbitrary text input:!@#$%^&*()_+~`:;,.-_=';

	const arbitraryMetadata = Object.create(null); // Use null prototype in order to pass strict deepEqual assertions
	arbitraryMetadata['azdata_chartOptions'] = {
		'scale': true,
		'dataGrid': false,
		'arbitraryCharProperty': {
			'prop1': 'value1',
			'prop2': {
				'deepProp1': 3
			}
		}
	};

	const emptyMetadata = Object.create(null);

	suite('getData', function (): void {
		// data tests
		for (const outputType of ['execute_result', 'display_data', 'update_display_data'] as nbformat.OutputType[]) {
			const output = <nbformat.IExecuteResult>{
				output_type: outputType,
				data: <op.IMimeBundle>{
					result: text  // free form fields of the IMimeBundle. This is just an arbitrarily cooked-up hardcoded example for the test.
				}
			};
			test(`test for outputType:${output.output_type}`, () => {
				verifyGetDataForDataOutput(output);
			});
		}

		// error tests
		for (const traceback of [undefined, [undefined], [], [''], ['Arbitrary traceback 1:!@#$%^&*()_+~`:;,.-_=', 'Arbitrary traceback 2:!@#$%^&*()_+~`:;,.-_=']]) {
			for (const evalue of [undefined, '', 'evalue1:!@#$%^&*()_+~`:;,.-_=']) {
				for (const ename of ['ename1:!@#$%^&*()_+~`:;,.-_=', '', undefined]) {
					const output = <nbformat.IError>{
						output_type: 'error',
						ename: ename,
						evalue: evalue,
						traceback: traceback
					};
					test(`test for outputType:'${output.output_type}', ename:'${ename}', evalue:${evalue}, and traceback:${JSON.stringify(traceback)}`, () => {
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
			test(`test for outputType:'${output.output_type} and name:${name}`, () => {
				verifyGetDataForStreamOutput(output);
			});
		}

		// unknown output types
		test('Should report an error for unknown output types', () => {
			const output = {
				output_type: 'unknown',
				data: {
					'text/html': 'Test text'
				},
				metadata: {}
			};
			const result = op.getData(<any>output);
			assert(result['application/vnd.jupyter.stderr'] !== undefined, 'Should set an error message after receiving unknown output type.');
			assert(result['text/html'] === undefined, 'Should not add any data after receiving unknown output type.');
		});
	});

	suite('getMetadata', function (): void {
		for (const outputType of ['execute_result', 'display_data', 'update_display_data', 'stream', 'error'] as nbformat.OutputType[]) {
			const output: nb.ICellOutput = {
				output_type: outputType
			};
			test(`test for outputType:${outputType}`, () => {
				output.metadata = arbitraryMetadata;
				const result = op.getMetadata(output);
				if (nbformat.isExecuteResult(output) || nbformat.isDisplayData(output)) {
					assert.deepStrictEqual(result, output.metadata, `getMetadata should return the metadata object passed in the output object`);
				} else {
					assert.deepStrictEqual(result, emptyMetadata, `getMetadata should return an empty object when output_type is not IDisplayData or IExecuteResult`);
				}
			});
		}
	});

	suite('getBundleOptions', function (): void {
		for (const trusted of [true, false]) {
			for (const outputType of ['execute_result', 'display_data'] as nbformat.OutputType[]) {
				const output: nb.ICellOutput = {
					output_type: outputType,
					metadata: arbitraryMetadata
				};
				const options: op.IOutputModelOptions = {
					value: output,
					trusted: trusted
				};
				test(`test for outputType:${outputType}, bundleOptions.trusted:${trusted}`, () => {
					const result = op.getBundleOptions(options);
					const expected = {
						data: op.getData(output),
						metadata: op.getMetadata(output),
						trusted: trusted
					};
					assert.deepStrictEqual(result, expected, `getBundleOptions should return an object that has data and metadata fields as returned by getData and getMetadata calls and a trusted field as the value of the 'trusted' field in options passed to it`);
				});
			}
		}
	});
});

function verifyGetDataForDataOutput(output: nbformat.IExecuteResult | nbformat.IDisplayData | nbformat.IDisplayUpdate) {
	const result = op.getData(output);
	const expectedData = Object.create(null);
	for (let key in output.data) {
		expectedData[key] = output.data[key];
	}
	// getData just returns the data property object for ExecutionResults/DisplayData/DisplayUpdate Output object sent to it.
	assert.deepStrictEqual(result, expectedData, `getData should return the expectedData: '${JSON.stringify(expectedData)}' object`);
}

function verifyGetDataForStreamOutput(output: nbformat.IStream): void {
	// expected return value is an object with a single property of 'application/vnd.jupyter.stderr' or 'application/vnd.jupyter.stdout'
	// corresponding to the stream name. The value of this property is the value of the 'text' field of the output object that was sent into the getData call
	let expectedStdErr = Object.create(null);
	expectedStdErr['application/vnd.jupyter.stderr'] = output.text;
	let expectedStdOut = Object.create(null);
	expectedStdOut['application/vnd.jupyter.stdout'] = output.text;
	const expectedData = output.name === 'stderr' ? expectedStdErr : expectedStdOut;
	const result = op.getData(output);
	assert.deepStrictEqual(result, expectedData, `getData should return the expectedData: '${JSON.stringify(expectedData)}' object`);
}

function verifyGetDataForErrorOutput(output: nbformat.IError): void {
	const result = op.getData(output);
	const tracedata = (output.traceback === undefined || output.traceback === []) ? undefined : output.traceback.join('\n');
	// getData returns an object with single property: 'application/vnd.jupyter.stderr'
	// this property is assigned to a '\n' delimited traceback data when it is present.
	// when traceback is absent this property gets ename and evalue information with ': ' as delimiter unless
	// ename is empty in which case it is just evalue information.
	let expectedData = Object.create(null);
	expectedData['application/vnd.jupyter.stderr'] = undefined;

	if (tracedata) {
		expectedData['application/vnd.jupyter.stderr'] = tracedata;
	}
	else if (output.evalue) {
		if (output.ename !== undefined && output.ename !== '') {
			expectedData['application/vnd.jupyter.stderr'] = `${output.ename}: ${output.evalue}`;
		}
		else {
			expectedData['application/vnd.jupyter.stderr'] = `${output.evalue}`;
		}
	}
	assert.deepStrictEqual(result, expectedData, `getData should return the expectedData: '${JSON.stringify(expectedData)}' object`);
}
