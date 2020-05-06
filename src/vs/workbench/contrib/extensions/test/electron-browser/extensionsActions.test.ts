/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { assign } from 'vs/base/common/objects';
import { generateUuid } from 'vs/base/common/uuid';
import { IExtensionsWorkbenchService, ExtensionContainers } from 'vs/workbench/contrib/extensions/common/extensions';
import * as ExtensionsActions from 'vs/workbench/contrib/extensions/browser/extensionsActions';
import { ExtensionsWorkbenchService } from 'vs/workbench/contrib/extensions/browser/extensionsWorkbenchService';
import {
	IExtensionManagementService, IExtensionGalleryService, ILocalExtension, IGalleryExtension,
	DidInstallExtensionEvent, DidUninstallExtensionEvent, InstallExtensionEvent, IExtensionIdentifier, InstallOperation, IExtensionTipsService
} from 'vs/platform/extensionManagement/common/extensionManagement';
import { IWorkbenchExtensionEnablementService, EnablementState, IExtensionManagementServerService, IExtensionManagementServer, IExtensionRecommendationsService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { getGalleryExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { ExtensionManagementService } from 'vs/platform/extensionManagement/node/extensionManagementService';
import { TestExtensionEnablementService } from 'vs/workbench/services/extensionManagement/test/browser/extensionEnablementService.test';
import { ExtensionGalleryService } from 'vs/platform/extensionManagement/common/extensionGalleryService';
import { IURLService } from 'vs/platform/url/common/url';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { Emitter, Event } from 'vs/base/common/event';
import { IPager } from 'vs/base/common/paging';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { TestContextService } from 'vs/workbench/test/common/workbenchTestServices';
import { TestSharedProcessService } from 'vs/workbench/test/electron-browser/workbenchTestServices';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { URLService } from 'vs/platform/url/node/urlService';
import { URI } from 'vs/base/common/uri';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { RemoteAgentService } from 'vs/workbench/services/remote/electron-browser/remoteAgentServiceImpl';
import { ExtensionIdentifier, IExtensionContributions, ExtensionType, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { ISharedProcessService } from 'vs/platform/ipc/electron-browser/sharedProcessService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ILabelService, IFormatterChangeEvent } from 'vs/platform/label/common/label';
import { ExtensionManagementServerService } from 'vs/workbench/services/extensionManagement/electron-browser/extensionManagementServerService';
import { IProductService } from 'vs/platform/product/common/productService';
import { Schemas } from 'vs/base/common/network';
import { REMOTE_HOST_SCHEME } from 'vs/platform/remote/common/remoteHosts';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { ProgressService } from 'vs/workbench/services/progress/browser/progressService';
import { IStorageKeysSyncRegistryService, StorageKeysSyncRegistryService } from 'vs/platform/userDataSync/common/storageKeys';
import { TestExperimentService } from 'vs/workbench/contrib/experiments/test/electron-browser/experimentService.test';
import { IExperimentService } from 'vs/workbench/contrib/experiments/common/experimentService';
import { ExtensionTipsService } from 'vs/platform/extensionManagement/node/extensionTipsService';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { TestLifecycleService } from 'vs/workbench/test/browser/workbenchTestServices';
import { DisposableStore } from 'vs/base/common/lifecycle';

let instantiationService: TestInstantiationService;
let installEvent: Emitter<InstallExtensionEvent>,
	didInstallEvent: Emitter<DidInstallExtensionEvent>,
	uninstallEvent: Emitter<IExtensionIdentifier>,
	didUninstallEvent: Emitter<DidUninstallExtensionEvent>;

let disposables: DisposableStore;

async function setupTest() {
	disposables = new DisposableStore();
	installEvent = new Emitter<InstallExtensionEvent>();
	didInstallEvent = new Emitter<DidInstallExtensionEvent>();
	uninstallEvent = new Emitter<IExtensionIdentifier>();
	didUninstallEvent = new Emitter<DidUninstallExtensionEvent>();

	instantiationService = new TestInstantiationService();
	instantiationService.stub(ITelemetryService, NullTelemetryService);
	instantiationService.stub(ILogService, NullLogService);

	instantiationService.stub(IWorkspaceContextService, new TestContextService());
	instantiationService.stub(IConfigurationService, new TestConfigurationService());
	instantiationService.stub(IProgressService, ProgressService);
	instantiationService.stub(IStorageKeysSyncRegistryService, new StorageKeysSyncRegistryService());
	instantiationService.stub(IProductService, {});

	instantiationService.stub(IExtensionGalleryService, ExtensionGalleryService);
	instantiationService.stub(ISharedProcessService, TestSharedProcessService);

	instantiationService.stub(IExtensionManagementService, ExtensionManagementService);
	instantiationService.stub(IExtensionManagementService, 'onInstallExtension', installEvent.event);
	instantiationService.stub(IExtensionManagementService, 'onDidInstallExtension', didInstallEvent.event);
	instantiationService.stub(IExtensionManagementService, 'onUninstallExtension', uninstallEvent.event);
	instantiationService.stub(IExtensionManagementService, 'onDidUninstallExtension', didUninstallEvent.event);
	instantiationService.stub(IRemoteAgentService, RemoteAgentService);

	instantiationService.stub(IExtensionManagementServerService, new class extends ExtensionManagementServerService {
		private _localExtensionManagementServer: IExtensionManagementServer = { extensionManagementService: instantiationService.get(IExtensionManagementService), label: 'local', authority: 'vscode-local' };
		constructor() {
			super(instantiationService.get(ISharedProcessService), instantiationService.get(IRemoteAgentService), instantiationService.get(IExtensionGalleryService), instantiationService.get(IConfigurationService), instantiationService.get(IProductService), instantiationService.get(ILogService), instantiationService.get(ILabelService));
		}
		get localExtensionManagementServer(): IExtensionManagementServer { return this._localExtensionManagementServer; }
		set localExtensionManagementServer(server: IExtensionManagementServer) { }
	}());

	instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
	instantiationService.stub(ILabelService, { onDidChangeFormatters: new Emitter<IFormatterChangeEvent>().event });

	instantiationService.stub(ILifecycleService, new TestLifecycleService());
	instantiationService.stub(IExperimentService, instantiationService.createInstance(TestExperimentService));
	instantiationService.stub(IExtensionTipsService, instantiationService.createInstance(ExtensionTipsService));
	instantiationService.stub(IExtensionRecommendationsService, {});
	instantiationService.stub(IURLService, URLService);

	instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', []);
	instantiationService.stubPromise(IExtensionManagementService, 'getExtensionsReport', []);
	instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage());
	instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{ getExtensions: () => Promise.resolve([]), onDidChangeExtensions: new Emitter<void>().event, canAddExtension: (extension: IExtensionDescription) => false, canRemoveExtension: (extension: IExtensionDescription) => false });
	(<TestExtensionEnablementService>instantiationService.get(IWorkbenchExtensionEnablementService)).reset();

	instantiationService.set(IExtensionsWorkbenchService, disposables.add(instantiationService.createInstance(ExtensionsWorkbenchService)));
}


suite('ExtensionsActions Test', () => {

	setup(setupTest);
	teardown(() => disposables.dispose());

	test('Install action is disabled when there is no extension', () => {
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.InstallAction);

		assert.ok(!testObject.enabled);
	});

	test('Test Install action when state is installed', () => {
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.InstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		return workbenchService.queryLocal()
			.then(() => {
				instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: local.identifier })));
				return workbenchService.queryGallery(CancellationToken.None)
					.then((paged) => {
						testObject.extension = paged.firstPage[0];
						assert.ok(!testObject.enabled);
						assert.equal('Install', testObject.label);
						assert.equal('extension-action label prominent install', testObject.class);
					});
			});
	});

	test('Test Install action when state is installing', () => {
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.InstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		return workbenchService.queryGallery(CancellationToken.None)
			.then((paged) => {
				testObject.extension = paged.firstPage[0];
				installEvent.fire({ identifier: gallery.identifier, gallery });

				assert.ok(!testObject.enabled);
				assert.equal('Installing', testObject.label);
				assert.equal('extension-action label install installing', testObject.class);
			});
	});

	test('Test Install action when state is uninstalled', () => {
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.InstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		return workbenchService.queryGallery(CancellationToken.None)
			.then((paged) => {
				testObject.extension = paged.firstPage[0];
				assert.ok(testObject.enabled);
				assert.equal('Install', testObject.label);
			});
	});

	test('Test Install action when extension is system action', () => {
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.InstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', {}, { type: ExtensionType.System });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				uninstallEvent.fire(local.identifier);
				didUninstallEvent.fire({ identifier: local.identifier });
				testObject.extension = extensions[0];
				assert.ok(!testObject.enabled);
			});
	});

	test('Test Install action when extension doesnot has gallery', () => {
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.InstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				uninstallEvent.fire(local.identifier);
				didUninstallEvent.fire({ identifier: local.identifier });
				testObject.extension = extensions[0];
				assert.ok(!testObject.enabled);
			});
	});

	test('Uninstall action is disabled when there is no extension', () => {
		const testObject: ExtensionsActions.UninstallAction = instantiationService.createInstance(ExtensionsActions.UninstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		assert.ok(!testObject.enabled);
	});

	test('Test Uninstall action when state is uninstalling', () => {
		const testObject: ExtensionsActions.UninstallAction = instantiationService.createInstance(ExtensionsActions.UninstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				uninstallEvent.fire(local.identifier);
				assert.ok(!testObject.enabled);
				assert.equal('Uninstalling', testObject.label);
				assert.equal('extension-action label uninstall uninstalling', testObject.class);
			});
	});

	test('Test Uninstall action when state is installed and is user extension', () => {
		const testObject: ExtensionsActions.UninstallAction = instantiationService.createInstance(ExtensionsActions.UninstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				assert.ok(testObject.enabled);
				assert.equal('Uninstall', testObject.label);
				assert.equal('extension-action label uninstall', testObject.class);
			});
	});

	test('Test Uninstall action when state is installed and is system extension', () => {
		const testObject: ExtensionsActions.UninstallAction = instantiationService.createInstance(ExtensionsActions.UninstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', {}, { type: ExtensionType.System });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				assert.ok(!testObject.enabled);
				assert.equal('Uninstall', testObject.label);
				assert.equal('extension-action label uninstall', testObject.class);
			});
	});

	test('Test Uninstall action when state is installing and is user extension', () => {
		const testObject: ExtensionsActions.UninstallAction = instantiationService.createInstance(ExtensionsActions.UninstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const gallery = aGalleryExtension('a');
				const extension = extensions[0];
				extension.gallery = gallery;
				installEvent.fire({ identifier: gallery.identifier, gallery });
				testObject.extension = extension;
				assert.ok(!testObject.enabled);
			});
	});

	test('Test Uninstall action after extension is installed', () => {
		const testObject: ExtensionsActions.UninstallAction = instantiationService.createInstance(ExtensionsActions.UninstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
			.then(paged => {
				testObject.extension = paged.firstPage[0];

				installEvent.fire({ identifier: gallery.identifier, gallery });
				didInstallEvent.fire({ identifier: gallery.identifier, gallery, operation: InstallOperation.Install, local: aLocalExtension('a', gallery, gallery) });

				assert.ok(testObject.enabled);
				assert.equal('Uninstall', testObject.label);
				assert.equal('extension-action label uninstall', testObject.class);
			});
	});

	test('Test CombinedInstallAction when there is no extension', () => {
		const testObject: ExtensionsActions.CombinedInstallAction = instantiationService.createInstance(ExtensionsActions.CombinedInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		assert.ok(!testObject.enabled);
		assert.equal('extension-action label prominent install no-extension', testObject.class);
	});

	test('Test CombinedInstallAction when extension is system extension', () => {
		const testObject: ExtensionsActions.CombinedInstallAction = instantiationService.createInstance(ExtensionsActions.CombinedInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', {}, { type: ExtensionType.System });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				assert.ok(!testObject.enabled);
				assert.equal('extension-action label prominent install no-extension', testObject.class);
			});
	});

	test('Test CombinedInstallAction when installAction is enabled', () => {
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		const testObject: ExtensionsActions.CombinedInstallAction = instantiationService.createInstance(ExtensionsActions.CombinedInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		return workbenchService.queryGallery(CancellationToken.None)
			.then((paged) => {
				testObject.extension = paged.firstPage[0];
				assert.ok(testObject.enabled);
				assert.equal('Install', testObject.label);
				assert.equal('extension-action label prominent install', testObject.class);
			});
	});

	test('Test CombinedInstallAction when unInstallAction is enabled', () => {
		const testObject: ExtensionsActions.CombinedInstallAction = instantiationService.createInstance(ExtensionsActions.CombinedInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				assert.ok(testObject.enabled);
				assert.equal('Uninstall', testObject.label);
				assert.equal('extension-action label uninstall', testObject.class);
			});
	});

	test('Test CombinedInstallAction when state is installing', () => {
		const testObject: ExtensionsActions.CombinedInstallAction = instantiationService.createInstance(ExtensionsActions.CombinedInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		return workbenchService.queryGallery(CancellationToken.None)
			.then((paged) => {
				testObject.extension = paged.firstPage[0];
				installEvent.fire({ identifier: gallery.identifier, gallery });

				assert.ok(!testObject.enabled);
				assert.equal('Installing', testObject.label);
				assert.equal('extension-action label install installing', testObject.class);
			});
	});

	test('Test CombinedInstallAction when state is installing during update', () => {
		const testObject: ExtensionsActions.CombinedInstallAction = instantiationService.createInstance(ExtensionsActions.CombinedInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const gallery = aGalleryExtension('a');
				const extension = extensions[0];
				extension.gallery = gallery;
				testObject.extension = extension;
				installEvent.fire({ identifier: gallery.identifier, gallery });
				assert.ok(!testObject.enabled);
				assert.equal('Installing', testObject.label);
				assert.equal('extension-action label install installing', testObject.class);
			});
	});

	test('Test CombinedInstallAction when state is uninstalling', () => {
		const testObject: ExtensionsActions.CombinedInstallAction = instantiationService.createInstance(ExtensionsActions.CombinedInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				uninstallEvent.fire(local.identifier);
				assert.ok(!testObject.enabled);
				assert.equal('Uninstalling', testObject.label);
				assert.equal('extension-action label uninstall uninstalling', testObject.class);
			});
	});

	test('Test UpdateAction when there is no extension', () => {
		const testObject: ExtensionsActions.UpdateAction = instantiationService.createInstance(ExtensionsActions.UpdateAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		assert.ok(!testObject.enabled);
	});

	test('Test UpdateAction when extension is uninstalled', () => {
		const testObject: ExtensionsActions.UpdateAction = instantiationService.createInstance(ExtensionsActions.UpdateAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a', { version: '1.0.0' });
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
			.then((paged) => {
				testObject.extension = paged.firstPage[0];
				assert.ok(!testObject.enabled);
			});
	});

	test('Test UpdateAction when extension is installed and not outdated', () => {
		const testObject: ExtensionsActions.UpdateAction = instantiationService.createInstance(ExtensionsActions.UpdateAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', { version: '1.0.0' });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: local.identifier, version: local.manifest.version })));
				return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
					.then(extensions => assert.ok(!testObject.enabled));
			});
	});

	test('Test UpdateAction when extension is installed outdated and system extension', () => {
		const testObject: ExtensionsActions.UpdateAction = instantiationService.createInstance(ExtensionsActions.UpdateAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', { version: '1.0.0' }, { type: ExtensionType.System });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: local.identifier, version: '1.0.1' })));
				return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
					.then(extensions => assert.ok(!testObject.enabled));
			});
	});

	test('Test UpdateAction when extension is installed outdated and user extension', () => {
		const testObject: ExtensionsActions.UpdateAction = instantiationService.createInstance(ExtensionsActions.UpdateAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', { version: '1.0.0' });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		return workbenchService.queryLocal()
			.then(async extensions => {
				testObject.extension = extensions[0];
				instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: local.identifier, version: '1.0.1' })));
				assert.ok(!testObject.enabled);
				return new Promise(c => {
					testObject.onDidChange(() => {
						if (testObject.enabled) {
							c();
						}
					});
					instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None);
				});
			});
	});

	test('Test UpdateAction when extension is installing and outdated and user extension', () => {
		const testObject: ExtensionsActions.UpdateAction = instantiationService.createInstance(ExtensionsActions.UpdateAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', { version: '1.0.0' });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				const gallery = aGalleryExtension('a', { identifier: local.identifier, version: '1.0.1' });
				instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
				return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
					.then(extensions => {
						installEvent.fire({ identifier: local.identifier, gallery });
						assert.ok(!testObject.enabled);
					});
			});
	});

	test('Test ManageExtensionAction when there is no extension', () => {
		const testObject: ExtensionsActions.ManageExtensionAction = instantiationService.createInstance(ExtensionsActions.ManageExtensionAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		assert.ok(!testObject.enabled);
	});

	test('Test ManageExtensionAction when extension is installed', () => {
		const testObject: ExtensionsActions.ManageExtensionAction = instantiationService.createInstance(ExtensionsActions.ManageExtensionAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				assert.ok(testObject.enabled);
				assert.equal('extension-action icon manage codicon-gear', testObject.class);
				assert.equal('', testObject.tooltip);
			});
	});

	test('Test ManageExtensionAction when extension is uninstalled', () => {
		const testObject: ExtensionsActions.ManageExtensionAction = instantiationService.createInstance(ExtensionsActions.ManageExtensionAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
			.then(page => {
				testObject.extension = page.firstPage[0];
				assert.ok(!testObject.enabled);
				assert.equal('extension-action icon manage codicon-gear hide', testObject.class);
				assert.equal('', testObject.tooltip);
			});
	});

	test('Test ManageExtensionAction when extension is installing', () => {
		const testObject: ExtensionsActions.ManageExtensionAction = instantiationService.createInstance(ExtensionsActions.ManageExtensionAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
			.then(page => {
				testObject.extension = page.firstPage[0];

				installEvent.fire({ identifier: gallery.identifier, gallery });
				assert.ok(!testObject.enabled);
				assert.equal('extension-action icon manage codicon-gear hide', testObject.class);
				assert.equal('', testObject.tooltip);
			});
	});

	test('Test ManageExtensionAction when extension is queried from gallery and installed', () => {
		const testObject: ExtensionsActions.ManageExtensionAction = instantiationService.createInstance(ExtensionsActions.ManageExtensionAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
			.then(page => {
				testObject.extension = page.firstPage[0];
				installEvent.fire({ identifier: gallery.identifier, gallery });
				didInstallEvent.fire({ identifier: gallery.identifier, gallery, operation: InstallOperation.Install, local: aLocalExtension('a', gallery, gallery) });

				assert.ok(testObject.enabled);
				assert.equal('extension-action icon manage codicon-gear', testObject.class);
				assert.equal('', testObject.tooltip);
			});
	});

	test('Test ManageExtensionAction when extension is system extension', () => {
		const testObject: ExtensionsActions.ManageExtensionAction = instantiationService.createInstance(ExtensionsActions.ManageExtensionAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', {}, { type: ExtensionType.System });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				assert.ok(testObject.enabled);
				assert.equal('extension-action icon manage codicon-gear', testObject.class);
				assert.equal('', testObject.tooltip);
			});
	});

	test('Test ManageExtensionAction when extension is uninstalling', () => {
		const testObject: ExtensionsActions.ManageExtensionAction = instantiationService.createInstance(ExtensionsActions.ManageExtensionAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				testObject.extension = extensions[0];
				uninstallEvent.fire(local.identifier);

				assert.ok(!testObject.enabled);
				assert.equal('extension-action icon manage codicon-gear', testObject.class);
				assert.equal('Uninstalling', testObject.tooltip);
			});
	});

	test('Test EnableForWorkspaceAction when there is no extension', () => {
		const testObject: ExtensionsActions.EnableForWorkspaceAction = instantiationService.createInstance(ExtensionsActions.EnableForWorkspaceAction);

		assert.ok(!testObject.enabled);
	});

	test('Test EnableForWorkspaceAction when there extension is not disabled', () => {
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const testObject: ExtensionsActions.EnableForWorkspaceAction = instantiationService.createInstance(ExtensionsActions.EnableForWorkspaceAction);
				testObject.extension = extensions[0];
				assert.ok(!testObject.enabled);
			});
	});

	test('Test EnableForWorkspaceAction when the extension is disabled globally', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.EnableForWorkspaceAction = instantiationService.createInstance(ExtensionsActions.EnableForWorkspaceAction);
						testObject.extension = extensions[0];
						assert.ok(testObject.enabled);
					});
			});
	});

	test('Test EnableForWorkspaceAction when extension is disabled for workspace', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledWorkspace)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.EnableForWorkspaceAction = instantiationService.createInstance(ExtensionsActions.EnableForWorkspaceAction);
						testObject.extension = extensions[0];
						assert.ok(testObject.enabled);
					});
			});
	});

	test('Test EnableForWorkspaceAction when the extension is disabled globally and workspace', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally)
			.then(() => instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledWorkspace))
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.EnableForWorkspaceAction = instantiationService.createInstance(ExtensionsActions.EnableForWorkspaceAction);
						testObject.extension = extensions[0];
						assert.ok(testObject.enabled);
					});
			});
	});

	test('Test EnableGloballyAction when there is no extension', () => {
		const testObject: ExtensionsActions.EnableGloballyAction = instantiationService.createInstance(ExtensionsActions.EnableGloballyAction);

		assert.ok(!testObject.enabled);
	});

	test('Test EnableGloballyAction when the extension is not disabled', () => {
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const testObject: ExtensionsActions.EnableGloballyAction = instantiationService.createInstance(ExtensionsActions.EnableGloballyAction);
				testObject.extension = extensions[0];
				assert.ok(!testObject.enabled);
			});
	});

	test('Test EnableGloballyAction when the extension is disabled for workspace', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledWorkspace)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.EnableGloballyAction = instantiationService.createInstance(ExtensionsActions.EnableGloballyAction);
						testObject.extension = extensions[0];
						assert.ok(!testObject.enabled);
					});
			});
	});

	test('Test EnableGloballyAction when the extension is disabled globally', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.EnableGloballyAction = instantiationService.createInstance(ExtensionsActions.EnableGloballyAction);
						testObject.extension = extensions[0];
						assert.ok(testObject.enabled);
					});
			});
	});

	test('Test EnableGloballyAction when the extension is disabled in both', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally)
			.then(() => instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledWorkspace))
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.EnableGloballyAction = instantiationService.createInstance(ExtensionsActions.EnableGloballyAction);
						testObject.extension = extensions[0];
						assert.ok(!testObject.enabled);
					});
			});
	});

	test('Test EnableAction when there is no extension', () => {
		const testObject: ExtensionsActions.EnableDropDownAction = instantiationService.createInstance(ExtensionsActions.EnableDropDownAction);

		assert.ok(!testObject.enabled);
	});

	test('Test EnableDropDownAction when extension is installed and enabled', () => {
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const testObject: ExtensionsActions.EnableDropDownAction = instantiationService.createInstance(ExtensionsActions.EnableDropDownAction);
				testObject.extension = extensions[0];
				assert.ok(!testObject.enabled);
			});
	});

	test('Test EnableDropDownAction when extension is installed and disabled globally', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.EnableDropDownAction = instantiationService.createInstance(ExtensionsActions.EnableDropDownAction);
						testObject.extension = extensions[0];
						assert.ok(testObject.enabled);
					});
			});
	});

	test('Test EnableDropDownAction when extension is installed and disabled for workspace', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledWorkspace)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.EnableDropDownAction = instantiationService.createInstance(ExtensionsActions.EnableDropDownAction);
						testObject.extension = extensions[0];
						assert.ok(testObject.enabled);
					});
			});
	});

	test('Test EnableDropDownAction when extension is uninstalled', () => {
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
			.then(page => {
				const testObject: ExtensionsActions.EnableDropDownAction = instantiationService.createInstance(ExtensionsActions.EnableDropDownAction);
				testObject.extension = page.firstPage[0];
				assert.ok(!testObject.enabled);
			});
	});

	test('Test EnableDropDownAction when extension is installing', () => {
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
			.then(page => {
				const testObject: ExtensionsActions.EnableDropDownAction = instantiationService.createInstance(ExtensionsActions.EnableDropDownAction);
				testObject.extension = page.firstPage[0];
				instantiationService.createInstance(ExtensionContainers, [testObject]);

				installEvent.fire({ identifier: gallery.identifier, gallery });
				assert.ok(!testObject.enabled);
			});
	});

	test('Test EnableDropDownAction when extension is uninstalling', () => {
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const testObject: ExtensionsActions.EnableDropDownAction = instantiationService.createInstance(ExtensionsActions.EnableDropDownAction);
				testObject.extension = extensions[0];
				uninstallEvent.fire(local.identifier);
				assert.ok(!testObject.enabled);
			});
	});

	test('Test DisableForWorkspaceAction when there is no extension', () => {
		const testObject: ExtensionsActions.DisableForWorkspaceAction = instantiationService.createInstance(ExtensionsActions.DisableForWorkspaceAction, []);

		assert.ok(!testObject.enabled);
	});

	test('Test DisableForWorkspaceAction when the extension is disabled globally', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.DisableForWorkspaceAction = instantiationService.createInstance(ExtensionsActions.DisableForWorkspaceAction, []);
						testObject.extension = extensions[0];
						assert.ok(!testObject.enabled);
					});
			});
	});

	test('Test DisableForWorkspaceAction when the extension is disabled workspace', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.DisableForWorkspaceAction = instantiationService.createInstance(ExtensionsActions.DisableForWorkspaceAction, []);
						testObject.extension = extensions[0];
						assert.ok(!testObject.enabled);
					});
			});
	});

	test('Test DisableForWorkspaceAction when extension is enabled', () => {
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const testObject: ExtensionsActions.DisableForWorkspaceAction = instantiationService.createInstance(ExtensionsActions.DisableForWorkspaceAction, [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a') }]);
				testObject.extension = extensions[0];
				assert.ok(testObject.enabled);
			});
	});

	test('Test DisableGloballyAction when there is no extension', () => {
		const testObject: ExtensionsActions.DisableGloballyAction = instantiationService.createInstance(ExtensionsActions.DisableGloballyAction, []);

		assert.ok(!testObject.enabled);
	});

	test('Test DisableGloballyAction when the extension is disabled globally', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.DisableGloballyAction = instantiationService.createInstance(ExtensionsActions.DisableGloballyAction, []);
						testObject.extension = extensions[0];
						assert.ok(!testObject.enabled);
					});
			});
	});

	test('Test DisableGloballyAction when the extension is disabled for workspace', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledWorkspace)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.DisableGloballyAction = instantiationService.createInstance(ExtensionsActions.DisableGloballyAction, []);
						testObject.extension = extensions[0];
						assert.ok(!testObject.enabled);
					});
			});
	});

	test('Test DisableGloballyAction when the extension is enabled', () => {
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const testObject: ExtensionsActions.DisableGloballyAction = instantiationService.createInstance(ExtensionsActions.DisableGloballyAction, [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a') }]);
				testObject.extension = extensions[0];
				assert.ok(testObject.enabled);
			});
	});

	test('Test DisableDropDownAction when there is no extension', () => {
		const testObject: ExtensionsActions.DisableDropDownAction = instantiationService.createInstance(ExtensionsActions.DisableDropDownAction, []);

		assert.ok(!testObject.enabled);
	});

	test('Test DisableDropDownAction when extension is installed and enabled', () => {
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const testObject: ExtensionsActions.DisableDropDownAction = instantiationService.createInstance(ExtensionsActions.DisableDropDownAction, [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a') }]);
				testObject.extension = extensions[0];
				assert.ok(testObject.enabled);
			});
	});

	test('Test DisableDropDownAction when extension is installed and disabled globally', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.DisableDropDownAction = instantiationService.createInstance(ExtensionsActions.DisableDropDownAction, [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a') }]);
						testObject.extension = extensions[0];
						assert.ok(!testObject.enabled);
					});
			});
	});

	test('Test DisableDropDownAction when extension is installed and disabled for workspace', () => {
		const local = aLocalExtension('a');
		return instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledWorkspace)
			.then(() => {
				instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

				return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
					.then(extensions => {
						const testObject: ExtensionsActions.DisableDropDownAction = instantiationService.createInstance(ExtensionsActions.DisableDropDownAction, [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a') }]);
						testObject.extension = extensions[0];
						assert.ok(!testObject.enabled);
					});
			});
	});

	test('Test DisableDropDownAction when extension is uninstalled', () => {
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
			.then(page => {
				const testObject: ExtensionsActions.DisableDropDownAction = instantiationService.createInstance(ExtensionsActions.DisableDropDownAction, [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a') }]);
				testObject.extension = page.firstPage[0];
				assert.ok(!testObject.enabled);
			});
	});

	test('Test DisableDropDownAction when extension is installing', () => {
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		return instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None)
			.then(page => {
				const testObject: ExtensionsActions.DisableDropDownAction = instantiationService.createInstance(ExtensionsActions.DisableDropDownAction, [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a') }]);
				testObject.extension = page.firstPage[0];
				instantiationService.createInstance(ExtensionContainers, [testObject]);
				installEvent.fire({ identifier: gallery.identifier, gallery });
				assert.ok(!testObject.enabled);
			});
	});

	test('Test DisableDropDownAction when extension is uninstalling', () => {
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => {
				const testObject: ExtensionsActions.DisableDropDownAction = instantiationService.createInstance(ExtensionsActions.DisableDropDownAction, [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a') }]);
				testObject.extension = extensions[0];
				instantiationService.createInstance(ExtensionContainers, [testObject]);
				uninstallEvent.fire(local.identifier);
				assert.ok(!testObject.enabled);
			});
	});

	test('Test UpdateAllAction when no installed extensions', () => {
		const testObject: ExtensionsActions.UpdateAllAction = instantiationService.createInstance(ExtensionsActions.UpdateAllAction, 'id', 'label');

		assert.ok(!testObject.enabled);
	});

	test('Test UpdateAllAction when installed extensions are not outdated', () => {
		const testObject: ExtensionsActions.UpdateAllAction = instantiationService.createInstance(ExtensionsActions.UpdateAllAction, 'id', 'label');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [aLocalExtension('a'), aLocalExtension('b')]);
		return instantiationService.get(IExtensionsWorkbenchService).queryLocal()
			.then(extensions => assert.ok(!testObject.enabled));
	});

	test('Test UpdateAllAction when some installed extensions are outdated', () => {
		const testObject: ExtensionsActions.UpdateAllAction = instantiationService.createInstance(ExtensionsActions.UpdateAllAction, 'id', 'label');
		const local = [aLocalExtension('a', { version: '1.0.1' }), aLocalExtension('b', { version: '1.0.1' }), aLocalExtension('c', { version: '1.0.1' })];
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', local);
		return workbenchService.queryLocal()
			.then(async () => {
				instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: local[0].identifier, version: '1.0.2' }), aGalleryExtension('b', { identifier: local[1].identifier, version: '1.0.2' }), aGalleryExtension('c', local[2].manifest)));
				assert.ok(!testObject.enabled);
				return new Promise(c => {
					testObject.onDidChange(() => {
						if (testObject.enabled) {
							c();
						}
					});
					workbenchService.queryGallery(CancellationToken.None);
				});
			});
	});

	test('Test UpdateAllAction when some installed extensions are outdated and some outdated are being installed', () => {
		const testObject: ExtensionsActions.UpdateAllAction = instantiationService.createInstance(ExtensionsActions.UpdateAllAction, 'id', 'label');
		const local = [aLocalExtension('a', { version: '1.0.1' }), aLocalExtension('b', { version: '1.0.1' }), aLocalExtension('c', { version: '1.0.1' })];
		const gallery = [aGalleryExtension('a', { identifier: local[0].identifier, version: '1.0.2' }), aGalleryExtension('b', { identifier: local[1].identifier, version: '1.0.2' }), aGalleryExtension('c', local[2].manifest)];
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', local);
		return workbenchService.queryLocal()
			.then(async () => {
				instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(...gallery));
				assert.ok(!testObject.enabled);
				return new Promise(c => {
					installEvent.fire({ identifier: local[0].identifier, gallery: gallery[0] });
					testObject.onDidChange(() => {
						if (testObject.enabled) {
							c();
						}
					});
					workbenchService.queryGallery(CancellationToken.None);
				});
			});
	});

	test('Test UpdateAllAction when some installed extensions are outdated and all outdated are being installed', () => {
		const testObject: ExtensionsActions.UpdateAllAction = instantiationService.createInstance(ExtensionsActions.UpdateAllAction, 'id', 'label');
		const local = [aLocalExtension('a', { version: '1.0.1' }), aLocalExtension('b', { version: '1.0.1' }), aLocalExtension('c', { version: '1.0.1' })];
		const gallery = [aGalleryExtension('a', { identifier: local[0].identifier, version: '1.0.2' }), aGalleryExtension('b', { identifier: local[1].identifier, version: '1.0.2' }), aGalleryExtension('c', local[2].manifest)];
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', local);
		return workbenchService.queryLocal()
			.then(() => {
				instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(...gallery));
				return workbenchService.queryGallery(CancellationToken.None)
					.then(() => {
						installEvent.fire({ identifier: local[0].identifier, gallery: gallery[0] });
						installEvent.fire({ identifier: local[1].identifier, gallery: gallery[1] });
						assert.ok(!testObject.enabled);
					});
			});
	});

	test(`RecommendToFolderAction`, () => {
		// TODO: Implement test
	});

});

