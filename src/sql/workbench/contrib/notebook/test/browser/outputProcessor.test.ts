/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { nb } from 'azdata';
import * as op from 'sql/workbench/contrib/notebook/browser/models/outputProcessor';
import { JSONObject } from 'sql/workbench/services/notebook/common/jsonext';
import { nbformat as nbformat } from 'sql/workbench/services/notebook/common/nbformat';
import { getRandomString } from 'vs/editor/test/common/model/linesTextBuffer/textBufferAutoTestUtils';


suite('OutputProcessor functions', function (): void {
	suite('getData', async function (): Promise<void> {
		for (const outputType of ['execute_result', 'display_data', 'update_display_data', 'stream', 'error'] as nbformat.OutputType[]) {
			const text = getRandomString(1, 10);
			const output: nb.ICellOutput = {
				output_type: outputType
			};
			if (nbformat.isError(output)) {
				for (const traceback of [undefined, [], [getRandomString(1, 10), getRandomString(1, 10)]]) {
					for (const evalue of [undefined, getRandomString(1, 10)]) {
						for (const ename of [text, '']) {
							test(`test for outputType:${outputType}, ename:'${ename}', evalue:${evalue}, and traceback:${JSON.stringify(traceback)}`, async () => {
								output.ename = ename;
								output.evalue = evalue;
								output.traceback = traceback;
								const result = op.getData(output);
								const tracedata = (traceback === undefined || traceback === []) ? undefined : traceback.join('\n');
								let expectedData: JSONObject = {
									'application/vnd.jupyter.stderr': undefined
								};
								if (tracedata) {
									expectedData = {
										'application/vnd.jupyter.stderr': tracedata
									};
								} else if (evalue) {
									if (ename !== '') {
										expectedData = {
											'application/vnd.jupyter.stderr': `${output.ename}: ${output.evalue}`
										};
									} else {
										expectedData = {
											'application/vnd.jupyter.stderr': `${output.evalue}`
										};
									}

								}
								assert.deepEqual(result, <JSONObject>expectedData, `getData should return the expectedData:'${JSON.stringify(expectedData)}' object`);
							});
						}
					}
				}
			} else if (nbformat.isStream(output)) {
				for (const name of ['stderr', 'stdout'] as nbformat.StreamType[]) {
					test(`test for outputType:${outputType} and name:${name}`, async () => {
						output.text = text;
						output.name = name;
						const expectedData =
							name === 'stderr'
								? {
									'application/vnd.jupyter.stderr': output.text,
								}
								: {
									'application/vnd.jupyter.stdout': output.text,
								};
						const result = op.getData(output);
						assert.deepEqual(result, expectedData, `getData should return the expectedData:${expectedData} object`);
					});
				}
			} else {
				test(`test for outputType:${outputType}`, async () => {
					const expectedData = {
						data: text
					};
					(output as nbformat.IExecuteResult).data = expectedData;
					const result = op.getData(output);
					assert.deepEqual(result, expectedData, `getData should return the expectedData:${expectedData} object`);
				});
			}
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
					assert.deepEqual(result, metadata, `getData should return the expectedData:'${JSON.stringify(metadata)}' object`);
				} else {
					assert.deepEqual(result, {}, `getMetadata should return the expectedData:'${JSON.stringify(metadata)}' object`);
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
				assert.deepEqual(result, expected, `getBundleOptions did not return the expected object:'${JSON.stringify(expected)}'`);
			});
		}
	});
});

function getRandom<T>(...list: T[]): T {
	return list[Math.floor((Math.random() * list.length))];
}
