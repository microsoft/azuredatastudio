/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancelablePromise, createCancelablePromise } from 'vs/base/common/async';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Emitter, Event } from 'vs/base/common/event';
import { MarkdownString } from 'vs/base/common/htmlContent';
import { Iterable } from 'vs/base/common/iterator';
import { Disposable, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { StopWatch } from 'vs/base/common/stopwatch';
import { withNullAsUndefined } from 'vs/base/common/types';
import { localize } from 'vs/nls';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { CONTEXT_PROVIDER_EXISTS } from 'vs/workbench/contrib/chat/common/chatContextKeys';
import { ChatModel, ChatWelcomeMessageModel, IChatModel, ISerializableChatData, ISerializableChatsData } from 'vs/workbench/contrib/chat/common/chatModel';
import { IChat, IChatCompleteResponse, IChatDetail, IChatDynamicRequest, IChatProgress, IChatProvider, IChatProviderInfo, IChatReplyFollowup, IChatService, IChatUserActionEvent, ISlashCommand, ISlashCommandProvider, InteractiveSessionCopyKind, InteractiveSessionVoteDirection } from 'vs/workbench/contrib/chat/common/chatService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

const serializedChatKey = 'interactive.sessions';

type ChatProviderInvokedEvent = {
	providerId: string;
	timeToFirstProgress: number;
	totalTime: number;
	result: 'success' | 'error' | 'errorWithOutput' | 'cancelled' | 'filtered';
	requestType: 'string' | 'followup' | 'slashCommand';
};

type ChatProviderInvokedClassification = {
	providerId: { classification: 'PublicNonPersonalData'; purpose: 'FeatureInsight'; comment: 'The identifier of the provider that was invoked.' };
	timeToFirstProgress: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'The time in milliseconds from invoking the provider to getting the first data.' };
	totalTime: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'The total time it took to run the provider\'s `provideResponseWithProgress`.' };
	result: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether invoking the ChatProvider resulted in an error.' };
	requestType: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The type of request that the user made.' };
	owner: 'roblourens';
	comment: 'Provides insight into the performance of Chat providers.';
};

type ChatVoteEvent = {
	providerId: string;
	direction: 'up' | 'down';
};

type ChatVoteClassification = {
	providerId: { classification: 'PublicNonPersonalData'; purpose: 'FeatureInsight'; comment: 'The identifier of the provider that this response came from.' };
	direction: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the user voted up or down.' };
	owner: 'roblourens';
	comment: 'Provides insight into the performance of Chat providers.';
};

type ChatCopyEvent = {
	providerId: string;
	copyKind: 'action' | 'toolbar';
};

type ChatCopyClassification = {
	providerId: { classification: 'PublicNonPersonalData'; purpose: 'FeatureInsight'; comment: 'The identifier of the provider that this codeblock response came from.' };
	copyKind: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'How the copy was initiated.' };
	owner: 'roblourens';
	comment: 'Provides insight into the usage of Chat features.';
};

type ChatInsertEvent = {
	providerId: string;
	newFile: boolean;
};

type ChatInsertClassification = {
	providerId: { classification: 'PublicNonPersonalData'; purpose: 'FeatureInsight'; comment: 'The identifier of the provider that this codeblock response came from.' };
	newFile: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the code was inserted into a new untitled file.' };
	owner: 'roblourens';
	comment: 'Provides insight into the usage of Chat features.';
};

type ChatCommandEvent = {
	providerId: string;
	commandId: string;
};

type ChatCommandClassification = {
	providerId: { classification: 'PublicNonPersonalData'; purpose: 'FeatureInsight'; comment: 'The identifier of the provider that this codeblock response came from.' };
	commandId: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The id of the command that was executed.' };
	owner: 'roblourens';
	comment: 'Provides insight into the usage of Chat features.';
};

type ChatTerminalEvent = {
	providerId: string;
	languageId: string;
};

type ChatTerminalClassification = {
	providerId: { classification: 'PublicNonPersonalData'; purpose: 'FeatureInsight'; comment: 'The identifier of the provider that this codeblock response came from.' };
	languageId: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The language of the code that was run in the terminal.' };
	owner: 'roblourens';
	comment: 'Provides insight into the usage of Chat features.';
};

const maxPersistedSessions = 25;

export class ChatService extends Disposable implements IChatService {
	declare _serviceBrand: undefined;

