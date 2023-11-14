/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { Categories } from 'vs/platform/action/common/actionCommonCategories';
import { Action2, registerAction2 } from 'vs/platform/actions/common/actions';
import { SetLogLevelAction } from 'vs/workbench/contrib/logs/common/logsActions';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IFileService, whenProviderRegistered } from 'vs/platform/files/common/files';
import { IOutputChannelRegistry, IOutputService, Extensions } from 'vs/workbench/services/output/common/output';
import { Disposable, toDisposable } from 'vs/base/common/lifecycle';
import { CONTEXT_LOG_LEVEL, ILogService, ILoggerResource, ILoggerService, LogLevel, LogLevelToString, isLogLevel } from 'vs/platform/log/common/log';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { Event } from 'vs/base/common/event';
import { windowLogId, showWindowLogActionId } from 'vs/workbench/services/log/common/logConstants';
import { createCancelablePromise, timeout } from 'vs/base/common/async';
import { CancellationError, getErrorMessage, isCancellationError } from 'vs/base/common/errors';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IDefaultLogLevelsService } from 'vs/workbench/contrib/logs/common/defaultLogLevels';
import { ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { CounterSet } from 'vs/base/common/map';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { Schemas } from 'vs/base/common/network';

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: SetLogLevelAction.ID,
			title: SetLogLevelAction.TITLE,
			category: Categories.Developer,
			f1: true
		});
	}
	run(servicesAccessor: ServicesAccessor): Promise<void> {
		return servicesAccessor.get(IInstantiationService).createInstance(SetLogLevelAction, SetLogLevelAction.ID, SetLogLevelAction.TITLE.value).run();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.setDefaultLogLevel',
			title: { value: nls.localize('setDefaultLogLevel', "Set Default Log Level"), original: 'Set Default Log Level' },
			category: Categories.Developer,
		});
	}
	run(servicesAccessor: ServicesAccessor, logLevel: LogLevel, extensionId?: string): Promise<void> {
		return servicesAccessor.get(IDefaultLogLevelsService).setDefaultLogLevel(logLevel, extensionId);
	}
});

class LogOutputChannels extends Disposable implements IWorkbenchContribution {

	private readonly contextKeys = new CounterSet<string>();
	private readonly outputChannelRegistry = Registry.as<IOutputChannelRegistry>(Extensions.OutputChannels);

	constructor(
		@ILogService private readonly logService: ILogService,
		@ILoggerService private readonly loggerService: ILoggerService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IFileService private readonly fileService: IFileService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
	) {
		super();
		const contextKey = CONTEXT_LOG_LEVEL.bindTo(contextKeyService);
		contextKey.set(LogLevelToString(loggerService.getLogLevel()));
		loggerService.onDidChangeLogLevel(e => {
			if (isLogLevel(e)) {
				contextKey.set(LogLevelToString(loggerService.getLogLevel()));
			}
		});

		this.onDidAddLoggers(loggerService.getRegisteredLoggers());
		this._register(loggerService.onDidChangeLoggers(({ added, removed }) => {
			this.onDidAddLoggers(added);
			this.onDidRemoveLoggers(removed);
		}));
		this._register(loggerService.onDidChangeVisibility(([resource, visibility]) => {
			const logger = loggerService.getRegisteredLogger(resource);
			if (logger) {
				if (visibility) {
					this.registerLogChannel(logger);
				} else {
					this.outputChannelRegistry.removeChannel(logger.id);
				}
			}
		}));
		this.registerShowWindowLogAction();
		this._register(Event.filter(contextKeyService.onDidChangeContext, e => e.affectsSome(this.contextKeys))(() => this.onDidChangeContext()));
	}

