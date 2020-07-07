/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ServerTreeView } from 'sql/workbench/contrib/objectExplorer/browser/serverTreeView';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import * as TypeMoq from 'typemoq';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { TestTree } from 'sql/workbench/test/treeMock';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { TreeItemCollapsibleState } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import * as assert from 'assert';

suite('ServerTreeView onAddConnectionProfile handler tests', () => {

	let serverTreeView: ServerTreeView;
	let mockTree: TypeMoq.Mock<ITree>;
	let mockRefreshTreeMethod: TypeMoq.Mock<Function>;
	let capabilitiesService = new TestCapabilitiesService();
	let newProfile;
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
		mockConnectionManagementService.setup(x => x.getConnectionGroups()).returns(x => []);
		mockConnectionManagementService.setup(x => x.hasRegisteredServers()).returns(() => true);
		serverTreeView = new ServerTreeView(mockConnectionManagementService.object, instantiationService, undefined, new TestThemeService(), undefined, undefined, capabilitiesService);
		mockTree = TypeMoq.Mock.ofType(TestTree);
		(serverTreeView as any)._tree = mockTree.object;
		mockRefreshTreeMethod = TypeMoq.Mock.ofType(Function);
		mockRefreshTreeMethod.setup(x => x()).returns(() => Promise.resolve());
		(serverTreeView as any).refreshTree = mockRefreshTreeMethod.object;
		mockTree.setup(x => x.clearSelection());
		mockTree.setup(x => x.select(TypeMoq.It.isAny()));
		newProfile = <IConnectionProfile>{
			id: 'test_connection'
		};
	});

	async function runAddConnectionProfileHandler(oldSelection, newProfile): Promise<void> {
		mockTree.setup(x => x.getSelection()).returns(() => [oldSelection] || []);
		return (serverTreeView as any).handleAddConnectionProfile(newProfile);
	}


	test('layout', async () => {
		mockTree.setup(x => x.layout(TypeMoq.It.isAnyNumber()));
		serverTreeView.layout(1);
		mockTree.verify(x => x.layout(TypeMoq.It.isAnyNumber()), TypeMoq.Times.once());
	});

	test('setVisibility', async () => {
		mockTree.setup(x => x.onVisible());
		mockTree.setup(x => x.onHidden());
		serverTreeView.setVisible(true);
		mockTree.verify(x => x.onVisible(), TypeMoq.Times.once());
		serverTreeView.setVisible(false);
		mockTree.verify(x => x.onHidden(), TypeMoq.Times.once());
	});

	test('getSelection', async () => {
		mockTree.setup(x => x.getSelection());

		serverTreeView.getSelection();
		mockTree.verify(x => x.getSelection(), TypeMoq.Times.once());
	});

	test('isFocused', async () => {
		mockTree.setup(x => x.isDOMFocused());
		serverTreeView.isFocused();
		mockTree.verify(x => x.isDOMFocused(), TypeMoq.Times.once());
	});

	test('reveal', async () => {
		mockTree.setup(x => x.reveal(TypeMoq.It.isAny()));
		serverTreeView.reveal(newProfile);
		mockTree.verify(x => x.reveal(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('isObjectExplorerConnectionUri', async () => {
		let connectionUriFalse = serverTreeView.isObjectExplorerConnectionUri('123');
		assert.equal(false, connectionUriFalse);
		assert.equal(true, serverTreeView.isObjectExplorerConnectionUri('connection:123'));
	});

	test('setExpandedState', async () => {
		mockTree.setup(x => x.collapse(TypeMoq.It.isAny()));
		mockTree.setup(x => x.expand(TypeMoq.It.isAny()));
		serverTreeView.setExpandedState(newProfile, TreeItemCollapsibleState.Collapsed);
		mockTree.verify(x => x.collapse(TypeMoq.It.isAny()), TypeMoq.Times.once());
		serverTreeView.setExpandedState(newProfile, TreeItemCollapsibleState.Expanded);
		mockTree.verify(x => x.expand(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('setSelected', async () => {
		mockTree.setup(x => x.reveal(TypeMoq.It.isAny()));
		mockTree.setup(x => x.deselect(TypeMoq.It.isAny()));
		serverTreeView.setSelected(newProfile, true, true);
		mockTree.verify(x => x.clearSelection(), TypeMoq.Times.once());
		mockTree.verify(x => x.select(TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockTree.verify(x => x.reveal(TypeMoq.It.isAny()), TypeMoq.Times.once());
		serverTreeView.setSelected(newProfile, false, false);
		mockTree.verify(x => x.deselect(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('isExpanded', async () => {
		mockTree.setup(x => x.isExpanded(TypeMoq.It.isAny()));
		serverTreeView.isExpanded(newProfile);
		mockTree.verify(x => x.isExpanded(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('refreshElement', async () => {
		mockTree.setup(x => x.refresh(TypeMoq.It.isAny()));
		serverTreeView.refreshElement(newProfile);
		mockTree.verify(x => x.refresh(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});



	test('onAddConnectionProfile handler selects the new profile when no profile is already selected', async () => {
		let newProfile = <IConnectionProfile>{
			id: 'test_connection'
		};
		await runAddConnectionProfileHandler(undefined, newProfile);
		mockRefreshTreeMethod.verify(x => x(), TypeMoq.Times.once());
		mockTree.verify(x => x.clearSelection(), TypeMoq.Times.never());
		mockTree.verify(x => x.select(TypeMoq.It.is(profile => profile === newProfile)), TypeMoq.Times.once());
	});

	test('onAddConnectionProfile handler selects the new profile when a different profile is already selected', async () => {
		let oldProfile = <IConnectionProfile>{
			id: 'old_connection'
		};
		let newProfile = <IConnectionProfile>{
			id: 'test_connection'
		};
		await runAddConnectionProfileHandler(oldProfile, newProfile);
		mockRefreshTreeMethod.verify(x => x(), TypeMoq.Times.once());
		mockTree.verify(x => x.clearSelection(), TypeMoq.Times.once());
		mockTree.verify(x => x.select(TypeMoq.It.is(profile => profile === newProfile)), TypeMoq.Times.once());
	});

	test('onAddConnectionProfile handler does not clear the selection when the new profile is already selected', async () => {
		let selectionId = 'test_connection';
		let oldProfile = <IConnectionProfile>{
			id: selectionId
		};
		let newProfile = <IConnectionProfile>{
			id: selectionId
		};
		await runAddConnectionProfileHandler(oldProfile, newProfile);
		mockRefreshTreeMethod.verify(x => x(), TypeMoq.Times.once());
		mockTree.verify(x => x.clearSelection(), TypeMoq.Times.never());
		mockTree.verify(x => x.select(TypeMoq.It.isAny()), TypeMoq.Times.never());
	});

	test('onAddConnectionProfile handler does not clear the previously selected profile if there is no new one', async () => {
		let oldProfile = <IConnectionProfile>{
			id: 'test_connection'
		};
		await runAddConnectionProfileHandler(oldProfile, undefined);
		mockRefreshTreeMethod.verify(x => x(), TypeMoq.Times.once());
		mockTree.verify(x => x.clearSelection(), TypeMoq.Times.never());
		mockTree.verify(x => x.select(TypeMoq.It.isAny()), TypeMoq.Times.never());
	});

	test('The tree refreshes when new capabilities are registered', () => {
		capabilitiesService.fireCapabilitiesRegistered(undefined, undefined);
		mockRefreshTreeMethod.verify(x => x(), TypeMoq.Times.once());
	});
});