	private readonly _providers = new Map<string, IChatProvider>();
	private readonly _slashCommandProviders = new Set<ISlashCommandProvider>();
	private readonly _sessionModels = new Map<string, ChatModel>();
	private readonly _pendingRequests = new Map<string, CancelablePromise<void>>();
	private readonly _persistedSessions: ISerializableChatsData;
	private readonly _hasProvider: IContextKey<boolean>;

	private readonly _onDidPerformUserAction = this._register(new Emitter<IChatUserActionEvent>());
	public readonly onDidPerformUserAction: Event<IChatUserActionEvent> = this._onDidPerformUserAction.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
	) {
		super();

		this._hasProvider = CONTEXT_PROVIDER_EXISTS.bindTo(this.contextKeyService);

		const sessionData = storageService.get(serializedChatKey, StorageScope.WORKSPACE, '');
		if (sessionData) {
			this._persistedSessions = this.deserializeChats(sessionData);
			const countsForLog = Object.keys(this._persistedSessions).length;
			this.trace('constructor', `Restored ${countsForLog} persisted sessions`);
		} else {
			this._persistedSessions = {};
			this.trace('constructor', 'No persisted sessions');
		}

		this._register(storageService.onWillSaveState(() => this.saveState()));
	}

	private saveState(): void {
		let allSessions: (ChatModel | ISerializableChatData)[] = Array.from(this._sessionModels.values())
			.filter(session => session.getRequests().length > 0);
		allSessions = allSessions.concat(
			Object.values(this._persistedSessions)
				.filter(session => !this._sessionModels.has(session.sessionId))
				.filter(session => session.requests.length));
		allSessions.sort((a, b) => (b.creationDate ?? 0) - (a.creationDate ?? 0));
		allSessions = allSessions.slice(0, maxPersistedSessions);
		this.trace('onWillSaveState', `Persisting ${allSessions.length} sessions`);

		const serialized = JSON.stringify(allSessions);
		this.storageService.store(serializedChatKey, serialized, StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	notifyUserAction(action: IChatUserActionEvent): void {
		if (action.action.kind === 'vote') {
			this.telemetryService.publicLog2<ChatVoteEvent, ChatVoteClassification>('interactiveSessionVote', {
				providerId: action.providerId,
				direction: action.action.direction === InteractiveSessionVoteDirection.Up ? 'up' : 'down'
			});
		} else if (action.action.kind === 'copy') {
			this.telemetryService.publicLog2<ChatCopyEvent, ChatCopyClassification>('interactiveSessionCopy', {
				providerId: action.providerId,
				copyKind: action.action.copyType === InteractiveSessionCopyKind.Action ? 'action' : 'toolbar'
			});
		} else if (action.action.kind === 'insert') {
			this.telemetryService.publicLog2<ChatInsertEvent, ChatInsertClassification>('interactiveSessionInsert', {
				providerId: action.providerId,
				newFile: !!action.action.newFile
			});
		} else if (action.action.kind === 'command') {
			const command = CommandsRegistry.getCommand(action.action.command.commandId);
			const commandId = command ? action.action.command.commandId : 'INVALID';
			this.telemetryService.publicLog2<ChatCommandEvent, ChatCommandClassification>('interactiveSessionCommand', {
				providerId: action.providerId,
				commandId
			});
		} else if (action.action.kind === 'runInTerminal') {
			this.telemetryService.publicLog2<ChatTerminalEvent, ChatTerminalClassification>('interactiveSessionRunInTerminal', {
				providerId: action.providerId,
				languageId: action.action.languageId ?? ''
			});
		}

		this._onDidPerformUserAction.fire(action);
	}

	private trace(method: string, message: string): void {
		this.logService.trace(`ChatService#${method}: ${message}`);
	}

	private error(method: string, message: string): void {
		this.logService.error(`ChatService#${method} ${message}`);
	}

	private deserializeChats(sessionData: string): ISerializableChatsData {
		try {
			const arrayOfSessions: ISerializableChatData[] = JSON.parse(sessionData);
			if (!Array.isArray(arrayOfSessions)) {
				throw new Error('Expected array');
			}

			const sessions = arrayOfSessions.reduce((acc, session) => {
				acc[session.sessionId] = session;
				return acc;
			}, {} as ISerializableChatsData);
			return sessions;
		} catch (err) {
			this.error('deserializeChats', `Malformed session data: ${err}. [${sessionData.substring(0, 20)}${sessionData.length > 20 ? '...' : ''}]`);
			return {};
		}
	}

	getHistory(): IChatDetail[] {
		const sessions = Object.values(this._persistedSessions)
			.filter(session => session.requests.length > 0);
		sessions.sort((a, b) => (b.creationDate ?? 0) - (a.creationDate ?? 0));

		return sessions
			.filter(session => !this._sessionModels.has(session.sessionId))
			.filter(session => !session.isImported)
			.map(item => {
				return <IChatDetail>{
					sessionId: item.sessionId,
					title: item.requests[0]?.message || '',
				};
			});
	}

	removeHistoryEntry(sessionId: string): void {
		delete this._persistedSessions[sessionId];
	}

	startSession(providerId: string, token: CancellationToken): ChatModel {
		this.trace('startSession', `providerId=${providerId}`);
		return this._startSession(providerId, undefined, token);
	}

	private _startSession(providerId: string, someSessionHistory: ISerializableChatData | undefined, token: CancellationToken): ChatModel {
		const model = this.instantiationService.createInstance(ChatModel, providerId, someSessionHistory);
		this._sessionModels.set(model.sessionId, model);
		const modelInitPromise = this.initializeSession(model, someSessionHistory, token);
		modelInitPromise.then(resolvedModel => {
			if (!resolvedModel) {
				model.dispose();
				this._sessionModels.delete(model.sessionId);
			}
		}).catch(err => {
			this.trace('startSession', `initializeSession failed: ${err}`);
			model.setInitializationError(err);
			model.dispose();
			this._sessionModels.delete(model.sessionId);
		});

		return model;
	}

	private async initializeSession(model: ChatModel, sessionHistory: ISerializableChatData | undefined, token: CancellationToken): Promise<ChatModel | undefined> {
		await this.extensionService.activateByEvent(`onInteractiveSession:${model.providerId}`);

		const provider = this._providers.get(model.providerId);
		if (!provider) {
			throw new Error(`Unknown provider: ${model.providerId}`);
		}

		let session: IChat | undefined;
		try {
			session = withNullAsUndefined(await provider.prepareSession(model.providerState, token));
		} catch (err) {
			this.trace('initializeSession', `Provider initializeSession threw: ${err}`);
		}

		if (!session) {
			this.trace('startSession', 'Provider returned no session');
			return undefined;
		}

		this.trace('startSession', `Provider returned session`);

		const welcomeMessage = sessionHistory ? undefined : withNullAsUndefined(await provider.provideWelcomeMessage?.(token));
		const welcomeModel = welcomeMessage && new ChatWelcomeMessageModel(
			welcomeMessage.map(item => typeof item === 'string' ? new MarkdownString(item) : item as IChatReplyFollowup[]), session.responderUsername, session.responderAvatarIconUri);

		model.initialize(session, welcomeModel);
		return model;
	}

	getSession(sessionId: string): IChatModel | undefined {
		return this._sessionModels.get(sessionId);
	}

	getOrRestoreSession(sessionId: string): ChatModel | undefined {
		const model = this._sessionModels.get(sessionId);
		if (model) {
			return model;
		}

		const sessionData = this._persistedSessions[sessionId];
		if (!sessionData) {
			return undefined;
		}

		return this._startSession(sessionData.providerId, sessionData, CancellationToken.None);
	}

	loadSessionFromContent(data: ISerializableChatData): IChatModel | undefined {
		return this._startSession(data.providerId, data, CancellationToken.None);
	}

	async sendRequest(sessionId: string, request: string | IChatReplyFollowup): Promise<{ responseCompletePromise: Promise<void> } | undefined> {
		const messageText = typeof request === 'string' ? request : request.message;
		this.trace('sendRequest', `sessionId: ${sessionId}, message: ${messageText.substring(0, 20)}${messageText.length > 20 ? '[...]' : ''}}`);
		if (!messageText.trim()) {
			this.trace('sendRequest', 'Rejected empty message');
			return undefined;
		}

		const model = this._sessionModels.get(sessionId);
		if (!model) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		await model.waitForInitialization();
		const provider = this._providers.get(model.providerId);
		if (!provider) {
			throw new Error(`Unknown provider: ${model.providerId}`);
		}

		if (this._pendingRequests.has(sessionId)) {
			this.trace('sendRequest', `Session ${sessionId} already has a pending request`);
			return undefined;
		}

		// This method is only returning whether the request was accepted - don't block on the actual request
		return { responseCompletePromise: this._sendRequestAsync(model, provider, request) };
	}

	private async _sendRequestAsync(model: ChatModel, provider: IChatProvider, message: string | IChatReplyFollowup): Promise<void> {
		const request = model.addRequest(message);

		const resolvedCommand = typeof message === 'string' && message.startsWith('/') ? await this.handleSlashCommand(model.sessionId, message) : message;

		let gotProgress = false;
		const requestType = typeof message === 'string' ?
			(message.startsWith('/') ? 'slashCommand' : 'string') :
			'followup';

		const rawResponsePromise = createCancelablePromise<void>(async token => {
			const progressCallback = (progress: IChatProgress) => {
				if (token.isCancellationRequested) {
					return;
				}

				gotProgress = true;
				if ('content' in progress) {
					this.trace('sendRequest', `Provider returned progress for session ${model.sessionId}, ${progress.content.length} chars`);
				} else {
					this.trace('sendRequest', `Provider returned id for session ${model.sessionId}, ${progress.requestId}`);
				}

				model.acceptResponseProgress(request, progress);
			};

			const stopWatch = new StopWatch(false);
			token.onCancellationRequested(() => {
				this.trace('sendRequest', `Request for session ${model.sessionId} was cancelled`);
				this.telemetryService.publicLog2<ChatProviderInvokedEvent, ChatProviderInvokedClassification>('interactiveSessionProviderInvoked', {
					providerId: provider.id,
					timeToFirstProgress: -1,
					// Normally timings happen inside the EH around the actual provider. For cancellation we can measure how long the user waited before cancelling
					totalTime: stopWatch.elapsed(),
					result: 'cancelled',
					requestType
				});

				model.cancelRequest(request);
			});
			let rawResponse = await provider.provideReply({ session: model.session!, message: resolvedCommand }, progressCallback, token);
			if (token.isCancellationRequested) {
				return;
			} else {
				if (!rawResponse) {
					this.trace('sendRequest', `Provider returned no response for session ${model.sessionId}`);
					rawResponse = { session: model.session!, errorDetails: { message: localize('emptyResponse', "Provider returned null response") } };
				}

				const result = rawResponse.errorDetails?.responseIsFiltered ? 'filtered' :
					rawResponse.errorDetails && gotProgress ? 'errorWithOutput' :
						rawResponse.errorDetails ? 'error' :
							'success';
				this.telemetryService.publicLog2<ChatProviderInvokedEvent, ChatProviderInvokedClassification>('interactiveSessionProviderInvoked', {
					providerId: provider.id,
					timeToFirstProgress: rawResponse.timings?.firstProgress ?? 0,
					totalTime: rawResponse.timings?.totalElapsed ?? 0,
					result,
					requestType
				});
				model.completeResponse(request, rawResponse);
				this.trace('sendRequest', `Provider returned response for session ${model.sessionId}`);

				if (provider.provideFollowups) {
					Promise.resolve(provider.provideFollowups(model.session!, CancellationToken.None)).then(followups => {
						model.setFollowups(request, withNullAsUndefined(followups));
					});
				}
			}
		});
		this._pendingRequests.set(model.sessionId, rawResponsePromise);
		rawResponsePromise.finally(() => {
			this._pendingRequests.delete(model.sessionId);
		});
		return rawResponsePromise;
	}

	async removeRequest(sessionId: string, requestId: string): Promise<void> {
		const model = this._sessionModels.get(sessionId);
		if (!model) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		await model.waitForInitialization();
		const provider = this._providers.get(model.providerId);
		if (!provider) {
			throw new Error(`Unknown provider: ${model.providerId}`);
		}

		model.removeRequest(requestId);
		provider.removeRequest?.(model.session!, requestId);
	}

	private async handleSlashCommand(sessionId: string, command: string): Promise<string> {
		const slashCommands = await this.getSlashCommands(sessionId, CancellationToken.None);
		for (const slashCommand of slashCommands ?? []) {
			if (command.startsWith(`/${slashCommand.command}`) && slashCommand.provider) {
				return await slashCommand.provider.resolveSlashCommand(command, CancellationToken.None) ?? command;
			}
		}

		return command;
	}

	async getSlashCommands(sessionId: string, token: CancellationToken): Promise<ISlashCommand[] | undefined> {
		const model = this._sessionModels.get(sessionId);
		if (!model) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		await model.waitForInitialization();
		const provider = this._providers.get(model.providerId);
		if (!provider) {
			throw new Error(`Unknown provider: ${model.providerId}`);
		}

		if (!provider.provideSlashCommands) {
			return undefined;
		}

		const mainProviderRequest = provider.provideSlashCommands(model.session!, token);
		const slashCommandProviders = Array.from(this._slashCommandProviders).filter(p => p.chatProviderId === model.providerId);
		const providerResults = Promise.all([
			mainProviderRequest,
			...slashCommandProviders.map(p => Promise.resolve(p.provideSlashCommands(token))
				.then(commands => commands?.map(c => ({ ...c, provider: p }))))
		]);

		try {
			const slashCommands = (await providerResults).filter(c => !!c) as ISlashCommand[][];
			return withNullAsUndefined(slashCommands.flat());
		} catch (e) {
			this.logService.error(e);

			// If one of the other contributed providers fails, return the main provider's result
			return withNullAsUndefined(await mainProviderRequest);
		}
	}

	async addRequest(context: any): Promise<void> {
		// This and resolveRequest are not currently used by any scenario, but leave for future use

		// TODO How to decide which session this goes to?
		const model = Iterable.first(this._sessionModels.values());
		if (!model) {
			// If no session, create one- how and is the service the right place to decide this?
			this.trace('addRequest', 'No session available');
			return;
		}

		const provider = this._providers.get(model.providerId);
		if (!provider || !provider.resolveRequest) {
			this.trace('addRequest', 'No provider available');
			return undefined;
		}

		this.trace('addRequest', `Calling resolveRequest for session ${model.sessionId}`);
		const request = await provider.resolveRequest(model.session!, context, CancellationToken.None);
		if (!request) {
			this.trace('addRequest', `Provider returned no request for session ${model.sessionId}`);
			return;
		}

		// Maybe this API should queue a request after the current one?
		this.trace('addRequest', `Sending resolved request for session ${model.sessionId}`);
		this.sendRequest(model.sessionId, request.message);
	}

	async sendRequestToProvider(sessionId: string, message: IChatDynamicRequest): Promise<void> {
		this.trace('sendRequestToProvider', `sessionId: ${sessionId}`);
		await this.sendRequest(sessionId, message.message);
	}

	getProviders(): string[] {
		return Array.from(this._providers.keys());
	}

	async addCompleteRequest(sessionId: string, message: string, response: IChatCompleteResponse): Promise<void> {
		this.trace('addCompleteRequest', `message: ${message}`);

		const model = this._sessionModels.get(sessionId);
		if (!model) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		await model.waitForInitialization();
		const request = model.addRequest(message);
		model.acceptResponseProgress(request, {
			content: response.message,
		}, true);
		model.completeResponse(request, {
			session: model.session!,
			errorDetails: response.errorDetails,
		});
	}

	cancelCurrentRequestForSession(sessionId: string): void {
		this.trace('cancelCurrentRequestForSession', `sessionId: ${sessionId}`);
		this._pendingRequests.get(sessionId)?.cancel();
	}

	clearSession(sessionId: string): void {
		this.trace('clearSession', `sessionId: ${sessionId}`);
		const model = this._sessionModels.get(sessionId);
		if (!model) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		this._persistedSessions[sessionId] = model.toJSON();

		model.dispose();
		this._sessionModels.delete(sessionId);
		this._pendingRequests.get(sessionId)?.cancel();
	}

	registerProvider(provider: IChatProvider): IDisposable {
		this.trace('registerProvider', `Adding new chat provider`);

		if (this._providers.has(provider.id)) {
			throw new Error(`Provider ${provider.id} already registered`);
		}

		this._providers.set(provider.id, provider);
		this._hasProvider.set(true);

		return toDisposable(() => {
			this.trace('registerProvider', `Disposing chat provider`);
			this._providers.delete(provider.id);
			this._hasProvider.set(this._providers.size > 0);
		});
	}

	registerSlashCommandProvider(provider: ISlashCommandProvider): IDisposable {
		this.trace('registerProvider', `Adding new slash command provider`);

		this._slashCommandProviders.add(provider);
		return toDisposable(() => {
			this.trace('registerProvider', `Disposing slash command provider`);
			this._slashCommandProviders.delete(provider);
		});
	}

	getProviderInfos(): IChatProviderInfo[] {
		return Array.from(this._providers.values()).map(provider => {
			return {
				id: provider.id,
				displayName: provider.displayName
			};
		});
	}
}
