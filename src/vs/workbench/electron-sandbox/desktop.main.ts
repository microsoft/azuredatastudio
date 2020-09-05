/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { zoomLevelToZoomFactor } from 'vs/platform/windows/common/windows';
import { importEntries, mark } from 'vs/base/common/performance';
import { Workbench } from 'vs/workbench/browser/workbench';
import { setZoomLevel, setZoomFactor, setFullscreen } from 'vs/base/browser/browser';
import { domContentLoaded, addDisposableListener, EventType, scheduleAtNextAnimationFrame } from 'vs/base/browser/dom';
import { URI } from 'vs/base/common/uri';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ILogService } from 'vs/platform/log/common/log';
import { Schemas } from 'vs/base/common/network';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { Disposable } from 'vs/base/common/lifecycle';
import { IMainProcessService, MainProcessService } from 'vs/platform/ipc/electron-sandbox/mainProcessService';
import { IRemoteAuthorityResolverService } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { FileService } from 'vs/platform/files/common/fileService';
import { IFileService } from 'vs/platform/files/common/files';
import { RemoteFileSystemProvider } from 'vs/workbench/services/remote/common/remoteAgentFileSystemChannel';
import { ISignService } from 'vs/platform/sign/common/sign';
import { FileUserDataProvider } from 'vs/workbench/services/userData/common/fileUserDataProvider';
import { IProductService } from 'vs/platform/product/common/productService';
import product from 'vs/platform/product/common/product';
import { IResourceIdentityService } from 'vs/platform/resource/common/resourceIdentityService';
import { IElectronService, ElectronService } from 'vs/platform/electron/electron-sandbox/electron';
import { SimpleConfigurationService, simpleFileSystemProvider, SimpleLogService, SimpleRemoteAgentService, SimpleRemoteAuthorityResolverService, SimpleResourceIdentityService, SimpleSignService, SimpleStorageService, SimpleWorkspaceService } from 'vs/workbench/electron-sandbox/sandbox.simpleservices';
import { BrowserWorkbenchEnvironmentService } from 'vs/workbench/services/environment/browser/environmentService';

class DesktopMain extends Disposable {

	private readonly environmentService = new BrowserWorkbenchEnvironmentService({
		logsPath: URI.file('logs-path'),
		workspaceId: ''
	});

	constructor(private configuration: any /*INativeWindowConfiguration*/) {
		super();

		this.init();
	}

	private init(): void {

		// Setup perf
		importEntries(this.configuration.perfEntries);

		// Browser config
		const zoomLevel = this.configuration.zoomLevel || 0;
		setZoomFactor(zoomLevelToZoomFactor(zoomLevel));
		setZoomLevel(zoomLevel, true /* isTrusted */);
		setFullscreen(!!this.configuration.fullscreen);
	}

	async open(): Promise<void> {
		const services = await this.initServices();

		await domContentLoaded();
		mark('willStartWorkbench');

		// Create Workbench
		const workbench = new Workbench(document.body, services.serviceCollection, services.logService);

		// Listeners
		this.registerListeners(workbench, services.storageService);

		// Startup
		workbench.startup();

		// Logging
		services.logService.trace('workbench configuration', JSON.stringify(this.environmentService.configuration));
	}

	private registerListeners(workbench: Workbench, storageService: SimpleStorageService): void {

		// Layout
		this._register(addDisposableListener(window, EventType.RESIZE, e => this.onWindowResize(e, true, workbench)));

		// Workbench Lifecycle
		this._register(workbench.onShutdown(() => this.dispose()));
		this._register(workbench.onWillShutdown(event => event.join(storageService.close())));
	}

	private onWindowResize(e: Event, retry: boolean, workbench: Workbench): void {
		if (e.target === window) {
			if (window.document && window.document.body && window.document.body.clientWidth === 0) {
				// TODO@Ben this is an electron issue on macOS when simple fullscreen is enabled
				// where for some reason the window clientWidth is reported as 0 when switching
				// between simple fullscreen and normal screen. In that case we schedule the layout
				// call at the next animation frame once, in the hope that the dimensions are
				// proper then.
				if (retry) {
					scheduleAtNextAnimationFrame(() => this.onWindowResize(e, false, workbench));
				}
				return;
			}

			workbench.layout();
		}
	}

	private async initServices(): Promise<{ serviceCollection: ServiceCollection, logService: ILogService, storageService: SimpleStorageService }> {
		const serviceCollection = new ServiceCollection();

		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		// NOTE: DO NOT ADD ANY OTHER SERVICE INTO THE COLLECTION HERE.
		// CONTRIBUTE IT VIA WORKBENCH.DESKTOP.MAIN.TS AND registerSingleton().
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

		// Main Process
		const mainProcessService = this._register(new MainProcessService(this.configuration.windowId));
		serviceCollection.set(IMainProcessService, mainProcessService);

		// Environment
		serviceCollection.set(IWorkbenchEnvironmentService, this.environmentService);

		// Product
		const productService: IProductService = { _serviceBrand: undefined, ...product };
		serviceCollection.set(IProductService, productService);

		// Log
		const logService = new SimpleLogService();
		serviceCollection.set(ILogService, logService);

		// Remote
		const remoteAuthorityResolverService = new SimpleRemoteAuthorityResolverService();
		serviceCollection.set(IRemoteAuthorityResolverService, remoteAuthorityResolverService);

		// Sign
		const signService = new SimpleSignService();
		serviceCollection.set(ISignService, signService);

		// Remote Agent
		const remoteAgentService = new SimpleRemoteAgentService();
		serviceCollection.set(IRemoteAgentService, remoteAgentService);

		// Electron
		const electronService = new ElectronService(this.configuration.windowId, mainProcessService) as IElectronService;
		serviceCollection.set(IElectronService, electronService);

		// Files
		const fileService = this._register(new FileService(logService));
		serviceCollection.set(IFileService, fileService);

		fileService.registerProvider(Schemas.file, simpleFileSystemProvider);

		// User Data Provider
		fileService.registerProvider(Schemas.userData, new FileUserDataProvider(URI.file('user-home'), this.environmentService.backupHome, simpleFileSystemProvider, this.environmentService, logService));

		const connection = remoteAgentService.getConnection();
		if (connection) {
			const remoteFileSystemProvider = this._register(new RemoteFileSystemProvider(remoteAgentService));
			fileService.registerProvider(Schemas.vscodeRemote, remoteFileSystemProvider);
		}

		const resourceIdentityService = new SimpleResourceIdentityService();
		serviceCollection.set(IResourceIdentityService, resourceIdentityService);

		const services = await Promise.all([
			this.createWorkspaceService().then(service => {

				// Workspace
				serviceCollection.set(IWorkspaceContextService, service);

				// Configuration
				serviceCollection.set(IConfigurationService, new SimpleConfigurationService());

				return service;
			}),

			this.createStorageService().then(service => {

				// Storage
				serviceCollection.set(IStorageService, service);

				return service;
			})
		]);

		return { serviceCollection, logService, storageService: services[1] };
	}

	private async createWorkspaceService(): Promise<IWorkspaceContextService> {
		return new SimpleWorkspaceService();
	}

	private async createStorageService(): Promise<SimpleStorageService> {
		return new SimpleStorageService();
	}
}

export function main(configuration: any /*INativeWindowConfiguration*/): Promise<void> {
	const workbench = new DesktopMain(configuration);

	return workbench.open();
}
