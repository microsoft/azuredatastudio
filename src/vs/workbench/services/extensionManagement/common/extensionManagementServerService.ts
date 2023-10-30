/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { ExtensionInstallLocation, IExtensionManagementServer, IExtensionManagementServerService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { Schemas } from 'vs/base/common/network';
import { IChannel } from 'vs/base/parts/ipc/common/ipc';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ILabelService } from 'vs/platform/label/common/label';
import { isWeb } from 'vs/base/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { WebExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/webExtensionManagementService';
import { IExtension } from 'vs/platform/extensions/common/extensions';
import { RemoteExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/remoteExtensionManagementService';

export class ExtensionManagementServerService implements IExtensionManagementServerService {

	declare readonly _serviceBrand: undefined;

	readonly localExtensionManagementServer: IExtensionManagementServer | null = null;
	readonly remoteExtensionManagementServer: IExtensionManagementServer | null = null;
	readonly webExtensionManagementServer: IExtensionManagementServer | null = null;

	constructor(
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@ILabelService labelService: ILabelService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		const remoteAgentConnection = remoteAgentService.getConnection();
		if (remoteAgentConnection) {
			const extensionManagementService = instantiationService.createInstance(RemoteExtensionManagementService, remoteAgentConnection.getChannel<IChannel>('extensions'));
			this.remoteExtensionManagementServer = {
				id: 'remote',
				extensionManagementService,
				get label() { return labelService.getHostLabel(Schemas.vscodeRemote, remoteAgentConnection!.remoteAuthority) || localize('remote', "Remote"); },
			};
		}
		if (isWeb) {
			const extensionManagementService = instantiationService.createInstance(WebExtensionManagementService);
			this.webExtensionManagementServer = {
				id: 'web',
				extensionManagementService,
				label: localize('browser', "Browser"),
			};
		}
	}

	getExtensionManagementServer(extension: IExtension): IExtensionManagementServer {
		if (extension.location.scheme === Schemas.vscodeRemote) {
			return this.remoteExtensionManagementServer!;
		}
		if (this.webExtensionManagementServer) {
			return this.webExtensionManagementServer;
		}
		throw new Error(`Invalid Extension ${extension.location}`);
	}

	getExtensionInstallLocation(extension: IExtension): ExtensionInstallLocation | null {
		const server = this.getExtensionManagementServer(extension);
		return server === this.remoteExtensionManagementServer ? ExtensionInstallLocation.Remote : ExtensionInstallLocation.Web;
	}
}

registerSingleton(IExtensionManagementServerService, ExtensionManagementServerService, InstantiationType.Delayed);
