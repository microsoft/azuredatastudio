/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from 'vs/base/common/network';
import { isWeb } from 'vs/base/common/platform';
import { isString } from 'vs/base/common/types';
import { URI, UriComponents } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { IExtensionGalleryService, IExtensionManagementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionManagementCLI } from 'vs/platform/extensionManagement/common/extensionManagementCLI';
import { getExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { IExtensionManifest } from 'vs/platform/extensions/common/extensions';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ILabelService } from 'vs/platform/label/common/label';
import { AbstractMessageLogger, ILogger, LogLevel } from 'vs/platform/log/common/log';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IOpenWindowOptions, IWindowOpenable } from 'vs/platform/window/common/window';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IExtensionManagementServerService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { IExtensionManifestPropertiesService } from 'vs/workbench/services/extensions/common/extensionManifestPropertiesService';


// this class contains the commands that the CLI server is reying on

CommandsRegistry.registerCommand('_remoteCLI.openExternal', function (accessor: ServicesAccessor, uri: UriComponents | string): Promise<boolean> {
	const openerService = accessor.get(IOpenerService);
	return openerService.open(isString(uri) ? uri : URI.revive(uri), { openExternal: true, allowTunneling: true });
});

CommandsRegistry.registerCommand('_remoteCLI.windowOpen', function (accessor: ServicesAccessor, toOpen: IWindowOpenable[], options: IOpenWindowOptions) {
	const commandService = accessor.get(ICommandService);
	if (!toOpen.length) {
		return commandService.executeCommand('_files.newWindow', options);
	}
	return commandService.executeCommand('_files.windowOpen', toOpen, options);
});

CommandsRegistry.registerCommand('_remoteCLI.getSystemStatus', function (accessor: ServicesAccessor): Promise<string | undefined> {
	const commandService = accessor.get(ICommandService);
	return commandService.executeCommand<string>('_issues.getSystemStatus');
});

interface ManageExtensionsArgs {
	list?: { showVersions?: boolean; category?: string };
	install?: (string | URI)[];
	uninstall?: string[];
	force?: boolean;
}

CommandsRegistry.registerCommand('_remoteCLI.manageExtensions', async function (accessor: ServicesAccessor, args: ManageExtensionsArgs): Promise<string | undefined> {
	const instantiationService = accessor.get(IInstantiationService);
	const extensionManagementServerService = accessor.get(IExtensionManagementServerService);
	const remoteExtensionManagementService = extensionManagementServerService.remoteExtensionManagementServer?.extensionManagementService;
	if (!remoteExtensionManagementService) {
		return undefined; // {{SQL CARBON EDIT}} Strict nulls
	}

	const lines: string[] = [];
	const logger = new class extends AbstractMessageLogger {
		protected override log(level: LogLevel, message: string): void {
			lines.push(message);
		}
	}();
	const cliService = instantiationService.createChild(new ServiceCollection([IExtensionManagementService, remoteExtensionManagementService])).createInstance(RemoteExtensionManagementCLI, logger);

	if (args.list) {
		await cliService.listExtensions(!!args.list.showVersions, args.list.category, undefined);
	} else {
		const revive = (inputs: (string | UriComponents)[]) => inputs.map(input => isString(input) ? input : URI.revive(input));
		if (Array.isArray(args.install) && args.install.length) {
			try {
				await cliService.installExtensions(revive(args.install), [], { isMachineScoped: true }, !!args.force);
			} catch (e) {
				lines.push(e.message);
			}
		}
		if (Array.isArray(args.uninstall) && args.uninstall.length) {
			try {
				await cliService.uninstallExtensions(revive(args.uninstall), !!args.force, undefined);
			} catch (e) {
				lines.push(e.message);
			}
		}
	}
	return lines.join('\n');
});

class RemoteExtensionManagementCLI extends ExtensionManagementCLI {

	private _location: string | undefined;

	constructor(
		logger: ILogger,
		@IExtensionManagementService extensionManagementService: IExtensionManagementService,
		@IExtensionGalleryService extensionGalleryService: IExtensionGalleryService,
		@ILabelService labelService: ILabelService,
		@IWorkbenchEnvironmentService envService: IWorkbenchEnvironmentService,
		@IExtensionManifestPropertiesService private readonly _extensionManifestPropertiesService: IExtensionManifestPropertiesService,
	) {
		super(logger, extensionManagementService, extensionGalleryService);

		const remoteAuthority = envService.remoteAuthority;
		this._location = remoteAuthority ? labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority) : undefined;
	}

	protected override get location(): string | undefined {
		return this._location;
	}

	protected override validateExtensionKind(manifest: IExtensionManifest): boolean {
		if (!this._extensionManifestPropertiesService.canExecuteOnWorkspace(manifest)
			// Web extensions installed on remote can be run in web worker extension host
			&& !(isWeb && this._extensionManifestPropertiesService.canExecuteOnWeb(manifest))) {
			this.logger.info(localize('cannot be installed', "Cannot install the '{0}' extension because it is declared to not run in this setup.", getExtensionId(manifest.publisher, manifest.name)));
			return false;
		}
		return true;
	}
}
