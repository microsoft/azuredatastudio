/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import { IMessagePassingProtocol } from 'vs/base/parts/ipc/common/ipc';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { ILabelService } from 'vs/platform/label/common/label';
import { ILogService } from 'vs/platform/log/common/log';
import { connectRemoteAgentExtensionHost, IRemoteExtensionHostStartParams, IConnectionOptions, ISocketFactory } from 'vs/platform/remote/common/remoteAgentConnection';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IInitData, UIKind } from 'vs/workbench/api/common/extHost.protocol';
import { MessageType, createMessageOfType, isMessageOfType } from 'vs/workbench/services/extensions/common/extensionHostProtocol';
import { IExtensionHostStarter, ExtensionHostLogFileName } from 'vs/workbench/services/extensions/common/extensions';
import { parseExtensionDevOptions } from 'vs/workbench/services/extensions/common/extensionDevOptions';
import { IRemoteAgentEnvironment } from 'vs/platform/remote/common/remoteAgentEnvironment';
import { IRemoteAuthorityResolverService, IRemoteConnectionData } from 'vs/platform/remote/common/remoteAuthorityResolver';
import * as platform from 'vs/base/common/platform';
import { Schemas } from 'vs/base/common/network';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { PersistentProtocol } from 'vs/base/parts/ipc/common/ipc.net';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { VSBuffer } from 'vs/base/common/buffer';
import { IExtensionHostDebugService } from 'vs/platform/debug/common/extensionHostDebug';
import { IProductService } from 'vs/platform/product/common/productService';
import { ISignService } from 'vs/platform/sign/common/sign';
import { joinPath } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { Registry } from 'vs/platform/registry/common/platform';
import { IOutputChannelRegistry, Extensions } from 'vs/workbench/services/output/common/output';
import { localize } from 'vs/nls';

export interface IRemoteInitData {
	readonly connectionData: IRemoteConnectionData | null;
	readonly remoteEnvironment: IRemoteAgentEnvironment;
}

export interface IInitDataProvider {
	readonly remoteAuthority: string;
	getInitData(): Promise<IRemoteInitData>;
}

export class RemoteExtensionHostClient extends Disposable implements IExtensionHostStarter {

	private _onExit: Emitter<[number, string | null]> = this._register(new Emitter<[number, string | null]>());
	public readonly onExit: Event<[number, string | null]> = this._onExit.event;

	private _protocol: PersistentProtocol | null;

	private readonly _isExtensionDevHost: boolean;

	private _terminating: boolean;

	constructor(
		private readonly _allExtensions: Promise<IExtensionDescription[]>,
		private readonly _initDataProvider: IInitDataProvider,
		private readonly _socketFactory: ISocketFactory,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@IWorkbenchEnvironmentService private readonly _environmentService: IWorkbenchEnvironmentService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@ILifecycleService private readonly _lifecycleService: ILifecycleService,
		@ILogService private readonly _logService: ILogService,
		@ILabelService private readonly _labelService: ILabelService,
		@IRemoteAuthorityResolverService private readonly remoteAuthorityResolverService: IRemoteAuthorityResolverService,
		@IExtensionHostDebugService private readonly _extensionHostDebugService: IExtensionHostDebugService,
		@IProductService private readonly _productService: IProductService,
		@ISignService private readonly _signService: ISignService
	) {
		super();
		this._protocol = null;
		this._terminating = false;

		this._register(this._lifecycleService.onShutdown(reason => this.dispose()));

		const devOpts = parseExtensionDevOptions(this._environmentService);
		this._isExtensionDevHost = devOpts.isExtensionDevHost;
	}

