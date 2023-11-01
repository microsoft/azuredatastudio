/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TestEditorInput, TestEditorService } from 'vs/workbench/test/browser/workbenchTestServices';
import { URI } from 'vs/base/common/uri';
import { NullLogService } from 'vs/platform/log/common/log';

suite('TaskUtilities', function () {
	test('getCurrentGlobalConnection returns the selected OE server if a server or one of its children is selected', () => {
		let connectionProfile = { databaseName: 'test_database', id: 'test_id', authenticationType: 'SQL Login', password: 'test_password', serverName: 'test_server', userName: 'test_user' } as IConnectionProfile;
		let mockObjectExplorerService = TypeMoq.Mock.ofInstance({ isFocused: () => undefined, getSelectedProfileAndDatabase: () => undefined } as IObjectExplorerService);
		let mockConnectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService);
		let mockWorkbenchEditorService = TypeMoq.Mock.ofType(TestEditorService);
		let expectedProfile = new ConnectionProfile(undefined, connectionProfile);
		mockObjectExplorerService.setup(x => x.isFocused()).returns(() => true);
		mockObjectExplorerService.setup(x => x.getSelectedProfileAndDatabase()).returns(() => {
			return { profile: expectedProfile, databaseName: undefined };
		});
		mockConnectionManagementService.setup(x => x.isProfileConnected(TypeMoq.It.is(profile => profile === expectedProfile))).returns(() => true);

		// If I call getCurrentGlobalConnection, it should return the expected server profile
		let actualProfile = TaskUtilities.getCurrentGlobalConnection(mockObjectExplorerService.object, mockConnectionManagementService.object, mockWorkbenchEditorService.object, new NullLogService());
		assert.strictEqual(actualProfile, expectedProfile);
	});

	test('getCurrentGlobalConnection returns the selected OE database if a database or its children is selected', () => {
		let connectionProfile = { databaseName: 'test_database', id: 'test_id', authenticationType: 'SQL Login', password: 'test_password', serverName: 'test_server', userName: 'test_user' } as IConnectionProfile;
		let mockObjectExplorerService = TypeMoq.Mock.ofInstance({ isFocused: () => undefined, getSelectedProfileAndDatabase: () => undefined } as IObjectExplorerService);
		let mockConnectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService);
		let mockWorkbenchEditorService = TypeMoq.Mock.ofType(TestEditorService);
		let serverProfile = new ConnectionProfile(undefined, connectionProfile);
		let dbName = 'test_database';
		mockObjectExplorerService.setup(x => x.isFocused()).returns(() => true);
		mockObjectExplorerService.setup(x => x.getSelectedProfileAndDatabase()).returns(() => {
			return { profile: serverProfile, databaseName: dbName };
		});
		mockConnectionManagementService.setup(x => x.isProfileConnected(TypeMoq.It.is(profile => profile === serverProfile))).returns(() => true);

		// If I call getCurrentGlobalConnection, it should return the expected database profile
		let actualProfile = TaskUtilities.getCurrentGlobalConnection(mockObjectExplorerService.object, mockConnectionManagementService.object, mockWorkbenchEditorService.object, new NullLogService());
		assert.strictEqual(actualProfile.databaseName, dbName);
		assert.notStrictEqual(actualProfile.id, serverProfile.id);
		// Other connection attributes still match
		assert.strictEqual(actualProfile.authenticationType, serverProfile.authenticationType);
		assert.strictEqual(actualProfile.password, serverProfile.password);
		assert.strictEqual(actualProfile.serverName, serverProfile.serverName);
		assert.strictEqual(actualProfile.userName, serverProfile.userName);
	});

	test('getCurrentGlobalConnection returns the connection from the active tab, if there is one and OE is not focused', () => {
		let connectionProfile = { databaseName: 'test_database', id: 'test_id', authenticationType: 'SQL Login', password: 'test_password', serverName: 'test_server', userName: 'test_user' } as IConnectionProfile;
		let mockObjectExplorerService = TypeMoq.Mock.ofInstance({ isFocused: () => undefined, getSelectedProfileAndDatabase: () => undefined } as IObjectExplorerService);
		let mockConnectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService);
		let mockWorkbenchEditorService = TypeMoq.Mock.ofType(TestEditorService);
		let oeProfile = new ConnectionProfile(undefined, connectionProfile);
		let connectionProfile2 = Object.assign({}, connectionProfile);
		connectionProfile2.serverName = 'test_server_2';
		connectionProfile2.id = 'test_id_2';
		let tabProfile = new ConnectionProfile(undefined, connectionProfile2);
		mockObjectExplorerService.setup(x => x.isFocused()).returns(() => false);
		mockObjectExplorerService.setup(x => x.getSelectedProfileAndDatabase()).returns(() => {
			return { profile: oeProfile, databaseName: undefined };
		});
		mockConnectionManagementService.setup(x => x.isProfileConnected(TypeMoq.It.is(profile => profile === oeProfile || profile === tabProfile))).returns(() => true);

		// Mock the workbench service to return the active tab connection
		const tabConnectionUri = URI.file('file://test_uri');
		mockWorkbenchEditorService.setup(x => x.activeEditor).returns(() => new TestEditorInput(tabConnectionUri, 'my_type'));
		mockConnectionManagementService.setup(x => x.getConnectionProfile(tabConnectionUri.toString(true))).returns(() => tabProfile);

		// If I call getCurrentGlobalConnection, it should return the expected profile from the active tab
		let actualProfile = TaskUtilities.getCurrentGlobalConnection(mockObjectExplorerService.object, mockConnectionManagementService.object, mockWorkbenchEditorService.object, new NullLogService());
		assert.strictEqual(actualProfile.databaseName, connectionProfile2.databaseName);
		assert.strictEqual(actualProfile.authenticationType, connectionProfile2.authenticationType);
		assert.strictEqual(actualProfile.password, connectionProfile2.password);
		assert.strictEqual(actualProfile.serverName, connectionProfile2.serverName);
		assert.strictEqual(actualProfile.userName, connectionProfile2.userName);
	});

	test('getCurrentGlobalConnection returns the connection from OE if there is no active tab, even if OE is not focused', () => {
		let connectionProfile = { databaseName: 'test_database', id: 'test_id', authenticationType: 'SQL Login', password: 'test_password', serverName: 'test_server', userName: 'test_user' } as IConnectionProfile;
		let mockObjectExplorerService = TypeMoq.Mock.ofInstance({ isFocused: () => undefined, getSelectedProfileAndDatabase: () => undefined } as IObjectExplorerService);
		let mockConnectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService);
		let mockWorkbenchEditorService = TypeMoq.Mock.ofType(TestEditorService);
		let oeProfile = new ConnectionProfile(undefined, connectionProfile);
		mockObjectExplorerService.setup(x => x.isFocused()).returns(() => false);
		mockObjectExplorerService.setup(x => x.getSelectedProfileAndDatabase()).returns(() => {
			return { profile: oeProfile, databaseName: undefined };
		});
		mockConnectionManagementService.setup(x => x.isProfileConnected(TypeMoq.It.is(profile => profile === oeProfile))).returns(() => true);

		// If I call getCurrentGlobalConnection, it should return the expected profile from OE
		let actualProfile = TaskUtilities.getCurrentGlobalConnection(mockObjectExplorerService.object, mockConnectionManagementService.object, mockWorkbenchEditorService.object, new NullLogService());
		assert.strictEqual(actualProfile, oeProfile);
	});
});
