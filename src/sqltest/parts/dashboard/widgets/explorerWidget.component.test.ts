/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectMetadataWrapper } from 'sql/parts/dashboard/widgets/explorer/explorerTree';
import { MetadataType } from 'sql/platform/connection/common/connectionManagement';

import * as assert from 'assert';

suite('Explorer Widget Tests', () => {
	test('Sorting dashboard search objects works correctly', () => {
		let testMetadata = ObjectMetadataWrapper.createFromObjectMetadata(
			[
				{
					metadataType: MetadataType.View,
					metadataTypeName: undefined,
					urn: undefined,
					name: 'testView',
					schema: undefined
				},
				{
					metadataType: MetadataType.Table,
					metadataTypeName: undefined,
					urn: undefined,
					name: 'testTable',
					schema: undefined
				},
				{
					metadataType: MetadataType.SProc,
					metadataTypeName: undefined,
					urn: undefined,
					name: 'testSProc',
					schema: undefined
				},
				{
					metadataType: MetadataType.Function,
					metadataTypeName: undefined,
					urn: undefined,
					name: 'testFunction',
					schema: undefined
				},
				{
					metadataType: MetadataType.View,
					metadataTypeName: undefined,
					urn: undefined,
					name: 'firstView',
					schema: undefined
				}
			]);

		// If I sort the object metadata wrapper list using ExplorerWidget's sort function
		let sortedMetadata = testMetadata.slice().sort(ObjectMetadataWrapper.sort);

		// Then the resulting list is sorted by type, with Table > View > Stored Procedures > Function, then by name
		let expectedList = [testMetadata[1], testMetadata[4], testMetadata[0], testMetadata[2], testMetadata[3]];
		expectedList.forEach((expectedWrapper, index) => assert.equal(sortedMetadata[index], expectedWrapper));
	});
});