/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import { URI } from 'vs/base/common/uri';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';

import { ExtHostNotebook } from 'sql/workbench/api/node/extHostNotebook';
import { MainThreadNotebookShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as testUtils from '../../utils/testUtils';
import { INotebookManagerDetails } from 'sql/workbench/api/common/sqlExtHostTypes';

suite('ExtHostNotebook Tests', () => {

	let extHostNotebook: ExtHostNotebook;
	let mockProxy: TypeMoq.Mock<MainThreadNotebookShape>;
	let notebookUri: URI;
	let notebookProviderMock: TypeMoq.Mock<NotebookProviderStub>;
	setup(() => {
		mockProxy = TypeMoq.Mock.ofInstance(<MainThreadNotebookShape> {
			$registerNotebookProvider: (providerId, handle) => undefined,
			$unregisterNotebookProvider: (handle) => undefined,
			dispose: () => undefined
		});
		let mainContext = <IMainContext>{
			getProxy: proxyType => mockProxy.object
		};
		extHostNotebook = new ExtHostNotebook(mainContext);
		notebookUri = URI.parse('file:/user/default/my.ipynb');
		notebookProviderMock = TypeMoq.Mock.ofType(NotebookProviderStub, TypeMoq.MockBehavior.Loose);
		notebookProviderMock.callBase = true;
	});

	suite('getNotebookManager', () => {
		test('Should throw if no matching provider is defined', async () => {
			await testUtils.assertThrowsAsync(() => extHostNotebook.$getNotebookManager(-1, notebookUri));
		});
		suite('with provider', () => {
			let providerHandle: number = -1;

			setup(() => {
				mockProxy.setup(p =>
					p.$registerNotebookProvider(TypeMoq.It.isValue(notebookProviderMock.object.providerId), TypeMoq.It.isAnyNumber()))
					.returns((providerId, handle) => {
						providerHandle = handle;
						return undefined;
					});

				// Register the provider so we can test behavior with this present
				extHostNotebook.registerNotebookProvider(notebookProviderMock.object);
			});

			test('Should return a notebook manager with correct info on content and server manager existence', async () => {
				// Given the provider returns a manager with no
				let expectedManager = new NotebookManagerStub();
				notebookProviderMock.setup(p => p.getNotebookManager(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedManager));

				// When I call through using the handle provided during registration
				let managerDetails: INotebookManagerDetails = await extHostNotebook.$getNotebookManager(providerHandle, notebookUri);

				// Then I expect the same manager to be returned
				assert.ok(managerDetails.hasContentManager === false, 'Expect no content manager defined');
				assert.ok(managerDetails.hasServerManager === false, 'Expect no server manager defined');
				assert.ok(managerDetails.handle > 0, 'Expect a valid handle defined');
			});

			test('Should have a unique handle for each notebook URI', async () => {
				// Given the we request 2 URIs
				let expectedManager = new NotebookManagerStub();
				notebookProviderMock.setup(p => p.getNotebookManager(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedManager));

				// When I call through using the handle provided during registration
				let originalManagerDetails = await extHostNotebook.$getNotebookManager(providerHandle, notebookUri);
				let differentDetails = await extHostNotebook.$getNotebookManager(providerHandle, URI.parse('file://other/file.ipynb'));
				let sameDetails = await extHostNotebook.$getNotebookManager(providerHandle, notebookUri);

				// Then I expect the 2 different handles in the managers returned.
				// This is because we can't easily track identity of the managers, so just track which one is assigned to
				// a notebook by the handle ID
				assert.notEqual(originalManagerDetails.handle, differentDetails.handle, 'Should have unique handle for each manager');
				assert.equal(originalManagerDetails.handle, sameDetails.handle, 'Should have same handle when same URI is passed in');

			});
		});
	});

	suite('registerNotebookProvider', () => {
		let savedHandle: number = -1;
		setup(() => {
			mockProxy.setup(p =>
				p.$registerNotebookProvider(TypeMoq.It.isValue(notebookProviderMock.object.providerId), TypeMoq.It.isAnyNumber()))
				.returns((providerId, handle) => {
					savedHandle = handle;
					return undefined;
				});
		});

		test('Should register with a new handle to the proxy', () => {
			extHostNotebook.registerNotebookProvider(notebookProviderMock.object);
			mockProxy.verify(p =>
				p.$registerNotebookProvider(TypeMoq.It.isValue(notebookProviderMock.object.providerId),
				TypeMoq.It.isAnyNumber()), TypeMoq.Times.once());
				// It shouldn't unregister until requested
				mockProxy.verify(p => p.$unregisterNotebookProvider(TypeMoq.It.isValue(savedHandle)), TypeMoq.Times.never());

		});

		test('Should call unregister on disposing', () => {
			let disposable = extHostNotebook.registerNotebookProvider(notebookProviderMock.object);
			disposable.dispose();
			mockProxy.verify(p => p.$unregisterNotebookProvider(TypeMoq.It.isValue(savedHandle)), TypeMoq.Times.once());
		});
	});
});

class NotebookProviderStub implements sqlops.nb.NotebookProvider {
	providerId: string = 'TestProvider';
	standardKernels: sqlops.nb.IStandardKernel[] = [{name: 'fakeKernel', connectionProviderIds: ['MSSQL']}];

	getNotebookManager(notebookUri: vscode.Uri): Thenable<sqlops.nb.NotebookManager> {
		throw new Error('Method not implemented.');
	}
	handleNotebookClosed(notebookUri: vscode.Uri): void {
		throw new Error('Method not implemented.');
	}
}

class NotebookManagerStub implements sqlops.nb.NotebookManager {
	get contentManager(): sqlops.nb.ContentManager {
		return undefined;
	}

	get sessionManager(): sqlops.nb.SessionManager {
		return undefined;
	}

	get serverManager(): sqlops.nb.ServerManager {
		return undefined;
	}
}