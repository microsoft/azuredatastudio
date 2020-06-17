/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { TestLifecycleService, TestFileService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestStorageService, TestExtensionService } from 'vs/workbench/test/common/workbenchTestServices';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IExtensionManagementService, InstallExtensionEvent, DidInstallExtensionEvent, IExtensionIdentifier, DidUninstallExtensionEvent } from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/extensionManagementService';
import { NullLogService } from 'vs/platform/log/common/log';
import { NBTestQueryManagementService } from 'sql/workbench/contrib/notebook/test/nbTestQueryManagementService';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { Emitter } from 'vs/base/common/event';
import { Registry } from 'vs/platform/registry/common/platform';
import { NotebookProviderRegistration, INotebookProviderRegistry, Extensions } from 'sql/workbench/services/notebook/common/notebookRegistry';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';

suite('Notebook Service Tests', function (): void {
	let notebookService: INotebookService;

	let installEvent: Emitter<InstallExtensionEvent>,
		didInstallEvent: Emitter<DidInstallExtensionEvent>,
		uninstallEvent: Emitter<IExtensionIdentifier>,
		didUninstallEvent: Emitter<DidUninstallExtensionEvent>;

	setup(() => {
		const lifecycleService = new TestLifecycleService();
		const storageService = new TestStorageService();
		const extensionService = new TestExtensionService();
		const fileService = new TestFileService();
		const logService = new NullLogService();
		const contextService = new MockContextKeyService();
		const queryManagementService = new NBTestQueryManagementService();

		const instantiationService = new TestInstantiationService();

		installEvent = new Emitter<InstallExtensionEvent>();
		didInstallEvent = new Emitter<DidInstallExtensionEvent>();
		uninstallEvent = new Emitter<IExtensionIdentifier>();
		didUninstallEvent = new Emitter<DidUninstallExtensionEvent>();

		instantiationService.stub(IExtensionManagementService, ExtensionManagementService);
		instantiationService.stub(IExtensionManagementService, 'onInstallExtension', installEvent.event);
		instantiationService.stub(IExtensionManagementService, 'onDidInstallExtension', didInstallEvent.event);
		instantiationService.stub(IExtensionManagementService, 'onUninstallExtension', uninstallEvent.event);
		instantiationService.stub(IExtensionManagementService, 'onDidUninstallExtension', didUninstallEvent.event);
		const extensionManagementService = instantiationService.get(IExtensionManagementService);

		notebookService = new NotebookService(lifecycleService, storageService, extensionService, extensionManagementService, instantiationService, fileService, logService, queryManagementService, contextService);
	});

	test('Validate default properties on create', async function (): Promise<void> {
		assert.equal(notebookService.languageMagics.length, 0, 'No language magics should exist after creation');
		assert.equal(notebookService.listNotebookEditors().length, 0, 'No notebook editors should be listed');
		assert.equal(notebookService.getMimeRegistry().mimeTypes.length, 15, 'MIME Types need to have appropriate tests when added or removed');
		assert.deepEqual(notebookService.getProvidersForFileType('ipynb'), ['sql'], 'sql provider should be registered for ipynb extension');
		assert.equal(notebookService.getStandardKernelsForProvider('sql').length, 1, 'SQL kernel should be provided by default');
		assert.equal(notebookService.getStandardKernelsForProvider('otherProvider'), undefined, 'Other provider should not have kernels since it has not been added as a provider');
		assert.deepEqual(notebookService.getSupportedFileExtensions(), ['IPYNB'], 'IPYNB file extension should be supported by default');
	});

	test('Validate another provider added successfully', async function (): Promise<void> {
		await notebookService.registrationComplete;
		assert.equal(notebookService.isRegistrationComplete, true, 'Registration should be complete since sql provider exists in queryManagementService');
		assert.deepEqual(notebookService.getProvidersForFileType('ipynb'), ['sql'], 'sql provider should be registered for ipynb extension');

		const otherProviderRegistration: NotebookProviderRegistration = {
			fileExtensions: 'ipynb',
			standardKernels: {
				name: 'kernel1',
				connectionProviderIds: [],
				displayName: 'Kernel 1'
			},
			provider: 'otherProvider'
		};

		const notebookRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookProviderContribution);
		notebookRegistry.registerNotebookProvider(otherProviderRegistration);

		assert.deepEqual(notebookService.getProvidersForFileType('ipynb'), ['sql', 'otherProvider'], 'otherProvider should also be registered for ipynb extension');
		assert.deepEqual(notebookService.getSupportedFileExtensions(), ['IPYNB'], 'Only IPYNB should be registered as supported file extension');
		assert.equal(notebookService.getStandardKernelsForProvider('otherProvider').length, 1, 'otherProvider kernel info could not be found');
		assert.deepEqual(notebookService.getStandardKernelsForProvider('otherProvider')[0], otherProviderRegistration.standardKernels, 'otherProviderRegistration standard kernels does not match');
	});
});