suite('ReloadAction', () => {

	setup(setupTest);
	teardown(() => disposables.dispose());

	test('Test ReloadAction when there is no extension', () => {
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension state is installing', async () => {
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		const paged = await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = paged.firstPage[0];
		installEvent.fire({ identifier: gallery.identifier, gallery });

		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension state is uninstalling', async () => {
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);

		const extensions = await instantiationService.get(IExtensionsWorkbenchService).queryLocal();
		testObject.extension = extensions[0];
		uninstallEvent.fire(local.identifier);
		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is newly installed', async () => {
		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		const runningExtensions = [{ identifier: new ExtensionIdentifier('pub.b'), extensionLocation: URI.file('pub.b') }];
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve(runningExtensions),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		const paged = await instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None);
		testObject.extension = paged.firstPage[0];
		assert.ok(!testObject.enabled);

		installEvent.fire({ identifier: gallery.identifier, gallery });
		didInstallEvent.fire({ identifier: gallery.identifier, gallery, operation: InstallOperation.Install, local: aLocalExtension('a', gallery, gallery) });
		assert.ok(testObject.enabled);
		assert.equal(testObject.tooltip, 'Please reload Azure Data Studio to enable this extension.'); // {{SQL CARBON EDIT}} - replace Visual Studio Code with Azure Data Studio
	});

	test('Test ReloadAction when extension is newly installed and reload is not required', async () => {
		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		const runningExtensions = [{ identifier: new ExtensionIdentifier('pub.b'), extensionLocation: URI.file('pub.b') }];
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve(runningExtensions),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => true
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		const paged = await instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None);
		testObject.extension = paged.firstPage[0];
		assert.ok(!testObject.enabled);

		installEvent.fire({ identifier: gallery.identifier, gallery });
		didInstallEvent.fire({ identifier: gallery.identifier, gallery, operation: InstallOperation.Install, local: aLocalExtension('a', gallery, gallery) });
		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is installed and uninstalled', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.b'), extensionLocation: URI.file('pub.b') }]);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		const paged = await instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None);

		testObject.extension = paged.firstPage[0];
		const identifier = gallery.identifier;
		installEvent.fire({ identifier, gallery });
		didInstallEvent.fire({ identifier, gallery, operation: InstallOperation.Install, local: aLocalExtension('a', gallery, { identifier }) });
		uninstallEvent.fire(identifier);
		didUninstallEvent.fire({ identifier });

		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is uninstalled', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a'), version: '1.0.0' }]);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await instantiationService.get(IExtensionsWorkbenchService).queryLocal();
		testObject.extension = extensions[0];

		uninstallEvent.fire(local.identifier);
		didUninstallEvent.fire({ identifier: local.identifier });
		assert.ok(testObject.enabled);
		assert.equal(testObject.tooltip, 'Please reload Azure Data Studio to complete the uninstallation of this extension.'); // {{SQL CARBON EDIT}} - replace Visual Studio Code with Azure Data Studio
	});

	test('Test ReloadAction when extension is uninstalled and can be removed', async () => {
		const local = aLocalExtension('a');
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve([ExtensionsActions.toExtensionDescription(local)]),
			onDidChangeExtensions: new Emitter<void>().event,
			canRemoveExtension: (extension) => true,
			canAddExtension: (extension) => true
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await instantiationService.get(IExtensionsWorkbenchService).queryLocal();
		testObject.extension = extensions[0];

		uninstallEvent.fire(local.identifier);
		didUninstallEvent.fire({ identifier: local.identifier });
		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is uninstalled and installed', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.a'), version: '1.0.0', extensionLocation: URI.file('pub.a') }]);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await instantiationService.get(IExtensionsWorkbenchService).queryLocal();

		testObject.extension = extensions[0];
		uninstallEvent.fire(local.identifier);
		didUninstallEvent.fire({ identifier: local.identifier });

		const gallery = aGalleryExtension('a');
		const identifier = gallery.identifier;
		installEvent.fire({ identifier, gallery });
		didInstallEvent.fire({ identifier, gallery, operation: InstallOperation.Install, local });

		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is updated while running', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.a'), version: '1.0.1', extensionLocation: URI.file('pub.a') }]);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', { version: '1.0.1' });
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await workbenchService.queryLocal();
		testObject.extension = extensions[0];

		return new Promise(c => {
			testObject.onDidChange(() => {
				if (testObject.enabled && testObject.tooltip === 'Please reload Azure Data Studio to enable the updated extension.') { // {{SQL CARBON EDIT}} - replace Visual Studio Code with Azure Data Studio
					c();
				}
			});
			const gallery = aGalleryExtension('a', { uuid: local.identifier.id, version: '1.0.2' });
			installEvent.fire({ identifier: gallery.identifier, gallery });
			didInstallEvent.fire({ identifier: gallery.identifier, gallery, operation: InstallOperation.Install, local: aLocalExtension('a', gallery, gallery) });
		});
	});

	test('Test ReloadAction when extension is updated when not running', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.b'), extensionLocation: URI.file('pub.b') }]);
		const local = aLocalExtension('a', { version: '1.0.1' });
		await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await workbenchService.queryLocal();
		testObject.extension = extensions[0];

		const gallery = aGalleryExtension('a', { identifier: local.identifier, version: '1.0.2' });
		installEvent.fire({ identifier: gallery.identifier, gallery });
		didInstallEvent.fire({ identifier: gallery.identifier, gallery, operation: InstallOperation.Update, local: aLocalExtension('a', gallery, gallery) });

		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is disabled when running', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.a'), extensionLocation: URI.file('pub.a') }]);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await workbenchService.queryLocal();
		testObject.extension = extensions[0];
		await workbenchService.setEnablement(extensions[0], EnablementState.DisabledGlobally);
		await testObject.update();

		assert.ok(testObject.enabled);
		assert.equal('Please reload Azure Data Studio to disable this extension.', testObject.tooltip); // {{SQL CARBON EDIT}} - replace Visual Studio Code with Azure Data Studio
	});

	test('Test ReloadAction when extension enablement is toggled when running', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.a'), version: '1.0.0', extensionLocation: URI.file('pub.a') }]);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a');
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await workbenchService.queryLocal();
		testObject.extension = extensions[0];
		await workbenchService.setEnablement(extensions[0], EnablementState.DisabledGlobally);
		await workbenchService.setEnablement(extensions[0], EnablementState.EnabledGlobally);
		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is enabled when not running', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.b'), extensionLocation: URI.file('pub.b') }]);
		const local = aLocalExtension('a');
		await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await workbenchService.queryLocal();
		testObject.extension = extensions[0];
		await workbenchService.setEnablement(extensions[0], EnablementState.EnabledGlobally);
		await testObject.update();
		assert.ok(testObject.enabled);
		assert.equal('Please reload Azure Data Studio to enable this extension.', testObject.tooltip); // {{SQL CARBON EDIT}} - replace Visual Studio Code with Azure Data Studio
	});

	test('Test ReloadAction when extension enablement is toggled when not running', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.b'), extensionLocation: URI.file('pub.b') }]);
		const local = aLocalExtension('a');
		await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await workbenchService.queryLocal();
		testObject.extension = extensions[0];
		await workbenchService.setEnablement(extensions[0], EnablementState.EnabledGlobally);
		await workbenchService.setEnablement(extensions[0], EnablementState.DisabledGlobally);
		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is updated when not running and enabled', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.b'), extensionLocation: URI.file('pub.b') }]);
		const local = aLocalExtension('a', { version: '1.0.1' });
		await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([local], EnablementState.DisabledGlobally);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await workbenchService.queryLocal();
		testObject.extension = extensions[0];

		const gallery = aGalleryExtension('a', { identifier: local.identifier, version: '1.0.2' });
		installEvent.fire({ identifier: gallery.identifier, gallery });
		didInstallEvent.fire({ identifier: gallery.identifier, gallery, operation: InstallOperation.Install, local: aLocalExtension('a', gallery, gallery) });
		await workbenchService.setEnablement(extensions[0], EnablementState.EnabledGlobally);
		await testObject.update();
		assert.ok(testObject.enabled);
		assert.equal('Please reload Azure Data Studio to enable this extension.', testObject.tooltip); // {{SQL CARBON EDIT}} - replace Visual Studio Code with Azure Data Studio
	});

	test('Test ReloadAction when a localization extension is newly installed', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.b'), extensionLocation: URI.file('pub.b') }]);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const gallery = aGalleryExtension('a');
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		const paged = await instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None);
		testObject.extension = paged.firstPage[0];
		assert.ok(!testObject.enabled);

		installEvent.fire({ identifier: gallery.identifier, gallery });
		didInstallEvent.fire({ identifier: gallery.identifier, gallery, operation: InstallOperation.Install, local: aLocalExtension('a', { ...gallery, ...{ contributes: <IExtensionContributions>{ localizations: [{ languageId: 'de', translations: [] }] } } }, gallery) });
		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when a localization extension is updated while running', async () => {
		instantiationService.stubPromise(IExtensionService, 'getExtensions', [{ identifier: new ExtensionIdentifier('pub.a'), version: '1.0.1', extensionLocation: URI.file('pub.a') }]);
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		const local = aLocalExtension('a', { version: '1.0.1', contributes: <IExtensionContributions>{ localizations: [{ languageId: 'de', translations: [] }] } });
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [local]);
		const extensions = await workbenchService.queryLocal();
		testObject.extension = extensions[0];

		const gallery = aGalleryExtension('a', { uuid: local.identifier.id, version: '1.0.2' });
		installEvent.fire({ identifier: gallery.identifier, gallery });
		didInstallEvent.fire({ identifier: gallery.identifier, gallery, operation: InstallOperation.Install, local: aLocalExtension('a', { ...gallery, ...{ contributes: <IExtensionContributions>{ localizations: [{ languageId: 'de', translations: [] }] } } }, gallery) });
		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is not installed but extension from different server is installed and running', async () => {
		// multi server setup
		const gallery = aGalleryExtension('a');
		const localExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file('pub.a') });
		const remoteExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file('pub.a').with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localExtension]), createExtensionManagementService([remoteExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		const runningExtensions = [ExtensionsActions.toExtensionDescription(remoteExtension)];
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve(runningExtensions),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		await workbenchService.queryGallery(CancellationToken.None);
		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when extension is uninstalled but extension from different server is installed and running', async () => {
		// multi server setup
		const gallery = aGalleryExtension('a');
		const localExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file('pub.a') });
		const remoteExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file('pub.a').with({ scheme: Schemas.vscodeRemote }) });
		const localExtensionManagementService = createExtensionManagementService([localExtension]);
		const uninstallEvent = new Emitter<IExtensionIdentifier>();
		const onDidUninstallEvent = new Emitter<{ identifier: IExtensionIdentifier }>();
		localExtensionManagementService.onUninstallExtension = uninstallEvent.event;
		localExtensionManagementService.onDidUninstallExtension = onDidUninstallEvent.event;
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, localExtensionManagementService, createExtensionManagementService([remoteExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		const runningExtensions = [ExtensionsActions.toExtensionDescription(remoteExtension)];
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve(runningExtensions),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		await workbenchService.queryGallery(CancellationToken.None);
		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);

		uninstallEvent.fire(localExtension.identifier);
		didUninstallEvent.fire({ identifier: localExtension.identifier });

		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction when workspace extension is disabled on local server and installed in remote server', async () => {
		// multi server setup
		const gallery = aGalleryExtension('a');
		const remoteExtensionManagementService = createExtensionManagementService([]);
		const onDidInstallEvent = new Emitter<DidInstallExtensionEvent>();
		remoteExtensionManagementService.onDidInstallExtension = onDidInstallEvent.event;
		const localExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file('pub.a') });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localExtension]), remoteExtensionManagementService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve([]),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		await workbenchService.queryGallery(CancellationToken.None);
		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);

		const remoteExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file('pub.a').with({ scheme: Schemas.vscodeRemote }) });
		onDidInstallEvent.fire({ identifier: remoteExtension.identifier, local: remoteExtension, operation: InstallOperation.Install });

		assert.ok(testObject.enabled);
		assert.equal(testObject.tooltip, 'Please reload Azure Data Studio to enable this extension.'); // {{SQL CARBON EDIT}} - replace Visual Studio Code with Azure Data Studio
	});

	test('Test ReloadAction when ui extension is disabled on remote server and installed in local server', async () => {
		// multi server setup
		const gallery = aGalleryExtension('a');
		const localExtensionManagementService = createExtensionManagementService([]);
		const onDidInstallEvent = new Emitter<DidInstallExtensionEvent>();
		localExtensionManagementService.onDidInstallExtension = onDidInstallEvent.event;
		const remoteExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file('pub.a').with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, localExtensionManagementService, createExtensionManagementService([remoteExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve([]),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		await workbenchService.queryGallery(CancellationToken.None);
		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);

		const localExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file('pub.a') });
		onDidInstallEvent.fire({ identifier: localExtension.identifier, local: localExtension, operation: InstallOperation.Install });

		assert.ok(testObject.enabled);
		assert.equal(testObject.tooltip, 'Please reload Azure Data Studio to enable this extension.'); // {{SQL CARBON EDIT}} - replace Visual Studio Code with Azure Data Studio
	});

	test('Test ReloadAction for remote ui extension is disabled when it is installed and enabled in local server', async () => {
		// multi server setup
		const gallery = aGalleryExtension('a');
		const localExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file('pub.a') });
		const localExtensionManagementService = createExtensionManagementService([localExtension]);
		const onDidInstallEvent = new Emitter<DidInstallExtensionEvent>();
		localExtensionManagementService.onDidInstallExtension = onDidInstallEvent.event;
		const remoteExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file('pub.a').with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, localExtensionManagementService, createExtensionManagementService([remoteExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve([ExtensionsActions.toExtensionDescription(localExtension)]),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		await workbenchService.queryGallery(CancellationToken.None);
		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test ReloadAction for remote workspace+ui extension is enabled when it is installed and enabled in local server', async () => {
		// multi server setup
		const gallery = aGalleryExtension('a');
		const localExtension = aLocalExtension('a', { extensionKind: ['workspace', 'ui'] }, { location: URI.file('pub.a') });
		const localExtensionManagementService = createExtensionManagementService([localExtension]);
		const onDidInstallEvent = new Emitter<DidInstallExtensionEvent>();
		localExtensionManagementService.onDidInstallExtension = onDidInstallEvent.event;
		const remoteExtension = aLocalExtension('a', { extensionKind: ['workspace', 'ui'] }, { location: URI.file('pub.a').with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, localExtensionManagementService, createExtensionManagementService([remoteExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve([ExtensionsActions.toExtensionDescription(localExtension)]),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		await workbenchService.queryGallery(CancellationToken.None);
		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(testObject.enabled);
	});

	test('Test ReloadAction for local ui+workspace extension is enabled when it is installed and enabled in remote server', async () => {
		// multi server setup
		const gallery = aGalleryExtension('a');
		const localExtension = aLocalExtension('a', { extensionKind: ['ui', 'workspace'] }, { location: URI.file('pub.a') });
		const remoteExtension = aLocalExtension('a', { extensionKind: ['ui', 'workspace'] }, { location: URI.file('pub.a').with({ scheme: Schemas.vscodeRemote }) });
		const remoteExtensionManagementService = createExtensionManagementService([remoteExtension]);
		const onDidInstallEvent = new Emitter<DidInstallExtensionEvent>();
		remoteExtensionManagementService.onDidInstallExtension = onDidInstallEvent.event;
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localExtension]), remoteExtensionManagementService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve([ExtensionsActions.toExtensionDescription(remoteExtension)]),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		await workbenchService.queryGallery(CancellationToken.None);
		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(testObject.enabled);
	});

	test('Test ReloadAction for local workspace+ui extension is enabled when it is installed in both servers but running in local server', async () => {
		// multi server setup
		const gallery = aGalleryExtension('a');
		const localExtension = aLocalExtension('a', { extensionKind: ['workspace', 'ui'] }, { location: URI.file('pub.a') });
		const localExtensionManagementService = createExtensionManagementService([localExtension]);
		const onDidInstallEvent = new Emitter<DidInstallExtensionEvent>();
		localExtensionManagementService.onDidInstallExtension = onDidInstallEvent.event;
		const remoteExtension = aLocalExtension('a', { extensionKind: ['workspace', 'ui'] }, { location: URI.file('pub.a').with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, localExtensionManagementService, createExtensionManagementService([remoteExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve([ExtensionsActions.toExtensionDescription(localExtension)]),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		await workbenchService.queryGallery(CancellationToken.None);
		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(testObject.enabled);
	});

	test('Test ReloadAction for remote ui+workspace extension is enabled when it is installed on both servers but running in remote server', async () => {
		// multi server setup
		const gallery = aGalleryExtension('a');
		const localExtension = aLocalExtension('a', { extensionKind: ['ui', 'workspace'] }, { location: URI.file('pub.a') });
		const remoteExtension = aLocalExtension('a', { extensionKind: ['ui', 'workspace'] }, { location: URI.file('pub.a').with({ scheme: Schemas.vscodeRemote }) });
		const remoteExtensionManagementService = createExtensionManagementService([remoteExtension]);
		const onDidInstallEvent = new Emitter<DidInstallExtensionEvent>();
		remoteExtensionManagementService.onDidInstallExtension = onDidInstallEvent.event;
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localExtension]), remoteExtensionManagementService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const onDidChangeExtensionsEmitter: Emitter<void> = new Emitter<void>();
		instantiationService.stub(IExtensionService, <Partial<IExtensionService>>{
			getExtensions: () => Promise.resolve([ExtensionsActions.toExtensionDescription(remoteExtension)]),
			onDidChangeExtensions: onDidChangeExtensionsEmitter.event,
			canAddExtension: (extension) => false
		});
		const testObject: ExtensionsActions.ReloadAction = instantiationService.createInstance(ExtensionsActions.ReloadAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));

		await workbenchService.queryGallery(CancellationToken.None);
		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(testObject.enabled);
	});
});

suite('RemoteInstallAction', () => {

	setup(setupTest);
	teardown(() => disposables.dispose());

	test('Test remote install action is enabled for local workspace extension', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install in remote', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);
	});

	test('Test remote install action when installing local workspace extension', async () => {
		// multi server setup
		const remoteExtensionManagementService: IExtensionManagementService = createExtensionManagementService();
		const onInstallExtension = new Emitter<InstallExtensionEvent>();
		remoteExtensionManagementService.onInstallExtension = onInstallExtension.event;
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]), remoteExtensionManagementService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.stub(IExtensionsWorkbenchService, workbenchService, 'open', undefined);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const gallery = aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier });
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install in remote', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);

		onInstallExtension.fire({ identifier: localWorkspaceExtension.identifier, gallery });
		assert.ok(testObject.enabled);
		assert.equal('Installing', testObject.label);
		assert.equal('extension-action label install installing', testObject.class);
	});

	test('Test remote install action when installing local workspace extension is finished', async () => {
		// multi server setup
		const remoteExtensionManagementService: IExtensionManagementService = createExtensionManagementService();
		const onInstallExtension = new Emitter<InstallExtensionEvent>();
		remoteExtensionManagementService.onInstallExtension = onInstallExtension.event;
		const onDidInstallEvent = new Emitter<DidInstallExtensionEvent>();
		remoteExtensionManagementService.onDidInstallExtension = onDidInstallEvent.event;
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]), remoteExtensionManagementService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.stub(IExtensionsWorkbenchService, workbenchService, 'open', undefined);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const gallery = aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier });
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install in remote', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);

		onInstallExtension.fire({ identifier: localWorkspaceExtension.identifier, gallery });
		assert.ok(testObject.enabled);
		assert.equal('Installing', testObject.label);
		assert.equal('extension-action label install installing', testObject.class);

		const installedExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		onDidInstallEvent.fire({ identifier: installedExtension.identifier, local: installedExtension, operation: InstallOperation.Install });
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is enabled for disabled local workspace extension', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([localWorkspaceExtension], EnablementState.DisabledGlobally);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install in remote', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);
	});

	test('Test remote install action is enabled local workspace+ui extension', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace', 'ui'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([localWorkspaceExtension], EnablementState.DisabledGlobally);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install in remote', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);
	});

	test('Test remote install action is enabled for local ui+workapace extension if can install is true', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['ui', 'workspace'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([localWorkspaceExtension], EnablementState.DisabledGlobally);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, true);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install in remote', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);
	});

	test('Test remote install action is disabled for local ui+workapace extension if can install is false', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['ui', 'workspace'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([localWorkspaceExtension], EnablementState.DisabledGlobally);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is disabled when extension is not set', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]));
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is disabled for extension which is not installed', async () => {
		// multi server setup
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a')));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const pager = await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = pager.firstPage[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is disabled for local workspace extension which is disabled in env', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]));
		instantiationService.stub(IWorkbenchEnvironmentService, { disableExtensions: true } as IWorkbenchEnvironmentService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is disabled when remote server is not available', async () => {
		// single server setup
		const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
		const extensionManagementServerService = instantiationService.get(IExtensionManagementServerService);
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [localWorkspaceExtension]);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is disabled for local workspace extension if it is uninstalled locally', async () => {
		// multi server setup
		const extensionManagementService = instantiationService.get(IExtensionManagementService);
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, extensionManagementService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [localWorkspaceExtension]);
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install in remote', testObject.label);

		uninstallEvent.fire(localWorkspaceExtension.identifier);
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is disabled for local workspace extension if it is installed in remote', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		const remoteWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]), createExtensionManagementService([remoteWorkspaceExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is enabled for local workspace extension if it has not gallery', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(testObject.enabled);
	});

	test('Test remote install action is disabled for local workspace system extension', async () => {
		// multi server setup
		const localWorkspaceSystemExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`), type: ExtensionType.System });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceSystemExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceSystemExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is disabled for local ui extension if it is not installed in remote', async () => {
		// multi server setup
		const localUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is disabled for local ui extension if it is also installed in remote', async () => {
		// multi server setup
		const localUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`) });
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localUIExtension]), createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test remote install action is enabled for locally installed language pack extension', async () => {
		// multi server setup
		const languagePackExtension = aLocalExtension('a', { contributes: <IExtensionContributions>{ localizations: [{ languageId: 'de', translations: [] }] } }, { location: URI.file(`pub.a`) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([languagePackExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: languagePackExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install in remote', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);
	});

	test('Test remote install action is disabled if local language pack extension is uninstalled', async () => {
		// multi server setup
		const extensionManagementService = instantiationService.get(IExtensionManagementService);
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, extensionManagementService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const languagePackExtension = aLocalExtension('a', { contributes: <IExtensionContributions>{ localizations: [{ languageId: 'de', translations: [] }] } }, { location: URI.file(`pub.a`) });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [languagePackExtension]);
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: languagePackExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.RemoteInstallAction, false);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.localExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install in remote', testObject.label);

		uninstallEvent.fire(languagePackExtension.identifier);
		assert.ok(!testObject.enabled);
	});
});