	private onDidAddLoggers(loggers: Iterable<ILoggerResource>): void {
		for (const logger of loggers) {
			if (logger.when) {
				const contextKeyExpr = ContextKeyExpr.deserialize(logger.when);
				if (contextKeyExpr) {
					for (const key of contextKeyExpr.keys()) {
						this.contextKeys.add(key);
					}
					if (!this.contextKeyService.contextMatchesRules(contextKeyExpr)) {
						continue;
					}
				}
			}
			if (logger.hidden) {
				continue;
			}
			this.registerLogChannel(logger);
		}
	}

	private onDidChangeContext(): void {
		for (const logger of this.loggerService.getRegisteredLoggers()) {
			if (logger.when) {
				if (this.contextKeyService.contextMatchesRules(ContextKeyExpr.deserialize(logger.when))) {
					this.registerLogChannel(logger);
				} else {
					this.outputChannelRegistry.removeChannel(logger.id);
				}
			}
		}
	}

	private onDidRemoveLoggers(loggers: Iterable<ILoggerResource>): void {
		for (const logger of loggers) {
			if (logger.when) {
				const contextKeyExpr = ContextKeyExpr.deserialize(logger.when);
				if (contextKeyExpr) {
					for (const key of contextKeyExpr.keys()) {
						this.contextKeys.delete(key);
					}
				}
			}
			this.outputChannelRegistry.removeChannel(logger.id);
		}
	}

	private registerLogChannel(logger: ILoggerResource): void {
		const channel = this.outputChannelRegistry.getChannel(logger.id);
		if (channel && this.uriIdentityService.extUri.isEqual(channel.file, logger.resource)) {
			return;
		}
		const promise = createCancelablePromise(async token => {
			await whenProviderRegistered(logger.resource, this.fileService);
			try {
				await this.whenFileExists(logger.resource, 1, token);
				const channel = this.outputChannelRegistry.getChannel(logger.id);
				if (channel?.file?.scheme === Schemas.vscodeRemote) {
					// Re-register the channel with new id and name
					this.outputChannelRegistry.removeChannel(channel.id);
					this.outputChannelRegistry.registerChannel({ id: `${channel.id}.remote`, label: nls.localize('remote name', "{0} (Remote)", channel.label), file: channel.file, log: channel.log, extensionId: channel.extensionId });
				}
				const hasToAppendRemote = channel && logger.resource.scheme === Schemas.vscodeRemote;
				const id = hasToAppendRemote ? `${logger.id}.remote` : logger.id;
				const label = hasToAppendRemote ? nls.localize('remote name', "{0} (Remote)", logger.name ?? logger.id) : logger.name ?? logger.id;
				this.outputChannelRegistry.registerChannel({ id, label, file: logger.resource, log: true, extensionId: logger.extensionId });
			} catch (error) {
				if (!isCancellationError(error)) {
					this.logService.error('Error while registering log channel', logger.resource.toString(), getErrorMessage(error));
				}
			}
		});
		this._register(toDisposable(() => promise.cancel()));
	}

	private async whenFileExists(file: URI, trial: number, token: CancellationToken): Promise<void> {
		const exists = await this.fileService.exists(file);
		if (exists) {
			return;
		}
		if (token.isCancellationRequested) {
			throw new CancellationError();
		}
		if (trial > 10) {
			throw new Error(`Timed out while waiting for file to be created`);
		}
		this.logService.debug(`[Registering Log Channel] File does not exist. Waiting for 1s to retry.`, file.toString());
		await timeout(1000, token);
		await this.whenFileExists(file, trial + 1, token);
	}

	private registerShowWindowLogAction(): void {
		registerAction2(class ShowWindowLogAction extends Action2 {
			constructor() {
				super({
					id: showWindowLogActionId,
					title: { value: nls.localize('show window log', "Show Window Log"), original: 'Show Window Log' },
					category: Categories.Developer,
					f1: true
				});
			}
			async run(servicesAccessor: ServicesAccessor): Promise<void> {
				const outputService = servicesAccessor.get(IOutputService);
				outputService.showChannel(windowLogId);
			}
		});
	}

}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(LogOutputChannels, LifecyclePhase.Restored);
