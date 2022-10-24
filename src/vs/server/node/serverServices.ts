/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { hostname, release } from 'os';
import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore, toDisposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import * as path from 'vs/base/common/path';
import { IURITransformer } from 'vs/base/common/uriIpc';
import { getMachineId } from 'vs/base/node/id';
import { Promises } from 'vs/base/node/pfs';
import { ClientConnectionEvent, IMessagePassingProtocol, IPCServer, ProxyChannel, StaticRouter } from 'vs/base/parts/ipc/common/ipc';
import { ProtocolConstants } from 'vs/base/parts/ipc/common/ipc.net';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ConfigurationService } from 'vs/platform/configuration/common/configurationService';
import { ICredentialsMainService } from 'vs/platform/credentials/common/credentials';
import { CredentialsWebMainService } from 'vs/platform/credentials/node/credentialsMainService';
import { ExtensionHostDebugBroadcastChannel } from 'vs/platform/debug/common/extensionHostDebugIpc';
import { IDownloadService } from 'vs/platform/download/common/download';
import { DownloadServiceChannelClient } from 'vs/platform/download/common/downloadIpc';
import { IEncryptionMainService } from 'vs/platform/encryption/common/encryptionService';
import { EncryptionMainService } from 'vs/platform/encryption/node/encryptionMainService';
import { IEnvironmentService, INativeEnvironmentService } from 'vs/platform/environment/common/environment';
import { ExtensionGalleryServiceWithNoStorageService } from 'vs/platform/extensionManagement/common/extensionGalleryService';
import { IExtensionGalleryService, IExtensionManagementCLIService, IExtensionManagementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionManagementCLIService } from 'vs/platform/extensionManagement/common/extensionManagementCLIService';
import { ExtensionManagementChannel } from 'vs/platform/extensionManagement/common/extensionManagementIpc';
import { ExtensionManagementService } from 'vs/platform/extensionManagement/node/extensionManagementService';
import { IFileService } from 'vs/platform/files/common/files';
import { FileService } from 'vs/platform/files/common/fileService';
import { DiskFileSystemProvider } from 'vs/platform/files/node/diskFileSystemProvider';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ILocalizationsService } from 'vs/platform/localizations/common/localizations';
import { LocalizationsService } from 'vs/platform/localizations/node/localizations';
import { AbstractLogger, DEFAULT_LOG_LEVEL, getLogLevel, ILogService, LogLevel, LogService, MultiplexLogService } from 'vs/platform/log/common/log';
import { LogLevelChannel } from 'vs/platform/log/common/logIpc';
import { SpdLogLogger } from 'vs/platform/log/node/spdlogLog';
import product from 'vs/platform/product/common/product';
import { IProductService } from 'vs/platform/product/common/productService';
import { RemoteAgentConnectionContext } from 'vs/platform/remote/common/remoteAgentEnvironment';
import { IRequestService } from 'vs/platform/request/common/request';
import { RequestChannel } from 'vs/platform/request/common/requestIpc';
import { RequestService } from 'vs/platform/request/node/requestService';
import { resolveCommonProperties } from 'vs/platform/telemetry/common/commonProperties';
import { ITelemetryService, TelemetryLevel } from 'vs/platform/telemetry/common/telemetry';
import { ITelemetryServiceConfig } from 'vs/platform/telemetry/common/telemetryService';
import { getPiiPathsFromEnvironment, ITelemetryAppender, NullAppender, supportsTelemetry } from 'vs/platform/telemetry/common/telemetryUtils';
import { AppInsightsAppender } from 'vs/platform/telemetry/node/appInsightsAppender';
import ErrorTelemetry from 'vs/platform/telemetry/node/errorTelemetry';
import { IPtyService, TerminalSettingId } from 'vs/platform/terminal/common/terminal';
import { PtyHostService } from 'vs/platform/terminal/node/ptyHostService';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { UriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentityService';
import { RemoteAgentEnvironmentChannel } from 'vs/server/node/remoteAgentEnvironmentImpl';
import { RemoteAgentFileSystemProviderChannel } from 'vs/server/node/remoteFileSystemProviderServer';
import { ServerTelemetryChannel } from 'vs/platform/telemetry/common/remoteTelemetryChannel';
import { IServerTelemetryService, ServerNullTelemetryService, ServerTelemetryService } from 'vs/platform/telemetry/common/serverTelemetryService';
import { RemoteTerminalChannel } from 'vs/server/node/remoteTerminalChannel';
import { createURITransformer } from 'vs/workbench/api/node/uriTransformer';
import { ServerConnectionToken } from 'vs/server/node/serverConnectionToken';
import { ServerEnvironmentService, ServerParsedArgs } from 'vs/server/node/serverEnvironmentService';
import { REMOTE_TERMINAL_CHANNEL_NAME } from 'vs/workbench/contrib/terminal/common/remoteTerminalChannel';
import { RemoteExtensionLogFileName } from 'vs/workbench/services/remote/common/remoteAgentService';
import { REMOTE_FILE_SYSTEM_CHANNEL_NAME } from 'vs/workbench/services/remote/common/remoteFileSystemProviderClient';
import { ExtensionHostStatusService, IExtensionHostStatusService } from 'vs/server/node/extensionHostStatusService';
import { IExtensionsScannerService } from 'vs/platform/extensionManagement/common/extensionsScannerService';
import { ExtensionsScannerService } from 'vs/server/node/extensionsScannerService';

const eventPrefix = 'monacoworkbench';

export async function setupServerServices(connectionToken: ServerConnectionToken, args: ServerParsedArgs, REMOTE_DATA_FOLDER: string, disposables: DisposableStore) {
	const services = new ServiceCollection();
	const socketServer = new SocketServer<RemoteAgentConnectionContext>();

	const productService: IProductService = { _serviceBrand: undefined, ...product };
	services.set(IProductService, productService);

	const environmentService = new ServerEnvironmentService(args, productService);
	services.set(IEnvironmentService, environmentService);
	services.set(INativeEnvironmentService, environmentService);

	const spdLogService = new LogService(new SpdLogLogger(RemoteExtensionLogFileName, path.join(environmentService.logsPath, `${RemoteExtensionLogFileName}.log`), true, false, getLogLevel(environmentService)));
	const logService = new MultiplexLogService([new ServerLogService(getLogLevel(environmentService)), spdLogService]);
	services.set(ILogService, logService);
	setTimeout(() => cleanupOlderLogs(environmentService.logsPath).then(null, err => logService.error(err)), 10000);

	logService.trace(`Remote configuration data at ${REMOTE_DATA_FOLDER}`);
	logService.trace('process arguments:', environmentService.args);
	if (Array.isArray(productService.serverGreeting)) {
		spdLogService.info(`\n\n${productService.serverGreeting.join('\n')}\n\n`);
	}

	// ExtensionHost Debug broadcast service
	socketServer.registerChannel(ExtensionHostDebugBroadcastChannel.ChannelName, new ExtensionHostDebugBroadcastChannel());

	// TODO: @Sandy @Joao need dynamic context based router
	const router = new StaticRouter<RemoteAgentConnectionContext>(ctx => ctx.clientId === 'renderer');
	socketServer.registerChannel('logger', new LogLevelChannel(logService));

	// Files
	const fileService = disposables.add(new FileService(logService));
	services.set(IFileService, fileService);
	fileService.registerProvider(Schemas.file, disposables.add(new DiskFileSystemProvider(logService)));

	const configurationService = new ConfigurationService(environmentService.machineSettingsResource, fileService);
	services.set(IConfigurationService, configurationService);

	const extensionHostStatusService = new ExtensionHostStatusService();
	services.set(IExtensionHostStatusService, extensionHostStatusService);

	// URI Identity
	services.set(IUriIdentityService, new UriIdentityService(fileService));

	// Request
	services.set(IRequestService, new SyncDescriptor(RequestService));

	let appInsightsAppender: ITelemetryAppender = NullAppender;
	const machineId = await getMachineId();
	if (supportsTelemetry(productService, environmentService)) {
		if (productService.aiConfig && productService.aiConfig.asimovKey) {
			appInsightsAppender = new AppInsightsAppender(eventPrefix, null, productService.aiConfig.asimovKey);
			disposables.add(toDisposable(() => appInsightsAppender!.flush())); // Ensure the AI appender is disposed so that it flushes remaining data
		}

		const config: ITelemetryServiceConfig = {
			appenders: [appInsightsAppender],
			commonProperties: resolveCommonProperties(fileService, release(), hostname(), process.arch, productService.commit, productService.version + '-remote', machineId, productService.msftInternalDomains, environmentService.installSourcePath, 'remoteAgent'),
			piiPaths: getPiiPathsFromEnvironment(environmentService)
		};
		const initialTelemetryLevelArg = environmentService.args['telemetry-level'];
		let injectedTelemetryLevel: TelemetryLevel = TelemetryLevel.USAGE;
		// Convert the passed in CLI argument into a telemetry level for the telemetry service
		if (initialTelemetryLevelArg === 'all') {
			injectedTelemetryLevel = TelemetryLevel.USAGE;
		} else if (initialTelemetryLevelArg === 'error') {
			injectedTelemetryLevel = TelemetryLevel.ERROR;
		} else if (initialTelemetryLevelArg === 'crash') {
			injectedTelemetryLevel = TelemetryLevel.CRASH;
		} else if (initialTelemetryLevelArg !== undefined) {
			injectedTelemetryLevel = TelemetryLevel.NONE;
		}
		services.set(IServerTelemetryService, new SyncDescriptor(ServerTelemetryService, [config, injectedTelemetryLevel]));
	} else {
		services.set(IServerTelemetryService, ServerNullTelemetryService);
	}

	services.set(IExtensionGalleryService, new SyncDescriptor(ExtensionGalleryServiceWithNoStorageService));

	const downloadChannel = socketServer.getChannel('download', router);
	services.set(IDownloadService, new DownloadServiceChannelClient(downloadChannel, () => getUriTransformer('renderer') /* TODO: @Sandy @Joao need dynamic context based router */));

	services.set(IExtensionsScannerService, new SyncDescriptor(ExtensionsScannerService));
	services.set(IExtensionManagementService, new SyncDescriptor(ExtensionManagementService));

	const instantiationService: IInstantiationService = new InstantiationService(services);
	services.set(ILocalizationsService, instantiationService.createInstance(LocalizationsService));

	const extensionManagementCLIService = instantiationService.createInstance(ExtensionManagementCLIService);
	services.set(IExtensionManagementCLIService, extensionManagementCLIService);

	const ptyService = instantiationService.createInstance(
		PtyHostService,
		{
			graceTime: ProtocolConstants.ReconnectionGraceTime,
			shortGraceTime: ProtocolConstants.ReconnectionShortGraceTime,
			scrollback: configurationService.getValue<number>(TerminalSettingId.PersistentSessionScrollback) ?? 100
		}
	);
	services.set(IPtyService, ptyService);

	services.set(IEncryptionMainService, new SyncDescriptor(EncryptionMainService, [machineId]));

	services.set(ICredentialsMainService, new SyncDescriptor(CredentialsWebMainService));

	instantiationService.invokeFunction(accessor => {
		const extensionManagementService = accessor.get(IExtensionManagementService);
		const extensionsScannerService = accessor.get(IExtensionsScannerService);
		const remoteExtensionEnvironmentChannel = new RemoteAgentEnvironmentChannel(connectionToken, environmentService, extensionManagementCLIService, logService, extensionHostStatusService, extensionsScannerService);
		socketServer.registerChannel('remoteextensionsenvironment', remoteExtensionEnvironmentChannel);

		const telemetryChannel = new ServerTelemetryChannel(accessor.get(IServerTelemetryService), appInsightsAppender);
		socketServer.registerChannel('telemetry', telemetryChannel);

		socketServer.registerChannel(REMOTE_TERMINAL_CHANNEL_NAME, new RemoteTerminalChannel(environmentService, logService, ptyService, productService, extensionManagementService));

		const remoteFileSystemChannel = new RemoteAgentFileSystemProviderChannel(logService, environmentService);
		socketServer.registerChannel(REMOTE_FILE_SYSTEM_CHANNEL_NAME, remoteFileSystemChannel);

		socketServer.registerChannel('request', new RequestChannel(accessor.get(IRequestService)));

		const channel = new ExtensionManagementChannel(extensionManagementService, (ctx: RemoteAgentConnectionContext) => getUriTransformer(ctx.remoteAuthority));
		socketServer.registerChannel('extensions', channel);

		const encryptionChannel = ProxyChannel.fromService<RemoteAgentConnectionContext>(accessor.get(IEncryptionMainService));
		socketServer.registerChannel('encryption', encryptionChannel);

		const credentialsChannel = ProxyChannel.fromService<RemoteAgentConnectionContext>(accessor.get(ICredentialsMainService));
		socketServer.registerChannel('credentials', credentialsChannel);

		// clean up deprecated extensions
		(extensionManagementService as ExtensionManagementService).removeDeprecatedExtensions();

		disposables.add(new ErrorTelemetry(accessor.get(ITelemetryService)));

		return {
			telemetryService: accessor.get(ITelemetryService)
		};
	});

	return { socketServer, instantiationService };
}

const _uriTransformerCache: { [remoteAuthority: string]: IURITransformer } = Object.create(null);

function getUriTransformer(remoteAuthority: string): IURITransformer {
	if (!_uriTransformerCache[remoteAuthority]) {
		_uriTransformerCache[remoteAuthority] = createURITransformer(remoteAuthority);
	}
	return _uriTransformerCache[remoteAuthority];
}

export class SocketServer<TContext = string> extends IPCServer<TContext> {

	private _onDidConnectEmitter: Emitter<ClientConnectionEvent>;

	constructor() {
		const emitter = new Emitter<ClientConnectionEvent>();
		super(emitter.event);
		this._onDidConnectEmitter = emitter;
	}

	public acceptConnection(protocol: IMessagePassingProtocol, onDidClientDisconnect: Event<void>): void {
		this._onDidConnectEmitter.fire({ protocol, onDidClientDisconnect });
	}
}

class ServerLogService extends AbstractLogger implements ILogService {
	_serviceBrand: undefined;
	private useColors: boolean;

	constructor(logLevel: LogLevel = DEFAULT_LOG_LEVEL) {
		super();
		this.setLevel(logLevel);
		this.useColors = Boolean(process.stdout.isTTY);
	}

	trace(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Trace) {
			if (this.useColors) {
				console.log(`\x1b[90m[${now()}]\x1b[0m`, message, ...args);
			} else {
				console.log(`[${now()}]`, message, ...args);
			}
		}
	}

	debug(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Debug) {
			if (this.useColors) {
				console.log(`\x1b[90m[${now()}]\x1b[0m`, message, ...args);
			} else {
				console.log(`[${now()}]`, message, ...args);
			}
		}
	}

	info(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Info) {
			if (this.useColors) {
				console.log(`\x1b[90m[${now()}]\x1b[0m`, message, ...args);
			} else {
				console.log(`[${now()}]`, message, ...args);
			}
		}
	}

	warn(message: string | Error, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Warning) {
			if (this.useColors) {
				console.warn(`\x1b[93m[${now()}]\x1b[0m`, message, ...args);
			} else {
				console.warn(`[${now()}]`, message, ...args);
			}
		}
	}

	error(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Error) {
			if (this.useColors) {
				console.error(`\x1b[91m[${now()}]\x1b[0m`, message, ...args);
			} else {
				console.error(`[${now()}]`, message, ...args);
			}
		}
	}

	critical(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Critical) {
			if (this.useColors) {
				console.error(`\x1b[90m[${now()}]\x1b[0m`, message, ...args);
			} else {
				console.error(`[${now()}]`, message, ...args);
			}
		}
	}

	override dispose(): void {
		// noop
	}

	flush(): void {
		// noop
	}
}

function now(): string {
	const date = new Date();
	return `${twodigits(date.getHours())}:${twodigits(date.getMinutes())}:${twodigits(date.getSeconds())}`;
}

function twodigits(n: number): string {
	if (n < 10) {
		return `0${n}`;
	}
	return String(n);
}

/**
 * Cleans up older logs, while keeping the 10 most recent ones.
 */
async function cleanupOlderLogs(logsPath: string): Promise<void> {
	const currentLog = path.basename(logsPath);
	const logsRoot = path.dirname(logsPath);
	const children = await Promises.readdir(logsRoot);
	const allSessions = children.filter(name => /^\d{8}T\d{6}$/.test(name));
	const oldSessions = allSessions.sort().filter((d) => d !== currentLog);
	const toDelete = oldSessions.slice(0, Math.max(0, oldSessions.length - 9));

	await Promise.all(toDelete.map(name => Promises.rm(path.join(logsRoot, name))));
}