suite('LocalInstallAction', () => {

	setup(setupTest);
	teardown(() => disposables.dispose());

	test('Test local install action is enabled for remote ui extension', async () => {
		// multi server setup
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install Locally', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);
	});

	test('Test local install action is enabled for remote ui+workspace extension', async () => {
		// multi server setup
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui', 'workspace'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install Locally', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);
	});

	test('Test local install action when installing remote ui extension', async () => {
		// multi server setup
		const localExtensionManagementService: IExtensionManagementService = createExtensionManagementService();
		const onInstallExtension = new Emitter<InstallExtensionEvent>();
		localExtensionManagementService.onInstallExtension = onInstallExtension.event;
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, localExtensionManagementService, createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.stub(IExtensionsWorkbenchService, workbenchService, 'open', undefined);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const gallery = aGalleryExtension('a', { identifier: remoteUIExtension.identifier });
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install Locally', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);

		onInstallExtension.fire({ identifier: remoteUIExtension.identifier, gallery });
		assert.ok(testObject.enabled);
		assert.equal('Installing', testObject.label);
		assert.equal('extension-action label install installing', testObject.class);
	});

	test('Test local install action when installing remote ui extension is finished', async () => {
		// multi server setup
		const localExtensionManagementService: IExtensionManagementService = createExtensionManagementService();
		const onInstallExtension = new Emitter<InstallExtensionEvent>();
		localExtensionManagementService.onInstallExtension = onInstallExtension.event;
		const onDidInstallEvent = new Emitter<DidInstallExtensionEvent>();
		localExtensionManagementService.onDidInstallExtension = onDidInstallEvent.event;
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, localExtensionManagementService, createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.stub(IExtensionsWorkbenchService, workbenchService, 'open', undefined);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		const gallery = aGalleryExtension('a', { identifier: remoteUIExtension.identifier });
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(gallery));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install Locally', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);

		onInstallExtension.fire({ identifier: remoteUIExtension.identifier, gallery });
		assert.ok(testObject.enabled);
		assert.equal('Installing', testObject.label);
		assert.equal('extension-action label install installing', testObject.class);

		const installedExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`) });
		onDidInstallEvent.fire({ identifier: installedExtension.identifier, local: installedExtension, operation: InstallOperation.Install });
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is enabled for disabled remote ui extension', async () => {
		// multi server setup
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([remoteUIExtension], EnablementState.DisabledGlobally);
		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install Locally', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);
	});

	test('Test local install action is disabled when extension is not set', async () => {
		// multi server setup
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is disabled for extension which is not installed', async () => {
		// multi server setup
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a')));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const pager = await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = pager.firstPage[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is disabled for remote ui extension which is disabled in env', async () => {
		// multi server setup
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		instantiationService.stub(IWorkbenchEnvironmentService, { disableExtensions: true } as IWorkbenchEnvironmentService);
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is disabled when local server is not available', async () => {
		// single server setup
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aSingleRemoteExtensionManagementServerService(instantiationService, createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is disabled for remote ui extension if it is installed in local', async () => {
		// multi server setup
		const localUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`) });
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localUIExtension]), createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is disabled for remoteUI extension if it is uninstalled locally', async () => {
		// multi server setup
		const extensionManagementService = instantiationService.get(IExtensionManagementService);
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), extensionManagementService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [remoteUIExtension]);
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install Locally', testObject.label);

		uninstallEvent.fire(remoteUIExtension.identifier);
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is enabled for remote UI extension if it has gallery', async () => {
		// multi server setup
		const remoteUIExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), createExtensionManagementService([remoteUIExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteUIExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(testObject.enabled);
	});

	test('Test local install action is disabled for remote UI system extension', async () => {
		// multi server setup
		const remoteUISystemExtension = aLocalExtension('a', { extensionKind: ['ui'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }), type: ExtensionType.System });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), createExtensionManagementService([remoteUISystemExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteUISystemExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is disabled for remote workspace extension if it is not installed in local', async () => {
		// multi server setup
		const remoteWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), createExtensionManagementService([remoteWorkspaceExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: remoteWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is disabled for remote workspace extension if it is also installed in local', async () => {
		// multi server setup
		const localWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspae'] }, { location: URI.file(`pub.a`) });
		const remoteWorkspaceExtension = aLocalExtension('a', { extensionKind: ['workspace'] }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService([localWorkspaceExtension]), createExtensionManagementService([remoteWorkspaceExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: localWorkspaceExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		testObject.extension = extensions[0];
		assert.ok(testObject.extension);
		assert.ok(!testObject.enabled);
	});

	test('Test local install action is enabled for remotely installed language pack extension', async () => {
		// multi server setup
		const languagePackExtension = aLocalExtension('a', { contributes: <IExtensionContributions>{ localizations: [{ languageId: 'de', translations: [] }] } }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), createExtensionManagementService([languagePackExtension]));
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: languagePackExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install Locally', testObject.label);
		assert.equal('extension-action label prominent install', testObject.class);
	});

	test('Test local install action is disabled if remote language pack extension is uninstalled', async () => {
		// multi server setup
		const extensionManagementService = instantiationService.get(IExtensionManagementService);
		const extensionManagementServerService = aMultiExtensionManagementServerService(instantiationService, createExtensionManagementService(), extensionManagementService);
		instantiationService.stub(IExtensionManagementServerService, extensionManagementServerService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new TestExtensionEnablementService(instantiationService));
		const languagePackExtension = aLocalExtension('a', { contributes: <IExtensionContributions>{ localizations: [{ languageId: 'de', translations: [] }] } }, { location: URI.file(`pub.a`).with({ scheme: Schemas.vscodeRemote }) });
		instantiationService.stubPromise(IExtensionManagementService, 'getInstalled', [languagePackExtension]);
		const workbenchService: IExtensionsWorkbenchService = instantiationService.createInstance(ExtensionsWorkbenchService);
		instantiationService.set(IExtensionsWorkbenchService, workbenchService);

		instantiationService.stubPromise(IExtensionGalleryService, 'query', aPage(aGalleryExtension('a', { identifier: languagePackExtension.identifier })));
		const testObject: ExtensionsActions.InstallAction = instantiationService.createInstance(ExtensionsActions.LocalInstallAction);
		instantiationService.createInstance(ExtensionContainers, [testObject]);

		const extensions = await workbenchService.queryLocal(extensionManagementServerService.remoteExtensionManagementServer!);
		await workbenchService.queryGallery(CancellationToken.None);
		testObject.extension = extensions[0];
		assert.ok(testObject.enabled);
		assert.equal('Install Locally', testObject.label);

		uninstallEvent.fire(languagePackExtension.identifier);
		assert.ok(!testObject.enabled);
	});

});

function aLocalExtension(name: string = 'someext', manifest: any = {}, properties: any = {}): ILocalExtension {
	manifest = assign({ name, publisher: 'pub', version: '1.0.0' }, manifest);
	properties = assign({
		type: ExtensionType.User,
		location: URI.file(`pub.${name}`),
		identifier: { id: getGalleryExtensionId(manifest.publisher, manifest.name), uuid: undefined },
		metadata: { id: getGalleryExtensionId(manifest.publisher, manifest.name), publisherId: manifest.publisher, publisherDisplayName: 'somename' }
	}, properties);
	return <ILocalExtension>Object.create({ manifest, ...properties });
}

function aGalleryExtension(name: string, properties: any = {}, galleryExtensionProperties: any = {}, assets: any = {}): IGalleryExtension {
	const galleryExtension = <IGalleryExtension>Object.create({});
	assign(galleryExtension, { name, publisher: 'pub', version: '1.0.0', properties: {}, assets: {} }, properties);
	assign(galleryExtension.properties, { dependencies: [] }, galleryExtensionProperties);
	assign(galleryExtension.assets, assets);
	galleryExtension.identifier = { id: getGalleryExtensionId(galleryExtension.publisher, galleryExtension.name), uuid: generateUuid() };
	return <IGalleryExtension>galleryExtension;
}

function aPage<T>(...objects: T[]): IPager<T> {
	return { firstPage: objects, total: objects.length, pageSize: objects.length, getPage: () => null! };
}

function aSingleRemoteExtensionManagementServerService(instantiationService: TestInstantiationService, remoteExtensionManagementService?: IExtensionManagementService): IExtensionManagementServerService {
	const remoteExtensionManagementServer: IExtensionManagementServer = {
		authority: 'vscode-remote',
		label: 'remote',
		extensionManagementService: remoteExtensionManagementService || createExtensionManagementService()
	};
	return {
		_serviceBrand: undefined,
		localExtensionManagementServer: null,
		remoteExtensionManagementServer,
		getExtensionManagementServer: (location: URI) => {
			if (location.scheme === REMOTE_HOST_SCHEME) {
				return remoteExtensionManagementServer;
			}
			return null;
		}
	};
}

function aMultiExtensionManagementServerService(instantiationService: TestInstantiationService, localExtensionManagementService?: IExtensionManagementService, remoteExtensionManagementService?: IExtensionManagementService): IExtensionManagementServerService {
	const localExtensionManagementServer: IExtensionManagementServer = {
		authority: 'vscode-local',
		label: 'local',
		extensionManagementService: localExtensionManagementService || createExtensionManagementService()
	};
	const remoteExtensionManagementServer: IExtensionManagementServer = {
		authority: 'vscode-remote',
		label: 'remote',
		extensionManagementService: remoteExtensionManagementService || createExtensionManagementService()
	};
	return {
		_serviceBrand: undefined,
		localExtensionManagementServer,
		remoteExtensionManagementServer,
		getExtensionManagementServer: (location: URI) => {
			if (location.scheme === Schemas.file) {
				return localExtensionManagementServer;
			}
			if (location.scheme === REMOTE_HOST_SCHEME) {
				return remoteExtensionManagementServer;
			}
			return null;
		}
	};
}

function createExtensionManagementService(installed: ILocalExtension[] = []): IExtensionManagementService {
	return <IExtensionManagementService>{
		onInstallExtension: Event.None,
		onDidInstallExtension: Event.None,
		onUninstallExtension: Event.None,
		onDidUninstallExtension: Event.None,
		getInstalled: () => Promise.resolve<ILocalExtension[]>(installed),
		installFromGallery: (extension: IGalleryExtension) => Promise.reject(new Error('not supported'))
	};
}


