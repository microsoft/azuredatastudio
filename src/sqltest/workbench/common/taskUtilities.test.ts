/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { TestConnectionManagementService } from 'sqltest/stubs/connectionManagementService.test';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { WorkbenchEditorTestService } from 'sqltest/stubs/workbenchEditorTestService';
import { URI } from 'vs/base/common/uri';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { QueryInput } from 'sql/parts/query/common/queryInput';

suite('TaskUtilities', function () {
	test('getCurrentGlobalConnection returns the selected OE server if a server or one of its children is selected', () => {
		let connectionProfile = { databaseName: 'test_database', id: 'test_id', authenticationType: 'SQL Login', password: 'test_password', serverName: 'test_server', userName: 'test_user' } as IConnectionProfile;
		let mockObjectExplorerService = TypeMoq.Mock.ofInstance({ isFocused: () => undefined, getSelectedProfileAndDatabase: () => undefined } as IObjectExplorerService);
		let mockConnectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService);
		let mockWorkbenchEditorService = TypeMoq.Mock.ofType(WorkbenchEditorTestService);
		let expectedProfile = new ConnectionProfile(undefined, connectionProfile);
		mockObjectExplorerService.setup(x => x.isFocused()).returns(() => true);
		mockObjectExplorerService.setup(x => x.getSelectedProfileAndDatabase()).returns(() => {
			return { profile: expectedProfile, databaseName: undefined };
		});
		mockConnectionManagementService.setup(x => x.isProfileConnected(TypeMoq.It.is(profile => profile === expectedProfile))).returns(() => true);

		// If I call getCurrentGlobalConnection, it should return the expected server profile
		let actualProfile = TaskUtilities.getCurrentGlobalConnection(mockObjectExplorerService.object, mockConnectionManagementService.object, mockWorkbenchEditorService.object);
		assert.equal(actualProfile, expectedProfile);
	});

	test('getCurrentGlobalConnection returns the selected OE database if a database or its children is selected', () => {
		let connectionProfile = { databaseName: 'test_database', id: 'test_id', authenticationType: 'SQL Login', password: 'test_password', serverName: 'test_server', userName: 'test_user' } as IConnectionProfile;
		let mockObjectExplorerService = TypeMoq.Mock.ofInstance({ isFocused: () => undefined, getSelectedProfileAndDatabase: () => undefined } as IObjectExplorerService);
		let mockConnectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService);
		let mockWorkbenchEditorService = TypeMoq.Mock.ofType(WorkbenchEditorTestService);
		let serverProfile = new ConnectionProfile(undefined, connectionProfile);
		let dbName = 'test_database';
		mockObjectExplorerService.setup(x => x.isFocused()).returns(() => true);
		mockObjectExplorerService.setup(x => x.getSelectedProfileAndDatabase()).returns(() => {
			return { profile: serverProfile, databaseName: dbName };
		});
		mockConnectionManagementService.setup(x => x.isProfileConnected(TypeMoq.It.is(profile => profile === serverProfile))).returns(() => true);

		// If I call getCurrentGlobalConnection, it should return the expected database profile
		let actualProfile = TaskUtilities.getCurrentGlobalConnection(mockObjectExplorerService.object, mockConnectionManagementService.object, mockWorkbenchEditorService.object);
		assert.equal(actualProfile.databaseName, dbName);
		assert.notEqual(actualProfile.id, serverProfile.id);
		// Other connection attributes still match
		assert.equal(actualProfile.authenticationType, serverProfile.authenticationType);
		assert.equal(actualProfile.password, serverProfile.password);
		assert.equal(actualProfile.serverName, serverProfile.serverName);
		assert.equal(actualProfile.userName, serverProfile.userName);
	});

	test('getCurrentGlobalConnection returns the connection from the active tab, if there is one and OE is not focused', () => {
		let connectionProfile = { databaseName: 'test_database', id: 'test_id', authenticationType: 'SQL Login', password: 'test_password', serverName: 'test_server', userName: 'test_user' } as IConnectionProfile;
		let mockObjectExplorerService = TypeMoq.Mock.ofInstance({ isFocused: () => undefined, getSelectedProfileAndDatabase: () => undefined } as IObjectExplorerService);
		let mockConnectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService);
		let mockWorkbenchEditorService = TypeMoq.Mock.ofType(WorkbenchEditorTestService);
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
		let tabConnectionUri = 'file://test_uri';
		let editorInput = new UntitledEditorInput(URI.parse(tabConnectionUri), false, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
		let queryInput = new QueryInput(undefined, editorInput, undefined, undefined, undefined, undefined, undefined, undefined);
		mockConnectionManagementService.setup(x => x.getConnectionProfile(tabConnectionUri)).returns(() => tabProfile);

		// If I call getCurrentGlobalConnection, it should return the expected profile from the active tab
		let actualProfile = TaskUtilities.getCurrentGlobalConnection(mockObjectExplorerService.object, mockConnectionManagementService.object, mockWorkbenchEditorService.object);
		assert.equal(actualProfile.databaseName, tabProfile.databaseName);
		assert.equal(actualProfile.authenticationType, tabProfile.authenticationType);
		assert.equal(actualProfile.password, tabProfile.password);
		assert.equal(actualProfile.serverName, tabProfile.serverName);
		assert.equal(actualProfile.userName, tabProfile.userName);
	});

	test('getCurrentGlobalConnection returns the connection from OE if there is no active tab, even if OE is not focused', () => {
		let connectionProfile = { databaseName: 'test_database', id: 'test_id', authenticationType: 'SQL Login', password: 'test_password', serverName: 'test_server', userName: 'test_user' } as IConnectionProfile;
		let mockObjectExplorerService = TypeMoq.Mock.ofInstance({ isFocused: () => undefined, getSelectedProfileAndDatabase: () => undefined } as IObjectExplorerService);
		let mockConnectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService);
		let mockWorkbenchEditorService = TypeMoq.Mock.ofType(WorkbenchEditorTestService);
		let oeProfile = new ConnectionProfile(undefined, connectionProfile);
		mockObjectExplorerService.setup(x => x.isFocused()).returns(() => false);
		mockObjectExplorerService.setup(x => x.getSelectedProfileAndDatabase()).returns(() => {
			return { profile: oeProfile, databaseName: undefined };
		});
		mockConnectionManagementService.setup(x => x.isProfileConnected(TypeMoq.It.is(profile => profile === oeProfile))).returns(() => true);

		// If I call getCurrentGlobalConnection, it should return the expected profile from OE
		let actualProfile = TaskUtilities.getCurrentGlobalConnection(mockObjectExplorerService.object, mockConnectionManagementService.object, mockWorkbenchEditorService.object);
		assert.equal(actualProfile, oeProfile);
	});
});