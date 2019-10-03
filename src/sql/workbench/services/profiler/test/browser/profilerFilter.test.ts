/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { FilterData } from 'sql/workbench/services/profiler/browser/profilerFilter';
import { ProfilerFilterClauseOperator, ProfilerFilter } from 'sql/workbench/services/profiler/browser/interfaces';

const property1 = 'property1';
const property2 = 'property2';

suite('Profiler filter data tests', () => {
	test('number type filter data test', () => {
		let filter: ProfilerFilter = { clauses: [] };
		let entry1: TestData = { property1: '-1', property2: '0' };
		let entry2: TestData = { property1: '0', property2: '10' };
		let entry3: TestData = { property1: '10.0', property2: '-1' };

		let data: TestData[] = [entry1, entry2, entry3];

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.Equals, value: '10' }];
		filterAndVerify(filter, data, [entry3], 'Equals operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.NotEquals, value: '-1' }];
		filterAndVerify(filter, data, [entry2, entry3], 'NotEquals operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.GreaterThan, value: '2' }];
		filterAndVerify(filter, data, [entry3], 'GreaterThan operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.GreaterThanOrEquals, value: '0' }];
		filterAndVerify(filter, data, [entry2, entry3], 'GreaterThanOrEquals operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.LessThan, value: '0' }];
		filterAndVerify(filter, data, [entry1], 'LessThan operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.LessThanOrEquals, value: '0' }];
		filterAndVerify(filter, data, [entry1, entry2], 'LessThanOrEquals operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.LessThanOrEquals, value: '-2' }];
		filterAndVerify(filter, data, [], 'Empty result set');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.LessThanOrEquals, value: '10' }];
		filterAndVerify(filter, data, data, 'All matches');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.LessThanOrEquals, value: '0' },
		{ field: property2, operator: ProfilerFilterClauseOperator.LessThan, value: '10' }];
		filterAndVerify(filter, data, [entry1], 'Multiple clauses');
	});

	test('date type filter data test', () => {
		let filter: ProfilerFilter = { clauses: [] };
		let entry1: TestData = { property1: '2019-01-02T19:00:00.000Z', property2: '' };
		let entry2: TestData = { property1: '2019-01-03T10:00:00.000Z', property2: '' };
		let entry3: TestData = { property1: '2019-01-04T10:00:00.000Z', property2: '' };

		let data: TestData[] = [entry1, entry2, entry3];

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.Equals, value: '2019-01-02T19:00:00Z' }];
		filterAndVerify(filter, data, [entry1], 'Equals operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.NotEquals, value: '2019-01-03T10:00:00Z' }];
		filterAndVerify(filter, data, [entry1, entry3], 'NotEquals operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.GreaterThan, value: '2019-01-01T00:00:00Z' }];
		filterAndVerify(filter, data, [entry1, entry2, entry3], 'GreaterThan operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.GreaterThanOrEquals, value: '2019-01-03T10:00:00.000Z' }];
		filterAndVerify(filter, data, [entry2, entry3], 'GreaterThanOrEquals operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.LessThan, value: '2019-01-03T10:00:00.000Z' }];
		filterAndVerify(filter, data, [entry1], 'LessThan operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.LessThanOrEquals, value: '2019-01-03T10:00:00Z' }];
		filterAndVerify(filter, data, [entry1, entry2], 'LessThanOrEquals operator');
	});

	test('string type filter data test', () => {
		let filter: ProfilerFilter = { clauses: [] };
		let entry1: TestData = { property1: '', property2: '' };
		let entry2: TestData = { property1: 'test string', property2: '' };
		let entry3: TestData = { property1: 'new string', property2: '' };

		let data: TestData[] = [entry1, entry2, entry3];

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.IsNull, value: '' }];
		filterAndVerify(filter, data, [entry1], 'IsNull operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.IsNotNull, value: '' }];
		filterAndVerify(filter, data, [entry2, entry3], 'IsNotNull operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.Contains, value: 'sTRing' }];
		filterAndVerify(filter, data, [entry2, entry3], 'Contains operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.NotContains, value: 'string' }];
		filterAndVerify(filter, data, [entry1], 'NotContains operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.StartsWith, value: 'tEst' }];
		filterAndVerify(filter, data, [entry2], 'StartsWith operator');

		filter.clauses = [{ field: property1, operator: ProfilerFilterClauseOperator.NotStartsWith, value: 'Test' }];
		filterAndVerify(filter, data, [entry1, entry3], 'NotStartsWith operator');
	});
});

function filterAndVerify(filter: ProfilerFilter, data: TestData[], expectedResult: TestData[], stepName: string) {
	let actualResult = FilterData(filter, data);
	assert.equal(actualResult.length, expectedResult.length, `length check for ${stepName}`);
	for (let i = 0; i < actualResult.length; i++) {
		let actual = actualResult[i];
		let expected = expectedResult[i];
		assert(actual.property1 === expected.property1 && actual.property2 === expected.property2, `array content check for ${stepName}`);
	}
}

interface TestData {
	property1: string;
	property2: string;
}
