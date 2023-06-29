/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { Disposable, DisposableMap } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { ExtHostChatShape, ExtHostContext, IChatRequestDto, MainContext, MainThreadChatShape } from 'vs/workbench/api/common/extHost.protocol';
import { IChatWidgetService } from 'vs/workbench/contrib/chat/browser/chat';
import { IChatContributionService } from 'vs/workbench/contrib/chat/common/chatContributionService';
import { IChat, IChatDynamicRequest, IChatProgress, IChatRequest, IChatResponse, IChatService } from 'vs/workbench/contrib/chat/common/chatService';
import { IExtHostContext, extHostNamedCustomer } from 'vs/workbench/services/extensions/common/extHostCustomers';

@extHostNamedCustomer(MainContext.MainThreadChat)
export class MainThreadChat extends Disposable implements MainThreadChatShape {

	private readonly _providerRegistrations = this._register(new DisposableMap<number>());
	private readonly _activeRequestProgressCallbacks = new Map<string, (progress: IChatProgress) => void>();
	private readonly _stateEmitters = new Map<number, Emitter<any>>();

	private readonly _proxy: ExtHostChatShape;

	constructor(
		extHostContext: IExtHostContext,
		@IChatService private readonly _chatService: IChatService,
		@IChatWidgetService private readonly _chatWidgetService: IChatWidgetService,
		@IChatContributionService private readonly chatContribService: IChatContributionService,
	) {
		super();
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostChat);

		this._register(this._chatService.onDidPerformUserAction(e => {
			this._proxy.$onDidPerformUserAction(e);
		}));
	}

	async $registerSlashCommandProvider(handle: number, chatProviderId: string): Promise<void> {
		const unreg = this._chatService.registerSlashCommandProvider({
			chatProviderId,
			provideSlashCommands: async token => {
				return this._proxy.$provideProviderSlashCommands(handle, token);
			},
			resolveSlashCommand: async (command, token) => {
				return this._proxy.$resolveSlashCommand(handle, command, token);
			}
		});

		this._providerRegistrations.set(handle, unreg);
	}

	async $unregisterSlashCommandProvider(handle: number): Promise<void> {
		this._providerRegistrations.deleteAndDispose(handle);
	}

	async $registerChatProvider(handle: number, id: string): Promise<void> {
		const registration = this.chatContribService.registeredProviders.find(staticProvider => staticProvider.id === id);
		if (!registration) {
			throw new Error(`Provider ${id} must be declared in the package.json.`);
		}

		const unreg = this._chatService.registerProvider({
			id,
			displayName: registration.label,
			prepareSession: async (initialState, token) => {
				const session = await this._proxy.$prepareChat(handle, initialState, token);
				if (!session) {
					return undefined;
				}

				const responderAvatarIconUri = session.responderAvatarIconUri ?
					URI.revive(session.responderAvatarIconUri) :
					registration.extensionIcon;

				const emitter = new Emitter<any>();
				this._stateEmitters.set(session.id, emitter);
				return <IChat>{
					id: session.id,
					requesterUsername: session.requesterUsername,
					requesterAvatarIconUri: URI.revive(session.requesterAvatarIconUri),
					responderUsername: session.responderUsername,
					responderAvatarIconUri,
					inputPlaceholder: session.inputPlaceholder,
					onDidChangeState: emitter.event,
					dispose: () => {
						emitter.dispose();
						this._stateEmitters.delete(session.id);
						this._proxy.$releaseSession(session.id);
					}
				};
			},
			resolveRequest: async (session, context, token) => {
				const dto = await this._proxy.$resolveRequest(handle, session.id, context, token);
				return <IChatRequest>{
					session,
					...dto
				};
			},
			provideReply: async (request, progress, token) => {
				const id = `${handle}_${request.session.id}`;
				this._activeRequestProgressCallbacks.set(id, progress);
				try {
					const requestDto: IChatRequestDto = {
						message: request.message,
					};
					const dto = await this._proxy.$provideReply(handle, request.session.id, requestDto, token);
					return <IChatResponse>{
						session: request.session,
						...dto
					};
				} finally {
					this._activeRequestProgressCallbacks.delete(id);
				}
			},
			provideWelcomeMessage: (token) => {
				return this._proxy.$provideWelcomeMessage(handle, token);
			},
			provideSlashCommands: (session, token) => {
				return this._proxy.$provideSlashCommands(handle, session.id, token);
			},
			provideFollowups: (session, token) => {
				return this._proxy.$provideFollowups(handle, session.id, token);
			},
			removeRequest: (session, requestId) => {
				return this._proxy.$removeRequest(handle, session.id, requestId);
			}
		});

		this._providerRegistrations.set(handle, unreg);
	}

	$acceptResponseProgress(handle: number, sessionId: number, progress: IChatProgress): void {
		const id = `${handle}_${sessionId}`;
		this._activeRequestProgressCallbacks.get(id)?.(progress);
	}

	async $acceptChatState(sessionId: number, state: any): Promise<void> {
		this._stateEmitters.get(sessionId)?.fire(state);
	}

	$addRequest(context: any): void {
		this._chatService.addRequest(context);
	}

	async $sendRequestToProvider(providerId: string, message: IChatDynamicRequest): Promise<void> {
		const widget = await this._chatWidgetService.revealViewForProvider(providerId);
		if (widget && widget.viewModel) {
			this._chatService.sendRequestToProvider(widget.viewModel.sessionId, message);
		}
	}

	async $unregisterChatProvider(handle: number): Promise<void> {
		this._providerRegistrations.deleteAndDispose(handle);
	}
}
