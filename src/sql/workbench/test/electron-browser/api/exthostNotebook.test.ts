/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import { URI } from 'vs/base/common/uri';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';

import { ExtHostNotebook } from 'sql/workbench/api/common/extHostNotebook';
import { MainThreadNotebookShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExecuteManagerDetails, ISerializationManagerDetails } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';

suite('ExtHostNotebook Tests', () => {

	let extHostNotebook: ExtHostNotebook;
	let mockProxy: TypeMoq.Mock<MainThreadNotebookShape>;
	let notebookUri: URI;
	let serializationProviderMock: TypeMoq.Mock<SerializationProviderStub>;
	let executeProviderMock: TypeMoq.Mock<ExecuteProviderStub>;
	setup(() => {
		mockProxy = TypeMoq.Mock.ofInstance(<MainThreadNotebookShape>{
			$registerSerializationProvider: (providerId, handle) => undefined,
			$registerExecuteProvider: (providerId, handle) => undefined,
			$unregisterSerializationProvider: (handle) => undefined,
			$unregisterExecuteProvider: (handle) => undefined,
			$createNotebookController: (extension, id, viewType, label, handler, rendererScripts) => undefined,
			dispose: () => undefined
		});
		let mainContext = <IMainContext>{
			getProxy: proxyType => mockProxy.object
		};
		extHostNotebook = new ExtHostNotebook(mainContext);
		notebookUri = URI.parse('file:/user/default/my.ipynb');
		serializationProviderMock = TypeMoq.Mock.ofType(SerializationProviderStub, TypeMoq.MockBehavior.Loose);
		serializationProviderMock.callBase = true;
		executeProviderMock = TypeMoq.Mock.ofType(ExecuteProviderStub, TypeMoq.MockBehavior.Loose);
		executeProviderMock.callBase = true;
	});

	suite('get notebook managers', () => {
		test('Should throw if no matching serialization provider is defined', async () => {
			try {
				await extHostNotebook.$getSerializationManagerDetails(-1, notebookUri);
				assert.fail('expected to throw');
			} catch (e) { }
		});
		test('Should throw if no matching execute provider is defined', async () => {
			try {
				await extHostNotebook.$getExecuteManagerDetails(-1, notebookUri);
				assert.fail('expected to throw');
			} catch (e) { }
		});
		suite('with provider', () => {
			let serializationProviderHandle: number = -1;
			let executeProviderHandle: number = -1;

			setup(() => {
				mockProxy.setup(p =>
					p.$registerSerializationProvider(TypeMoq.It.isValue(serializationProviderMock.object.providerId), TypeMoq.It.isAnyNumber()))
					.returns((providerId, handle) => {
						serializationProviderHandle = handle;
						return undefined;
					});
				mockProxy.setup(p =>
					p.$registerExecuteProvider(TypeMoq.It.isValue(executeProviderMock.object.providerId), TypeMoq.It.isAnyNumber()))
					.returns((providerId, handle) => {
						executeProviderHandle = handle;
						return undefined;
					});

				// Register the provider so we can test behavior with this present
				extHostNotebook.registerSerializationProvider(serializationProviderMock.object);
				extHostNotebook.registerExecuteProvider(executeProviderMock.object);
			});

			test('Should return a serialization manager with correct info on content manager existence', async () => {
				// Given the provider returns a manager with no
				let expectedManager = new SerializationManagerStub();
				serializationProviderMock.setup(p => p.getSerializationManager(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedManager));

				// When I call through using the handle provided during registration
				let managerDetails: ISerializationManagerDetails = await extHostNotebook.$getSerializationManagerDetails(serializationProviderHandle, notebookUri);

				// Then I expect the same manager to be returned
				assert.ok(managerDetails.hasContentManager === false, 'Expect no content manager defined');
				assert.ok(managerDetails.handle > 0, 'Expect a valid handle defined');
			});

			test('Should return an execute manager with correct info on whether server manager exists', async () => {
				// An execute manager with no server manager
				let expectedManager = new ExecuteManagerStub();
				executeProviderMock.setup(p => p.getExecuteManager(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedManager));

				// When I call through using the handle provided during registration
				let managerDetails: IExecuteManagerDetails = await extHostNotebook.$getExecuteManagerDetails(executeProviderHandle, notebookUri);

				// Then I expect the same manager to be returned
				assert.ok(managerDetails.hasServerManager === false, 'Expect no server manager defined');
				assert.ok(managerDetails.handle > 0, 'Expect a valid handle defined');
			});

			test('Should have a unique serialization provider handle for each notebook URI', async () => {
				// Given the we request 2 URIs
				let expectedManager = new SerializationManagerStub();
				serializationProviderMock.setup(p => p.getSerializationManager(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedManager));

				// When I call through using the handle provided during registration
				let originalManagerDetails = await extHostNotebook.$getSerializationManagerDetails(serializationProviderHandle, notebookUri);
				let differentDetails = await extHostNotebook.$getSerializationManagerDetails(serializationProviderHandle, URI.parse('file://other/file.ipynb'));
				let sameDetails = await extHostNotebook.$getSerializationManagerDetails(serializationProviderHandle, notebookUri);

				// Then I expect the 2 different handles in the managers returned.
				// This is because we can't easily track identity of the managers, so just track which one is assigned to
				// a notebook by the handle ID
				assert.notStrictEqual(originalManagerDetails.handle, differentDetails.handle, 'Should have unique handle for each manager');
				assert.strictEqual(originalManagerDetails.handle, sameDetails.handle, 'Should have same handle when same URI is passed in');
			});

			test('Should have a unique execute provider handle for each notebook URI', async () => {
				// Given the we request 2 URIs
				let expectedManager = new ExecuteManagerStub();
				executeProviderMock.setup(p => p.getExecuteManager(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedManager));

				// When I call through using the handle provided during registration
				let originalManagerDetails = await extHostNotebook.$getExecuteManagerDetails(executeProviderHandle, notebookUri);
				let differentDetails = await extHostNotebook.$getExecuteManagerDetails(executeProviderHandle, URI.parse('file://other/file.ipynb'));
				let sameDetails = await extHostNotebook.$getExecuteManagerDetails(executeProviderHandle, notebookUri);

				// Then I expect the 2 different handles in the managers returned.
				// This is because we can't easily track identity of the managers, so just track which one is assigned to
				// a notebook by the handle ID
				assert.notStrictEqual(originalManagerDetails.handle, differentDetails.handle, 'Should have unique handle for each manager');
				assert.strictEqual(originalManagerDetails.handle, sameDetails.handle, 'Should have same handle when same URI is passed in');
			});
		});
	});

	suite('registerSerializationProvider', () => {
		let savedHandle: number = -1;
		setup(() => {
			mockProxy.setup(p =>
				p.$registerSerializationProvider(TypeMoq.It.isValue(serializationProviderMock.object.providerId), TypeMoq.It.isAnyNumber()))
				.returns((providerId, handle) => {
					savedHandle = handle;
					return undefined;
				});
		});

		test('Should register with a new handle to the proxy', () => {
			extHostNotebook.registerSerializationProvider(serializationProviderMock.object);
			mockProxy.verify(p =>
				p.$registerSerializationProvider(TypeMoq.It.isValue(serializationProviderMock.object.providerId),
					TypeMoq.It.isAnyNumber()), TypeMoq.Times.once());
			// It shouldn't unregister until requested
			mockProxy.verify(p => p.$unregisterSerializationProvider(TypeMoq.It.isValue(savedHandle)), TypeMoq.Times.never());
		});

		test('Should not call unregister on disposing', () => {
			let disposable = extHostNotebook.registerSerializationProvider(serializationProviderMock.object);
			disposable.dispose();
			mockProxy.verify(p => p.$unregisterSerializationProvider(TypeMoq.It.isValue(savedHandle)), TypeMoq.Times.never());
		});
	});

	suite('registerExecuteProvider', () => {
		let savedHandle: number = -1;
		setup(() => {
			mockProxy.setup(p =>
				p.$registerExecuteProvider(TypeMoq.It.isValue(executeProviderMock.object.providerId), TypeMoq.It.isAnyNumber()))
				.returns((providerId, handle) => {
					savedHandle = handle;
					return undefined;
				});
		});

		test('Should register with a new handle to the proxy', () => {
			extHostNotebook.registerExecuteProvider(executeProviderMock.object);
			mockProxy.verify(p =>
				p.$registerExecuteProvider(TypeMoq.It.isValue(executeProviderMock.object.providerId),
					TypeMoq.It.isAnyNumber()), TypeMoq.Times.once());
			// It shouldn't unregister until requested
			mockProxy.verify(p => p.$unregisterExecuteProvider(TypeMoq.It.isValue(savedHandle)), TypeMoq.Times.never());
		});

		test('Should not call unregister on disposing', () => {
			let disposable = extHostNotebook.registerExecuteProvider(executeProviderMock.object);
			disposable.dispose();
			mockProxy.verify(p => p.$unregisterExecuteProvider(TypeMoq.It.isValue(savedHandle)), TypeMoq.Times.never());
		});
	});

	suite('VSCode API Compatibility', () => {
		const providerId = 'testProvider';
		setup(() => {
			mockProxy.setup(p =>
				p.$createNotebookController(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isValue(providerId), TypeMoq.It.isAny()))
				.returns(() => new NotebookControllerStub(providerId));
		});

		test('Should register a serialization provider when calling registerNotebookSerializer', () => {
			let serializerMock = TypeMoq.Mock.ofType(NotebookSerializerStub);
			extHostNotebook.$registerNotebookSerializer(providerId, serializerMock.object);
			mockProxy.verify(p =>
				p.$registerSerializationProvider(TypeMoq.It.isValue(providerId), TypeMoq.It.isAny()), TypeMoq.Times.once());
		});

		test('Should register an execute provider when calling createNotebookController', () => {
			let extensionDescription: IExtensionDescription = {
				name: 'TestExtension',
				publisher: 'TestPublisher',
				version: '0.0.1',
				engines: { vscode: '1000', azdata: '900' },
				identifier: undefined,
				isBuiltin: true,
				isUserBuiltin: true,
				isUnderDevelopment: true,
				extensionLocation: undefined
			};
			let controller = extHostNotebook.$createNotebookController(extensionDescription, 'testControllerId', providerId, 'testLabel');
			assert(controller, 'Notebook Controller should not be undefined.');
			mockProxy.verify(p =>
				p.$createNotebookController(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isValue(providerId), TypeMoq.It.isAny()), TypeMoq.Times.once());
			mockProxy.verify(p =>
				p.$registerExecuteProvider(TypeMoq.It.isValue(providerId), TypeMoq.It.isAny()), TypeMoq.Times.once());
		});
	});
});

