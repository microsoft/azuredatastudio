/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import URI from 'vs/base/common/uri';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';

import { ExtHostNotebookShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { MainThreadNotebook } from 'sql/workbench/api/node/mainThreadNotebook';
import { NotebookService } from 'sql/services/notebook/notebookServiceImpl';
import { INotebookProvider } from 'sql/services/notebook/notebookService';
import { INotebookManagerDetails } from 'sql/workbench/api/common/sqlExtHostTypes';
import { LocalContentManager } from 'sql/services/notebook/localContentManager';


suite('MainThreadNotebook Tests', () => {

	let mainThreadNotebook: MainThreadNotebook;
	let mockProxy: TypeMoq.Mock<ExtHostNotebookShape>;
	let notebookUri: URI;
	let mockNotebookService: TypeMoq.Mock<NotebookService>;
	let providerId = 'TestProvider';
	setup(() => {
		mockProxy = TypeMoq.Mock.ofInstance(<ExtHostNotebookShape> {
			$getNotebookManager: (handle, uri) => undefined,
			$handleNotebookClosed: (uri) => undefined,
			$getNotebookContents: (handle, uri) => undefined,
			$save: (handle, uri, notebook) => undefined,
			$doStartServer: (handle) => undefined,
			$doStopServer: (handle) => undefined
		});
		let extContext = <IExtHostContext>{
			getProxy: proxyType => mockProxy.object
		};
		mockNotebookService = TypeMoq.Mock.ofType(NotebookService);
		notebookUri = URI.parse('file:/user/default/my.ipynb');
		mainThreadNotebook = new MainThreadNotebook(extContext, mockNotebookService.object);
	});

	suite('On registering a provider', () => {
		let provider: INotebookProvider;
		let registeredProviderId: string;
		setup(() => {
			mockNotebookService.setup(s => s.registerProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((id, providerImpl) => {
				registeredProviderId = id;
				provider = providerImpl;
			});
		});

		test('should call through to notebook service', () => {
			// When I register a provider
			mainThreadNotebook.$registerNotebookProvider(providerId, 1);
			// Then I expect a provider implementation to be passed to the service
			mockNotebookService.verify(s => s.registerProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			assert.equal(provider.providerId, providerId);
		});
		test('should unregister in service', () => {
			// Given we have a provider
			mainThreadNotebook.$registerNotebookProvider(providerId, 1);
			// When I unregister a provider twice
			mainThreadNotebook.$unregisterNotebookProvider(1);
			mainThreadNotebook.$unregisterNotebookProvider(1);
			// Then I expect it to be unregistered in the service just 1 time
			mockNotebookService.verify(s => s.unregisterProvider(TypeMoq.It.isValue(providerId)), TypeMoq.Times.once());
		});
	});

	suite('getNotebookManager', () => {
		let managerWithAllFeatures: INotebookManagerDetails;
		let provider: INotebookProvider;

		setup(() => {
			managerWithAllFeatures = {
				handle: 2,
				hasContentManager: true,
				hasServerManager: true
			};
			mockNotebookService.setup(s => s.registerProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((id, providerImpl) => {
				provider = providerImpl;
			});
			mainThreadNotebook.$registerNotebookProvider(providerId, 1);

		});

		test('should return manager with default content manager & undefined server manager if extension host has none', async () => {
			// Given the extension provider doesn't have acontent or server manager
			let details: INotebookManagerDetails = {
				handle: 2,
				hasContentManager: false,
				hasServerManager: false
			};
			mockProxy.setup(p => p.$getNotebookManager(TypeMoq.It.isAnyNumber(), TypeMoq.It.isValue(notebookUri)))
			.returns(() => Promise.resolve(details));

			// When I get the notebook manager
			let manager = await provider.getNotebookManager(notebookUri);

			// Then it should use the built-in content manager
			assert.ok(manager.contentManager instanceof LocalContentManager);
			// And it should not define a server manager
			assert.equal(manager.serverManager, undefined);
		});

		test('should return manager with a content & server manager if extension host has these', async () => {
			// Given the extension provider doesn't have acontent or server manager
			mockProxy.setup(p => p.$getNotebookManager(TypeMoq.It.isAnyNumber(), TypeMoq.It.isValue(notebookUri)))
			.returns(() => Promise.resolve(managerWithAllFeatures));

			// When I get the notebook manager
			let manager = await provider.getNotebookManager(notebookUri);

			// Then it shouldn't have wrappers for the content or server manager
			assert.ok(!(manager.contentManager instanceof LocalContentManager));
			assert.notEqual(manager.serverManager, undefined);
		});
	});

});