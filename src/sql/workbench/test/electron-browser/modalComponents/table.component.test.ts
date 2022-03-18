/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import TableComponent from 'sql/workbench/browser/modelComponents/table.component';
import { NullLogService } from 'vs/platform/log/common/log';

suite('TableComponent Tests', () => {

	setup(() => {

	});

	test('Table transformData should convert data and columns successfully given valid inputs', () => {
		let data = [
			['1', '2', '2'],
			['4', '5', '6']
		];
		let columns = ['c1', 'c2', 'c3'];
		const tableComponent = new TableComponent(undefined, undefined, undefined, new NullLogService(), undefined);

		let actual = tableComponent.transformData(data, columns);
		let expected: { [key: string]: string }[] = [
			{
				'c1': '1',
				'c2': '2',
				'c3': '2'
			},
			{
				'c1': '4',
				'c2': '5',
				'c3': '6'
			}
		];
		assert.deepStrictEqual(actual, expected);
	});

	test('Table transformData should return empty array given undefined rows', () => {
		let data = undefined;
		const tableComponent = new TableComponent(undefined, undefined, undefined, new NullLogService(), undefined);
		let columns = ['c1', 'c2', 'c3'];
		let actual = tableComponent.transformData(data, columns);
		let expected: { [key: string]: string }[] = [];
		assert.deepStrictEqual(actual, expected);
	});

	test('Table transformData should return empty array given undefined columns', () => {
		let data = [
			['1', '2', '2'],
			['4', '5', '6']
		];
		let columns;
		const tableComponent = new TableComponent(undefined, undefined, undefined, new NullLogService(), undefined);
		let actual = tableComponent.transformData(data, columns);
		let expected: { [key: string]: string }[] = [];
		assert.deepStrictEqual(actual, expected);
	});

	test('Table transformData should return array matched with columns given rows with missing column', () => {
		let data = [
			['1', '2'],
			['4', '5']
		];
		const tableComponent = new TableComponent(undefined, undefined, undefined, new NullLogService(), undefined);
		let columns = ['c1', 'c2', 'c3'];
		let actual = tableComponent.transformData(data, columns);
		let expected: { [key: string]: string }[] = [
			{
				'c1': '1',
				'c2': '2'
			},
			{
				'c1': '4',
				'c2': '5'
			}
		];
		assert.deepStrictEqual(actual, expected);
	});
});