class SerializationProviderStub implements azdata.nb.NotebookSerializationProvider {
	providerId: string = 'TestProvider';

	getSerializationManager(notebookUri: vscode.Uri): Thenable<azdata.nb.SerializationManager> {
		throw new Error('Method not implemented.');
	}
}

class ExecuteProviderStub implements azdata.nb.NotebookExecuteProvider {
	providerId: string = 'TestProvider';

	getExecuteManager(notebookUri: vscode.Uri): Thenable<azdata.nb.ExecuteManager> {
		throw new Error('Method not implemented.');
	}
	handleNotebookClosed(notebookUri: vscode.Uri): void {
		throw new Error('Method not implemented.');
	}
}

class SerializationManagerStub implements azdata.nb.SerializationManager {
	get contentManager(): azdata.nb.ContentManager {
		return undefined;
	}
}

class ExecuteManagerStub implements azdata.nb.ExecuteManager {
	get sessionManager(): azdata.nb.SessionManager {
		return undefined;
	}

	get serverManager(): azdata.nb.ServerManager {
		return undefined;
	}
}

class NotebookSerializerStub implements vscode.NotebookSerializer {
	deserializeNotebook(content: Uint8Array, token: vscode.CancellationToken): vscode.NotebookData | Thenable<vscode.NotebookData> {
		throw new Error('Method not implemented.');
	}
	serializeNotebook(data: vscode.NotebookData, token: vscode.CancellationToken): Uint8Array | Thenable<Uint8Array> {
		throw new Error('Method not implemented.');
	}
}

