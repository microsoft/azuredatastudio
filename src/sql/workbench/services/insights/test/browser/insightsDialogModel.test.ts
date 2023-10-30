/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InsightsDialogModel } from 'sql/workbench/services/insights/browser/insightsDialogModel';
import { isUndefinedOrNull } from 'vs/base/common/types';

import * as assert from 'assert';
import { IInsightsLabel, IInsightsConfigDetails } from 'sql/platform/extensions/common/extensions';

suite('Insights Dialog Model Tests', () => {
	test('does parse condition right', () => {
		let insightsDialogModel = new InsightsDialogModel();

		let label: IInsightsLabel = {
			column: undefined,
			state: [
				{
					condition: {
						if: 'always'
					},
					color: 'green'
				}
			]
		} as IInsightsLabel;
		insightsDialogModel.insight = { label } as IInsightsConfigDetails;
		insightsDialogModel.rows = [
			['label1', 'value1'],
			['label2', 'value2'],
			['label3', 'value3']
		];
		let result = insightsDialogModel.getListResources(0, 1);
		for (let resource of result) {
			assert.strictEqual(resource.stateColor, 'green', 'always Condition did not return val as expected');
		}

		label.state = [
			{
				condition: {
					if: 'equals',
					equals: 'specific value'
				},
				color: 'green'
			}
		];

		insightsDialogModel.insight = { label } as IInsightsConfigDetails;
		insightsDialogModel.rows = [
			['label1', 'specific value'],
			['label2', 'value2'],
			['label3', 'value3']
		];
		result = insightsDialogModel.getListResources(0, 1);
		assert.strictEqual(result[0].stateColor, 'green', 'always Condition did not return val as expected');
		assert.strictEqual(isUndefinedOrNull(result[1].stateColor), true, 'always Condition did not return val as expected');
		assert.strictEqual(isUndefinedOrNull(result[2].stateColor), true, 'always Condition did not return val as expected');

		label.state = [
			{
				condition: {
					if: 'equals',
					equals: 'specific value'
				},
				color: 'green'
			},
			{
				condition: {
					if: 'equals',
					equals: 'specific value2'
				},
				color: 'red'
			}
		];

		insightsDialogModel.insight = { label } as IInsightsConfigDetails;
		insightsDialogModel.rows = [
			['label1', 'specific value'],
			['label2', 'specific value2'],
			['label3', 'value3']
		];
		result = insightsDialogModel.getListResources(0, 1);
		assert.strictEqual(result[0].stateColor, 'green', 'always Condition did not return val as expected');
		assert.strictEqual(result[1].stateColor, 'red', 'always Condition did not return val as expected');
		assert.strictEqual(isUndefinedOrNull(result[2].stateColor), true, 'always Condition did not return val as expected');

		label.state = [
			{
				condition: {
					if: 'greaterThan',
					equals: '2'
				},
				color: 'green'
			},
			{
				condition: {
					if: 'equals',
					equals: 'specific value2'
				},
				color: 'red'
			}
		];

		insightsDialogModel.insight = { label } as IInsightsConfigDetails;
		insightsDialogModel.rows = [
			['label1', '3'],
			['label2', 'specific value2'],
			['label3', 'value3']
		];
		result = insightsDialogModel.getListResources(0, 1);
		assert.strictEqual(result[0].stateColor, 'green', 'always Condition did not return val as expected');
		assert.strictEqual(result[1].stateColor, 'red', 'always Condition did not return val as expected');
		assert.strictEqual(isUndefinedOrNull(result[2].stateColor), true, 'always Condition did not return val as expected');

		label.state = [
			{
				condition: {
					if: 'greaterThanOrEquals',
					equals: '2'
				},
				color: 'green'
			},
			{
				condition: {
					if: 'equals',
					equals: 'specific value2'
				},
				color: 'red'
			}
		];

		insightsDialogModel.insight = { label } as IInsightsConfigDetails;
		insightsDialogModel.rows = [
			['label1', '2'],
			['label2', 'specific value2'],
			['label3', 'value3']
		];
		result = insightsDialogModel.getListResources(0, 1);
		assert.strictEqual(result[0].stateColor, 'green', 'always Condition did not return val as expected');
		assert.strictEqual(result[1].stateColor, 'red', 'always Condition did not return val as expected');
		assert.strictEqual(isUndefinedOrNull(result[2].stateColor), true, 'always Condition did not return val as expected');

		label.state = [
			{
				condition: {
					if: 'lessThan',
					equals: '8'
				},
				color: 'green'
			},
			{
				condition: {
					if: 'equals',
					equals: 'specific value2'
				},
				color: 'red'
			}
		];

		insightsDialogModel.insight = { label } as IInsightsConfigDetails;
		insightsDialogModel.rows = [
			['label1', '5'],
			['label2', 'specific value2'],
			['label3', 'value3']
		];
		result = insightsDialogModel.getListResources(0, 1);
		assert.strictEqual(result[0].stateColor, 'green', 'always Condition did not return val as expected');
		assert.strictEqual(result[1].stateColor, 'red', 'always Condition did not return val as expected');
		assert.strictEqual(isUndefinedOrNull(result[2].stateColor), true, 'always Condition did not return val as expected');

		label.state = [
			{
				condition: {
					if: 'lessThanOrEquals',
					equals: '8'
				},
				color: 'green'
			},
			{
				condition: {
					if: 'equals',
					equals: 'specific value2'
				},
				color: 'red'
			}
		];

		insightsDialogModel.insight = { label } as IInsightsConfigDetails;
		insightsDialogModel.rows = [
			['label1', '8'],
			['label2', 'specific value2'],
			['label3', 'value3']
		];
		result = insightsDialogModel.getListResources(0, 1);
		assert.strictEqual(result[0].stateColor, 'green', 'always Condition did not return val as expected');
		assert.strictEqual(result[1].stateColor, 'red', 'always Condition did not return val as expected');
		assert.strictEqual(isUndefinedOrNull(result[2].stateColor), true, 'always Condition did not return val as expected');

		label.state = [
			{
				condition: {
					if: 'notEquals',
					equals: '9'
				},
				color: 'green'
			},
			{
				condition: {
					if: 'equals',
					equals: 'specific value2'
				},
				color: 'red'
			}
		];

		insightsDialogModel.insight = { label } as IInsightsConfigDetails;
		insightsDialogModel.rows = [
			['label1', '8'],
			['label2', '9'],
			['label3', 'value3']
		];
		result = insightsDialogModel.getListResources(0, 1);
		assert.strictEqual(result[0].stateColor, 'green', 'always Condition did not return val as expected');
		assert.strictEqual(isUndefinedOrNull(result[1].stateColor), true, 'always Condition did not return val as expected');
		assert.strictEqual(result[2].stateColor, 'green', 'always Condition did not return val as expected');

		label.state = [
			{
				condition: {
					if: 'notEquals',
					equals: '9'
				},
				color: 'green'
			},
			{
				condition: {
					if: 'always'
				},
				color: 'red'
			}
		];

		insightsDialogModel.insight = { label } as IInsightsConfigDetails;
		insightsDialogModel.rows = [
			['label1', '8'],
			['label2', 'specific value2'],
			['label3', 'value3']
		];
		result = insightsDialogModel.getListResources(0, 1);
		assert.strictEqual(result[0].stateColor, 'green', 'always Condition did not return val as expected');
		assert.strictEqual(result[1].stateColor, 'green', 'always Condition did not return val as expected');
		assert.strictEqual(result[2].stateColor, 'green', 'always Condition did not return val as expected');
	});
});
