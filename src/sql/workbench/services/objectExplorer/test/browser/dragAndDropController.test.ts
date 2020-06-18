/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ServerTreeDragAndDrop } from 'sql/workbench/services/objectExplorer/browser/dragAndDropController';
import { TestTree } from 'sql/workbench/test/treeMock';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';



import * as TypeMoq from 'typemoq';
import * as assert from 'assert';



suite('SQL Drag And Drop Controller tests', () => {
	const testTree = new TestTree();
	let serverTreeDragAndDrop: ServerTreeDragAndDrop;
	let msSQLCapabilities: ConnectionProviderProperties;
	let capabilitiesService: TestCapabilitiesService;

	let iConnectionProfileId: IConnectionProfile = {
		connectionName: 'new name',
		serverName: 'new server',
		databaseName: 'database',
		userName: 'user',
		password: 'password',
		authenticationType: '',
		savePassword: true,
		groupFullName: 'g2/g2-2',
		groupId: 'group id',
		getOptionsKey: undefined!,
		matches: undefined!,
		providerName: mssqlProviderName,
		options: {},
		saveProfile: true,
		id: 'd936bb32-422b-49c3-963f-ae9532d63dc5'
	};

	let connectionProfileId = new ConnectionProfile(capabilitiesService, iConnectionProfileId);
	let connectionProfileArray = [connectionProfileId];
	let connectionProfileGroupId = new ConnectionProfileGroup('name', undefined, 'd936bb32-422b-49c3-963f-ae9532d63dc5', 'color', 'description');
	let connectionProfileGroupArray = [connectionProfileGroupId];
	let treeNode = new TreeNode('Column', 'label', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
	let treeNodeArray = [treeNode];

	setup(() => {
		let instantiationService = new TestInstantiationService();
		instantiationService.stub(IStorageService, new TestStorageService());
		let mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict,
			undefined, //connection store
			undefined, // connectionstatusmanager
			undefined, // connectiondialog service
			instantiationService, // instantiation service
			undefined, // editor service
			undefined, // telemetryservice
			undefined, // configuration service
			new TestCapabilitiesService(), // capabilities service
		);
		serverTreeDragAndDrop = new ServerTreeDragAndDrop(mockConnectionManagementService.object);

		capabilitiesService = new TestCapabilitiesService();
		capabilitiesService.capabilities[mssqlProviderName] = { connection: msSQLCapabilities };
	});


	test('create new serverTreeDragAndDrop object should create serverTreeDragAndDrop object successfully', async () => {

		assert.equal(serverTreeDragAndDrop !== null || serverTreeDragAndDrop !== undefined, true);
	});

	test('able to get DragURI', async () => {
		let uri = serverTreeDragAndDrop.getDragURI(testTree, connectionProfileId);
		assert.equal(connectionProfileId.id, uri);

		let uriGroup = serverTreeDragAndDrop.getDragURI(testTree, connectionProfileGroupId);
		assert.equal(connectionProfileGroupId.id, uriGroup);

		let uriUndefined = serverTreeDragAndDrop.getDragURI(testTree, null);
		assert.equal(null, uriUndefined);

	});

	test('able to get DragLabel', async () => {
		let label = serverTreeDragAndDrop.getDragLabel(testTree, connectionProfileArray);
		assert.equal(connectionProfileArray[0].serverName, label);

		let labelGroup = serverTreeDragAndDrop.getDragLabel(testTree, connectionProfileGroupArray);
		assert.equal(connectionProfileGroupArray[0].name, labelGroup);

		let labelTreeNode = serverTreeDragAndDrop.getDragLabel(testTree, treeNodeArray);
		assert.equal(treeNodeArray[0].label, labelTreeNode);

		let labelUndefined = serverTreeDragAndDrop.getDragLabel(testTree, null);
		assert.equal(undefined, labelUndefined);

	});


});
