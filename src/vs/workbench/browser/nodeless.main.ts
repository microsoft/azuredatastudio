/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mark } from 'vs/base/common/performance';
import { domContentLoaded, addDisposableListener, EventType } from 'vs/base/browser/dom';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ILogService } from 'vs/platform/log/common/log';
import { Disposable } from 'vs/base/common/lifecycle';
import { SimpleLogService, SimpleProductService, SimpleWorkbenchEnvironmentService } from 'vs/workbench/browser/nodeless.simpleservices';
import { Workbench } from 'vs/workbench/browser/workbench';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IProductService } from 'vs/platform/product/common/product';
import { RemoteAuthorityResolverService } from 'vs/platform/remote/browser/remoteAuthorityResolverService';
import { IRemoteAuthorityResolverService } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { IFileService } from 'vs/platform/files/common/files';
import { FileService3 } from 'vs/workbench/services/files2/browser/fileService2';

class CodeRendererMain extends Disposable {

	private workbench: Workbench;

	open(): Promise<void> {
		const services = this.initServices();

		return domContentLoaded().then(() => {
			mark('willStartWorkbench');

			// Create Workbench
			this.workbench = new Workbench(
				document.body,
				services.serviceCollection,
				services.logService
			);

			// Layout
			this._register(addDisposableListener(window, EventType.RESIZE, () => this.workbench.layout()));

			// Workbench Lifecycle
			this._register(this.workbench.onShutdown(() => this.dispose()));

			// Startup
			this.workbench.startup();
		});
	}

	private initServices(): { serviceCollection: ServiceCollection, logService: ILogService } {
		const serviceCollection = new ServiceCollection();

		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		// NOTE: DO NOT ADD ANY OTHER SERVICE INTO THE COLLECTION HERE.
		// CONTRIBUTE IT VIA WORKBENCH.MAIN.TS AND registerSingleton().
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

		// Log
		const logService = new SimpleLogService();
		serviceCollection.set(ILogService, logService);

		// Environment
		const environmentService = new SimpleWorkbenchEnvironmentService();
		serviceCollection.set(IWorkbenchEnvironmentService, environmentService);

		// Product
		const productService = new SimpleProductService();
		serviceCollection.set(IProductService, productService);

		// Remote
		const remoteAuthorityResolverService = new RemoteAuthorityResolverService();
		serviceCollection.set(IRemoteAuthorityResolverService, remoteAuthorityResolverService);

		// Files
		const fileService = this._register(new FileService3(logService));
		serviceCollection.set(IFileService, fileService);

		return { serviceCollection, logService };
	}
}

export function main(): Promise<void> {
	const renderer = new CodeRendererMain();

	return renderer.open();
}
