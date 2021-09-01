/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MetadataType } from 'sql/platform/connection/common/connectionManagement';

import * as assert from 'assert';
import { ObjectMetadataWrapper } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/objectMetadataWrapper';
import { ExplorerFilter } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerFilter';
import { ExplorerView } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerView';
import { FlavorProperties } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';

suite('Explorer Widget Tests', () => {
	test('Sorting dashboard search objects works correctly', () => {
		let testMetadata = [
			{
				metadataType: MetadataType.View,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'testView',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			},
			{
				metadataType: MetadataType.Table,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'testTable',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			},
			{
				metadataType: MetadataType.SProc,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'testSProc',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			},
			{
				metadataType: MetadataType.Function,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'testFunction',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			},
			{
				metadataType: MetadataType.View,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'firstView',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			}
		].map(m => new ObjectMetadataWrapper(m));

		// If I sort the object metadata wrapper list using ExplorerWidget's sort function
		let sortedMetadata = testMetadata.slice().sort(ObjectMetadataWrapper.sort);

		// Then the resulting list is sorted by type, with Table > View > Stored Procedures > Function, then by name
		let expectedList = [testMetadata[1], testMetadata[4], testMetadata[0], testMetadata[2], testMetadata[3]];
		expectedList.forEach((expectedWrapper, index) => assert.strictEqual(sortedMetadata[index], expectedWrapper));
	});

	test('Filter is only performed on the specified properties', () => {
		const prop1 = 'prop1';
		const prop2 = 'prop2';
		const prop3 = 'prop3';
		const filter = new ExplorerFilter('server', [prop1, prop2]);
		const obj1 = {};
		obj1[prop1] = 'abc';
		obj1[prop2] = 'def';
		obj1[prop3] = 'MatCh';
		const obj2 = {};
		obj2[prop1] = 'abc';
		obj2[prop2] = 'Match';
		obj2[prop3] = 'cd';
		const result = filter.filter('ATc', [obj1, obj2]);
		assert.strictEqual(result.length, 1, 'filtered result set should container 1 item');
		assert.strictEqual(result[0], obj2, 'filtered result set does not match expectation');
	});

	test('object type filter', () => {
		const testMetadata = [
			{
				metadataType: MetadataType.View,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'testView',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			},
			{
				metadataType: MetadataType.Table,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'testTable',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			},
			{
				metadataType: MetadataType.SProc,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'testSProc',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			},
			{
				metadataType: MetadataType.Function,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'testFunction',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			},
			{
				metadataType: MetadataType.View,
				metadataTypeName: undefined,
				urn: undefined,
				name: 'firstView',
				schema: undefined,
				parentName: undefined,
				parentTypeName: undefined
			}
		].map(o => new ObjectMetadataWrapper(o));
		const filter = new ExplorerFilter('database', ['name']);
		let result = filter.filter('t:', testMetadata);
		assert.strictEqual(result.length, 1, 'table type filter should return only 1 item');
		assert.strictEqual(result[0]['name'], 'testTable', 'table type filter does not return correct data');
		result = filter.filter('v:', testMetadata);
		assert.strictEqual(result.length, 2, 'view type filter should return only 1 item');
		assert.strictEqual(result[0]['name'], 'testView', 'view type filter does not return correct data');
		assert.strictEqual(result[1]['name'], 'firstView', 'view type filter does not return correct data');
		result = filter.filter('sp:', testMetadata);
		assert.strictEqual(result.length, 1, 'stored proc type filter should return only 1 item');
		assert.strictEqual(result[0]['name'], 'testSProc', 'stored proc type filter does not return correct data');
		result = filter.filter('f:', testMetadata);
		assert.strictEqual(result.length, 1, 'function type filter should return only 1 item');
		assert.strictEqual(result[0]['name'], 'testFunction', 'function type filter does not return correct data');
		result = filter.filter('v:first', testMetadata);
		assert.strictEqual(result.length, 1, 'view type and name filter should return only 1 item');
		assert.strictEqual(result[0]['name'], 'firstView', 'view type and name filter does not return correct data');
	});

	test('Icon css class test', () => {
		const serverView = new ExplorerView('server');
		let icon = serverView.getIconClass({});
		assert.strictEqual(icon, 'database-colored');
		const databaseView = new ExplorerView('database');
		const obj = {};
		obj['metadataType'] = MetadataType.Function;
		icon = databaseView.getIconClass(obj);
		assert.strictEqual(icon, 'scalarvaluedfunction');
		obj['metadataType'] = MetadataType.SProc;
		icon = databaseView.getIconClass(obj);
		assert.strictEqual(icon, 'storedprocedure');
		obj['metadataType'] = MetadataType.Table;
		icon = databaseView.getIconClass(obj);
		assert.strictEqual(icon, 'table');
		obj['metadataType'] = MetadataType.View;
		icon = databaseView.getIconClass(obj);
		assert.strictEqual(icon, 'view');
	});

	test('explorer property list', () => {
		const serverView = new ExplorerView('server');
		const emptyFlavor: FlavorProperties = {
			flavor: '',
			databaseProperties: [],
			serverProperties: [],
			databasesListProperties: [
			],
			objectsListProperties: []
		};

		const flavor: FlavorProperties = {
			flavor: '',
			databaseProperties: [],
			serverProperties: [],
			databasesListProperties: [
				{
					displayName: '',
					value: 'dbprop1'
				}
			],
			objectsListProperties: [{
				displayName: '',
				value: 'objprop1'
			}]
		};
		let propertyList = serverView.getPropertyList(emptyFlavor);
		assert.strictEqual(propertyList.length, 1, 'default database property list should contain 1 property');
		assert.strictEqual(propertyList[0].value, 'name', 'default database property list should contain name property');
		propertyList = serverView.getPropertyList(flavor);
		assert.strictEqual(propertyList.length, 1, 'database property list should contain 1 property');
		assert.strictEqual(propertyList[0].value, 'dbprop1', 'database property list should contain dbprop1 property');
		const databaseView = new ExplorerView('database');
		propertyList = databaseView.getPropertyList(emptyFlavor);
		assert.strictEqual(propertyList.length, 3, 'default object property list should contain 3 property');
		assert.strictEqual(propertyList[0].value, 'name', 'default object property list should contain name property');
		assert.strictEqual(propertyList[1].value, 'schema', 'default object property list should contain schema property');
		assert.strictEqual(propertyList[2].value, 'metadataTypeName', 'default object property list should contain metadataTypeName property');
		propertyList = databaseView.getPropertyList(flavor);
		assert.strictEqual(propertyList.length, 1, 'object property list should contain 1 property');
		assert.strictEqual(propertyList[0].value, 'objprop1', 'object property list should contain objprop1 property');
	});
});
