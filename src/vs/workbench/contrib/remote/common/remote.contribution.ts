/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ILabelService, ResourceLabelFormatting } from 'vs/platform/label/common/label';
import { OperatingSystem, isWeb } from 'vs/base/common/platform';
import { Schemas } from 'vs/base/common/network';
import { IRemoteAgentService, RemoteExtensionLogFileName } from 'vs/workbench/services/remote/common/remoteAgentService';
import { ILogService } from 'vs/platform/log/common/log';
import { LoggerChannelClient } from 'vs/platform/log/common/logIpc';
import { IOutputChannelRegistry, Extensions as OutputExt, } from 'vs/workbench/services/output/common/output';
import { localize } from 'vs/nls';
import { joinPath } from 'vs/base/common/resources';
import { Disposable } from 'vs/base/common/lifecycle';
import { TunnelFactoryContribution } from 'vs/workbench/contrib/remote/common/tunnelFactory';
import { ShowCandidateContribution } from 'vs/workbench/contrib/remote/common/showCandidate';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';

export class LabelContribution implements IWorkbenchContribution {
	constructor(
		@ILabelService private readonly labelService: ILabelService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService) {
		this.registerFormatters();
	}

	private registerFormatters(): void {
		this.remoteAgentService.getEnvironment().then(remoteEnvironment => {
			if (remoteEnvironment) {
				const formatting: ResourceLabelFormatting = {
					label: '${path}',
					separator: remoteEnvironment.os === OperatingSystem.Windows ? '\\' : '/',
					tildify: remoteEnvironment.os !== OperatingSystem.Windows,
					normalizeDriveLetter: remoteEnvironment.os === OperatingSystem.Windows,
					workspaceSuffix: isWeb ? undefined : Schemas.vscodeRemote
				};
				this.labelService.registerFormatter({
					scheme: Schemas.vscodeRemote,
					formatting
				});
				this.labelService.registerFormatter({
					scheme: Schemas.userData,
					formatting
				});
			}
		});
	}
}

class RemoteChannelsContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@ILogService logService: ILogService,
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
	) {
		super();
		const updateRemoteLogLevel = () => {
			const connection = remoteAgentService.getConnection();
			if (!connection) {
				return;
			}
			connection.withChannel('logger', (channel) => LoggerChannelClient.setLevel(channel, logService.getLevel()));
		};
		updateRemoteLogLevel();
		this._register(logService.onDidChangeLogLevel(updateRemoteLogLevel));
	}
}

class RemoteLogOutputChannels implements IWorkbenchContribution {

	constructor(
		@IRemoteAgentService remoteAgentService: IRemoteAgentService
	) {
		remoteAgentService.getEnvironment().then(remoteEnv => {
			if (remoteEnv) {
				const outputChannelRegistry = Registry.as<IOutputChannelRegistry>(OutputExt.OutputChannels);
				outputChannelRegistry.registerChannel({ id: 'remoteExtensionLog', label: localize('remoteExtensionLog', "Remote Server"), file: joinPath(remoteEnv.logsPath, `${RemoteExtensionLogFileName}.log`), log: true });
			}
		});
	}
}

const workbenchContributionsRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(LabelContribution, LifecyclePhase.Starting);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteChannelsContribution, LifecyclePhase.Starting);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteLogOutputChannels, LifecyclePhase.Restored);
workbenchContributionsRegistry.registerWorkbenchContribution(TunnelFactoryContribution, LifecyclePhase.Ready);
workbenchContributionsRegistry.registerWorkbenchContribution(ShowCandidateContribution, LifecyclePhase.Ready);

const extensionKindSchema: IJSONSchema = {
	type: 'string',
	enum: [
		'ui',
		'workspace',
		'web'
	],
	enumDescriptions: [
		localize('ui', "UI extension kind. In a remote window, such extensions are enabled only when available on the local machine."),
		localize('workspace', "Workspace extension kind. In a remote window, such extensions are enabled only when available on the remote."),
		localize('web', "Web worker extension kind. Such an extension can execute in a web worker extension host.")
	],
};

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerConfiguration({
		id: 'remote',
		title: localize('remote', "Remote"),
		type: 'object',
		properties: {
			'remote.extensionKind': {
				type: 'object',
				markdownDescription: localize('remote.extensionKind', "Override the kind of an extension. `ui` extensions are installed and run on the local machine while `workspace` extensions are run on the remote. By overriding an extension's default kind using this setting, you specify if that extension should be installed and enabled locally or remotely."),
				patternProperties: {
					'([a-z0-9A-Z][a-z0-9\-A-Z]*)\\.([a-z0-9A-Z][a-z0-9\-A-Z]*)$': {
						oneOf: [{ type: 'array', items: extensionKindSchema }, extensionKindSchema],
						default: ['ui'],
					},
				},
				default: {
					'pub.name': ['ui']
				}
			},
			'remote.restoreForwardedPorts': {
				type: 'boolean',
				markdownDescription: localize('remote.restoreForwardedPorts', "Restores the ports you forwarded in a workspace."),
				default: true
			},
			'remote.autoForwardPorts': {
				type: 'boolean',
				markdownDescription: localize('remote.autoForwardPorts', "When enabled, new running processes are detected and ports that they listen on are automatically forwarded."),
				default: true
			},
			'remote.portsAttributes': {
				type: 'object',
				patternProperties: {
					'^\\d+(\\-\\d+)?$': {
						type: 'object',
						description: localize('remote.portsAttributes.port', "A port, or range of ports (ex. \"40000-55000\") that the attributes should apply to"),
						properties: {
							'onAutoForward': {
								type: 'string',
								enum: ['notify', 'openBrowser', 'openPreview', 'silent', 'ignore'],
								enumDescriptions: [
									localize('remote.portsAttributes.notify', "Shows a notification when a port is automatically forwarded."),
									localize('remote.portsAttributes.openBrowser', "Opens the browser when the port is automatically forwarded. Depending on your settings, this could open an embedded browser."),
									localize('remote.portsAttributes.openPreview', "Opens a preview in the same window when the port is automatically forwarded."),
									localize('remote.portsAttributes.silent', "Shows no notification and takes no action when this port is automatically forwarded."),
									localize('remote.portsAttributes.ignore', "This port will not be automatically forwarded.")
								],
								description: localize('remote.portsAttributes.onForward', "Defines the action that occurs when the port is discovered for automatic forwarding"),
								default: 'notify'
							},
							'elevateIfNeeded': {
								type: 'boolean',
								description: localize('remote.portsAttributes.elevateIfNeeded', "Automatically prompt for elevation (if needed) when this port is forwarded. Elevate is required if the local port is a privileged port."),
								default: false
							},
							'label': {
								type: 'string',
								description: localize('remote.portsAttributes.label', "Label that will be shown in the UI for this port."),
								default: localize('remote.portsAttributes.labelDefault', "Labeled Port")
							}
						},
						default: {
							'label': localize('remote.portsAttributes.labelDefault', "Labeled Port"),
							'onAutoForward': 'notify'
						}
					}
				},
				markdownDescription: localize('remote.portsAttributes', "Set default properties that are applied when a specific port number is forwarded. For example:\n\n```\n\"3000\": {\n  \"label\": \"Labeled Port\"\n},\n\"40000-55000\": {\n  \"onAutoForward\": \"ignore\"\n}\n```"),
				defaultSnippets: [{ body: { '${1:3000}': { label: '${2:My Port}', onAutoForward: 'notify' } } }],
				errorMessage: localize('remote.portsAttributes.patternError', "Must be a port number or a range of port numbers"),
				additionalProperties: false
			}
		}
	});
