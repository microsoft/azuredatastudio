/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ServerTreeView } from 'sql/parts/objectExplorer/viewlet/serverTreeView';
import { ConnectionManagementService } from 'sql/platform/connection/common/connectionManagementService';

import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';

import * as TypeMoq from 'typemoq';

suite('ServerTreeView onAddConnectionProfile handler tests', () => {

	let serverTreeView: ServerTreeView;
	let mockTree: TypeMoq.Mock<Tree>;
	let mockRefreshTreeMethod: TypeMoq.Mock<Function>;

	setup(() => {
		let instantiationService = new TestInstantiationService();
		let mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict, {}, {});
		mockConnectionManagementService.setup(x => x.getConnectionGroups()).returns(x => []);
		serverTreeView = new ServerTreeView(mockConnectionManagementService.object, instantiationService, undefined, undefined, undefined, undefined);
		let tree = <Tree>{
			clearSelection() { },
			getSelection() { },
			select(selection) { },
			reveal(reveal) { }
		};
		mockTree = TypeMoq.Mock.ofInstance(tree);
		(serverTreeView as any)._tree = mockTree.object;
		mockRefreshTreeMethod = TypeMoq.Mock.ofType(Function);
		(serverTreeView as any).refreshTree = mockRefreshTreeMethod.object;
		mockTree.setup(x => x.clearSelection());
		mockTree.setup(x => x.select(TypeMoq.It.isAny()));
	});

	function runAddConnectionProfileHandler(oldSelection, newProfile) {
		mockTree.setup(x => x.getSelection()).returns(() => [oldSelection] || []);
		(serverTreeView as any).handleAddConnectionProfile(newProfile);
	}

	test('onAddConnectionProfile handler selects the new profile when no profile is already selected', () => {
		let newProfile = <IConnectionProfile>{
			id: 'test_connection'
		};
		runAddConnectionProfileHandler(undefined, newProfile);
		mockRefreshTreeMethod.verify(x => x(), TypeMoq.Times.once());
		mockTree.verify(x => x.clearSelection(), TypeMoq.Times.never());
		mockTree.verify(x => x.select(TypeMoq.It.is(profile => profile === newProfile)), TypeMoq.Times.once());
	});

	test('onAddConnectionProfile handler selects the new profile when a different profile is already selected', () => {
		let oldProfile = <IConnectionProfile>{
			id: 'old_connection'
		};
		let newProfile = <IConnectionProfile>{
			id: 'test_connection'
		};
		runAddConnectionProfileHandler(oldProfile, newProfile);
		mockRefreshTreeMethod.verify(x => x(), TypeMoq.Times.once());
		mockTree.verify(x => x.clearSelection(), TypeMoq.Times.once());
		mockTree.verify(x => x.select(TypeMoq.It.is(profile => profile === newProfile)), TypeMoq.Times.once());
	});

	test('onAddConnectionProfile handler does not clear the selection when the new profile is already selected', () => {
		let selectionId = 'test_connection';
		let oldProfile = <IConnectionProfile>{
			id: selectionId
		};
		let newProfile = <IConnectionProfile>{
			id: selectionId
		};
		runAddConnectionProfileHandler(oldProfile, newProfile);
		mockRefreshTreeMethod.verify(x => x(), TypeMoq.Times.once());
		mockTree.verify(x => x.clearSelection(), TypeMoq.Times.never());
		mockTree.verify(x => x.select(TypeMoq.It.isAny()), TypeMoq.Times.never());
	});

	test('onAddConnectionProfile handler does not clear the previously selected profile if there is no new one', () => {
		let oldProfile = <IConnectionProfile>{
			id: 'test_connection'
		};
		runAddConnectionProfileHandler(oldProfile, undefined);
		mockRefreshTreeMethod.verify(x => x(), TypeMoq.Times.once());
		mockTree.verify(x => x.clearSelection(), TypeMoq.Times.never());
		mockTree.verify(x => x.select(TypeMoq.It.isAny()), TypeMoq.Times.never());
	});
});