	public start(): Promise<IMessagePassingProtocol> {
		const options: IConnectionOptions = {
			commit: this._productService.commit,
			socketFactory: this._socketFactory,
			addressProvider: {
				getAddress: async () => {
					const { authority } = await this.remoteAuthorityResolverService.resolveAuthority(this._initDataProvider.remoteAuthority);
					return { host: authority.host, port: authority.port };
				}
			},
			signService: this._signService,
			logService: this._logService
		};
		return this.remoteAuthorityResolverService.resolveAuthority(this._initDataProvider.remoteAuthority).then((resolverResult) => {

			const startParams: IRemoteExtensionHostStartParams = {
				language: platform.language,
				debugId: this._environmentService.debugExtensionHost.debugId,
				break: this._environmentService.debugExtensionHost.break,
				port: this._environmentService.debugExtensionHost.port,
				env: resolverResult.options && resolverResult.options.extensionHostEnv
			};

			const extDevLocs = this._environmentService.extensionDevelopmentLocationURI;

			let debugOk = true;
			if (extDevLocs && extDevLocs.length > 0) {
				// TODO@AW: handles only first path in array
				if (extDevLocs[0].scheme === Schemas.file) {
					debugOk = false;
				}
			}

			if (!debugOk) {
				startParams.break = false;
			}

			return connectRemoteAgentExtensionHost(options, startParams).then(result => {
				let { protocol, debugPort } = result;
				const isExtensionDevelopmentDebug = typeof debugPort === 'number';
				if (debugOk && this._environmentService.isExtensionDevelopment && this._environmentService.debugExtensionHost.debugId && debugPort) {
					this._extensionHostDebugService.attachSession(this._environmentService.debugExtensionHost.debugId, debugPort, this._initDataProvider.remoteAuthority);
				}

				protocol.onClose(() => {
					this._onExtHostConnectionLost();
				});

				protocol.onSocketClose(() => {
					if (this._isExtensionDevHost) {
						this._onExtHostConnectionLost();
					}
				});

				// 1) wait for the incoming `ready` event and send the initialization data.
				// 2) wait for the incoming `initialized` event.
				return new Promise<IMessagePassingProtocol>((resolve, reject) => {

					let handle = setTimeout(() => {
						reject('timeout');
					}, 60 * 1000);

					let logFile: URI;

					const disposable = protocol.onMessage(msg => {

						if (isMessageOfType(msg, MessageType.Ready)) {
							// 1) Extension Host is ready to receive messages, initialize it
							this._createExtHostInitData(isExtensionDevelopmentDebug).then(data => {
								logFile = data.logFile;
								protocol.send(VSBuffer.fromString(JSON.stringify(data)));
							});
							return;
						}

						if (isMessageOfType(msg, MessageType.Initialized)) {
							// 2) Extension Host is initialized

							clearTimeout(handle);

							// stop listening for messages here
							disposable.dispose();

							// Register log channel for remote exthost log
							Registry.as<IOutputChannelRegistry>(Extensions.OutputChannels).registerChannel({ id: 'remoteExtHostLog', label: localize('remote extension host Log', "Remote Extension Host"), file: logFile, log: true });

							// release this promise
							this._protocol = protocol;
							resolve(protocol);

							return;
						}

						console.error(`received unexpected message during handshake phase from the extension host: `, msg);
					});

				});
			});
		});
	}

	private _onExtHostConnectionLost(): void {

		if (this._isExtensionDevHost && this._environmentService.debugExtensionHost.debugId) {
			this._extensionHostDebugService.close(this._environmentService.debugExtensionHost.debugId);
		}

		if (this._terminating) {
			// Expected termination path (we asked the process to terminate)
			return;
		}

		this._onExit.fire([0, null]);
	}

	private _createExtHostInitData(isExtensionDevelopmentDebug: boolean): Promise<IInitData> {
		return Promise.all([this._allExtensions, this._telemetryService.getTelemetryInfo(), this._initDataProvider.getInitData()]).then(([allExtensions, telemetryInfo, remoteInitData]) => {
			// Collect all identifiers for extension ids which can be considered "resolved"
			const resolvedExtensions = allExtensions.filter(extension => !extension.main).map(extension => extension.identifier);
			const hostExtensions = allExtensions.filter(extension => extension.main && extension.api === 'none').map(extension => extension.identifier);
			const workspace = this._contextService.getWorkspace();
			const remoteEnv = remoteInitData.remoteEnvironment;
			const r: IInitData = {
				commit: this._productService.commit,
				version: this._productService.version,
				vscodeVersion: this._productService.vscodeVersion, // {{SQL CARBON EDIT}} add vscode version
				parentPid: remoteEnv.pid,
				environment: {
					isExtensionDevelopmentDebug,
					appRoot: remoteEnv.appRoot,
					appSettingsHome: remoteEnv.appSettingsHome,
					appName: this._productService.nameLong,
					appUriScheme: this._productService.urlProtocol,
					appLanguage: platform.language,
					extensionDevelopmentLocationURI: this._environmentService.extensionDevelopmentLocationURI,
					extensionTestsLocationURI: this._environmentService.extensionTestsLocationURI,
					globalStorageHome: remoteEnv.globalStorageHome,
					userHome: remoteEnv.userHome,
					webviewResourceRoot: this._environmentService.webviewResourceRoot,
					webviewCspSource: this._environmentService.webviewCspSource,
				},
				workspace: this._contextService.getWorkbenchState() === WorkbenchState.EMPTY ? null : {
					configuration: workspace.configuration,
					id: workspace.id,
					name: this._labelService.getWorkspaceLabel(workspace)
				},
				remote: {
					isRemote: true,
					authority: this._initDataProvider.remoteAuthority,
					connectionData: remoteInitData.connectionData
				},
				resolvedExtensions: resolvedExtensions,
				hostExtensions: hostExtensions,
				extensions: remoteEnv.extensions,
				telemetryInfo,
				logLevel: this._logService.getLevel(),
				logsLocation: remoteEnv.extensionHostLogsPath,
				logFile: joinPath(remoteEnv.extensionHostLogsPath, `${ExtensionHostLogFileName}.log`),
				autoStart: true,
				uiKind: platform.isWeb ? UIKind.Web : UIKind.Desktop
			};
			return r;
		});
	}

	getInspectPort(): number | undefined {
		return undefined;
	}

	enableInspectPort(): Promise<boolean> {
		return Promise.resolve(false);
	}

	dispose(): void {
		super.dispose();

		this._terminating = true;

		if (this._protocol) {
			// Send the extension host a request to terminate itself
			// (graceful termination)
			const socket = this._protocol.getSocket();
			this._protocol.send(createMessageOfType(MessageType.Terminate));
			this._protocol.sendDisconnect();
			this._protocol.dispose();
			socket.end();
			this._protocol = null;
		}
	}
}