class NotebookControllerStub implements vscode.NotebookController {
	constructor(providerId: string) {
		this.notebookType = providerId;
	}

	id: string;
	notebookType: string;
	supportedLanguages?: string[];
	label: string;
	description?: string;
	detail?: string;
	supportsExecutionOrder?: boolean;
	createNotebookCellExecution(cell: vscode.NotebookCell): vscode.NotebookCellExecution {
		throw new Error('Method not implemented.');
	}
	executeHandler: (cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) => void | Thenable<void>;
	interruptHandler?: (notebook: vscode.NotebookDocument) => void | Thenable<void>;
	onDidChangeSelectedNotebooks: vscode.Event<{ notebook: vscode.NotebookDocument; selected: boolean; }>;
	updateNotebookAffinity(notebook: vscode.NotebookDocument, affinity: vscode.NotebookControllerAffinity): void {
		throw new Error('Method not implemented.');
	}
	dispose(): void {
		throw new Error('Method not implemented.');
	}
	rendererScripts: vscode.NotebookRendererScript[];
	onDidReceiveMessage: vscode.Event<{ editor: vscode.NotebookEditor; message: any; }>;
	postMessage(message: any, editor?: vscode.NotebookEditor): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}
	asWebviewUri(localResource: vscode.Uri): vscode.Uri {
		throw new Error('Method not implemented.');
	}

}
