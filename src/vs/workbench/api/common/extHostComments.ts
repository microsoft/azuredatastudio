/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { asPromise } from 'vs/base/common/async';
import { CancellationToken } from 'vs/base/common/cancellation';
import { debounce } from 'vs/base/common/decorators';
import { Emitter } from 'vs/base/common/event';
import { DisposableStore, IDisposable, MutableDisposable } from 'vs/base/common/lifecycle';
import { MarshalledId } from 'vs/base/common/marshalling';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IRange } from 'vs/editor/common/core/range';
import * as modes from 'vs/editor/common/modes';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { ExtHostDocuments } from 'vs/workbench/api/common/extHostDocuments';
import * as extHostTypeConverter from 'vs/workbench/api/common/extHostTypeConverters';
import * as types from 'vs/workbench/api/common/extHostTypes';
import type * as vscode from 'vscode';
import { ExtHostCommentsShape, IMainContext, MainContext, CommentThreadChanges } from './extHost.protocol';
import { ExtHostCommands } from './extHostCommands';

type ProviderHandle = number;

export interface ExtHostComments {
	createCommentController(extension: IExtensionDescription, id: string, label: string): vscode.CommentController;
}

export function createExtHostComments(mainContext: IMainContext, commands: ExtHostCommands, documents: ExtHostDocuments): ExtHostCommentsShape & ExtHostComments {
	const proxy = mainContext.getProxy(MainContext.MainThreadComments);

	class ExtHostCommentsImpl implements ExtHostCommentsShape, ExtHostComments, IDisposable {

		private static handlePool = 0;


		private _commentControllers: Map<ProviderHandle, ExtHostCommentController> = new Map<ProviderHandle, ExtHostCommentController>();

		private _commentControllersByExtension: Map<string, ExtHostCommentController[]> = new Map<string, ExtHostCommentController[]>();


		constructor(
		) {
			commands.registerArgumentProcessor({
				processArgument: arg => {
					if (arg && arg.$mid === MarshalledId.CommentController) {
						const commentController = this._commentControllers.get(arg.handle);

						if (!commentController) {
							return arg;
						}

						return commentController;
					} else if (arg && arg.$mid === MarshalledId.CommentThread) {
						const commentController = this._commentControllers.get(arg.commentControlHandle);

						if (!commentController) {
							return arg;
						}

						const commentThread = commentController.getCommentThread(arg.commentThreadHandle);

						if (!commentThread) {
							return arg;
						}

						return commentThread;
					} else if (arg && arg.$mid === MarshalledId.CommentThreadReply) {
						const commentController = this._commentControllers.get(arg.thread.commentControlHandle);

						if (!commentController) {
							return arg;
						}

						const commentThread = commentController.getCommentThread(arg.thread.commentThreadHandle);

						if (!commentThread) {
							return arg;
						}

						return {
							thread: commentThread,
							text: arg.text
						};
					} else if (arg && arg.$mid === MarshalledId.CommentNode) {
						const commentController = this._commentControllers.get(arg.thread.commentControlHandle);

						if (!commentController) {
							return arg;
						}

						const commentThread = commentController.getCommentThread(arg.thread.commentThreadHandle);

						if (!commentThread) {
							return arg;
						}

						let commentUniqueId = arg.commentUniqueId;

						let comment = commentThread.getCommentByUniqueId(commentUniqueId);

						if (!comment) {
							return arg;
						}

						return comment;

					} else if (arg && arg.$mid === MarshalledId.CommentThreadNode) {
						const commentController = this._commentControllers.get(arg.thread.commentControlHandle);

						if (!commentController) {
							return arg;
						}

						const commentThread = commentController.getCommentThread(arg.thread.commentThreadHandle);

						if (!commentThread) {
							return arg;
						}

						let body = arg.text;
						let commentUniqueId = arg.commentUniqueId;

						let comment = commentThread.getCommentByUniqueId(commentUniqueId);

						if (!comment) {
							return arg;
						}

						comment.body = body;
						return comment;
					}

					return arg;
				}
			});
		}

		createCommentController(extension: IExtensionDescription, id: string, label: string): vscode.CommentController {
			const handle = ExtHostCommentsImpl.handlePool++;
			const commentController = new ExtHostCommentController(extension, handle, id, label);
			this._commentControllers.set(commentController.handle, commentController);

			const commentControllers = this._commentControllersByExtension.get(ExtensionIdentifier.toKey(extension.identifier)) || [];
			commentControllers.push(commentController);
			this._commentControllersByExtension.set(ExtensionIdentifier.toKey(extension.identifier), commentControllers);

			return commentController.value;
		}

		$createCommentThreadTemplate(commentControllerHandle: number, uriComponents: UriComponents, range: IRange): void {
			const commentController = this._commentControllers.get(commentControllerHandle);

			if (!commentController) {
				return;
			}

			commentController.$createCommentThreadTemplate(uriComponents, range);
		}

		async $updateCommentThreadTemplate(commentControllerHandle: number, threadHandle: number, range: IRange) {
			const commentController = this._commentControllers.get(commentControllerHandle);

			if (!commentController) {
				return;
			}

			commentController.$updateCommentThreadTemplate(threadHandle, range);
		}

		$deleteCommentThread(commentControllerHandle: number, commentThreadHandle: number) {
			const commentController = this._commentControllers.get(commentControllerHandle);

			if (commentController) {
				commentController.$deleteCommentThread(commentThreadHandle);
			}
		}

		$provideCommentingRanges(commentControllerHandle: number, uriComponents: UriComponents, token: CancellationToken): Promise<IRange[] | undefined> {
			const commentController = this._commentControllers.get(commentControllerHandle);

			if (!commentController || !commentController.commentingRangeProvider) {
				return Promise.resolve(undefined);
			}

			const document = documents.getDocument(URI.revive(uriComponents));
			return asPromise(() => {
				return commentController.commentingRangeProvider!.provideCommentingRanges(document, token);
			}).then(ranges => ranges ? ranges.map(x => extHostTypeConverter.Range.from(x)) : undefined);
		}

		$toggleReaction(commentControllerHandle: number, threadHandle: number, uri: UriComponents, comment: modes.Comment, reaction: modes.CommentReaction): Promise<void> {
			const commentController = this._commentControllers.get(commentControllerHandle);

			if (!commentController || !commentController.reactionHandler) {
				return Promise.resolve(undefined);
			}

			return asPromise(() => {
				const commentThread = commentController.getCommentThread(threadHandle);
				if (commentThread) {
					const vscodeComment = commentThread.getCommentByUniqueId(comment.uniqueIdInThread);

					if (commentController !== undefined && vscodeComment) {
						if (commentController.reactionHandler) {
							return commentController.reactionHandler(vscodeComment, convertFromReaction(reaction));
						}
					}
				}

				return Promise.resolve(undefined);
			});
		}
		dispose() {

		}
	}
	type CommentThreadModification = Partial<{
		range: vscode.Range,
		label: string | undefined,
		contextValue: string | undefined,
		comments: vscode.Comment[],
		collapsibleState: vscode.CommentThreadCollapsibleState
		canReply: boolean;
	}>;

	class ExtHostCommentThread implements vscode.CommentThread {
		private static _handlePool: number = 0;
		readonly handle = ExtHostCommentThread._handlePool++;
		public commentHandle: number = 0;

		private modifications: CommentThreadModification = Object.create(null);

		set threadId(id: string) {
			this._id = id;
		}

		get threadId(): string {
			return this._id!;
		}

		get id(): string {
			return this._id!;
		}

		get resource(): vscode.Uri {
			return this._uri;
		}

		get uri(): vscode.Uri {
			return this._uri;
		}

		private readonly _onDidUpdateCommentThread = new Emitter<void>();
		readonly onDidUpdateCommentThread = this._onDidUpdateCommentThread.event;

		set range(range: vscode.Range) {
			if (!range.isEqual(this._range)) {
				this._range = range;
				this.modifications.range = range;
				this._onDidUpdateCommentThread.fire();
			}
		}

		get range(): vscode.Range {
			return this._range;
		}

		private _canReply: boolean = true;

		set canReply(state: boolean) {
			if (this._canReply !== state) {
				this._canReply = state;
				this.modifications.canReply = state;
				this._onDidUpdateCommentThread.fire();
			}
		}
		get canReply() {
			return this._canReply;
		}

		private _label: string | undefined;

		get label(): string | undefined {
			return this._label;
		}

		set label(label: string | undefined) {
			this._label = label;
			this.modifications.label = label;
			this._onDidUpdateCommentThread.fire();
		}

		private _contextValue: string | undefined;

		get contextValue(): string | undefined {
			return this._contextValue;
		}

		set contextValue(context: string | undefined) {
			this._contextValue = context;
			this.modifications.contextValue = context;
			this._onDidUpdateCommentThread.fire();
		}

		get comments(): vscode.Comment[] {
			return this._comments;
		}

		set comments(newComments: vscode.Comment[]) {
			this._comments = newComments;
			this.modifications.comments = newComments;
			this._onDidUpdateCommentThread.fire();
		}

		private _collapseState?: vscode.CommentThreadCollapsibleState;

		get collapsibleState(): vscode.CommentThreadCollapsibleState {
			return this._collapseState!;
		}

		set collapsibleState(newState: vscode.CommentThreadCollapsibleState) {
			this._collapseState = newState;
			this.modifications.collapsibleState = newState;
			this._onDidUpdateCommentThread.fire();
		}

		private _localDisposables: types.Disposable[];

		private _isDiposed: boolean;

		public get isDisposed(): boolean {
			return this._isDiposed;
		}

		private _commentsMap: Map<vscode.Comment, number> = new Map<vscode.Comment, number>();

		private _acceptInputDisposables = new MutableDisposable<DisposableStore>();

		readonly value: vscode.CommentThread;

		constructor(
			commentControllerId: string,
			private _commentControllerHandle: number,
			private _id: string | undefined,
			private _uri: vscode.Uri,
			private _range: vscode.Range,
			private _comments: vscode.Comment[],
			extensionId: ExtensionIdentifier
		) {
			this._acceptInputDisposables.value = new DisposableStore();

			if (this._id === undefined) {
				this._id = `${commentControllerId}.${this.handle}`;
			}

			proxy.$createCommentThread(
				_commentControllerHandle,
				this.handle,
				this._id,
				this._uri,
				extHostTypeConverter.Range.from(this._range),
				extensionId
			);

			this._localDisposables = [];
			this._isDiposed = false;

			this._localDisposables.push(this.onDidUpdateCommentThread(() => {
				this.eventuallyUpdateCommentThread();
			}));

			// set up comments after ctor to batch update events.
			this.comments = _comments;

			this._localDisposables.push({
				dispose: () => {
					proxy.$deleteCommentThread(
						_commentControllerHandle,
						this.handle
					);
				}
			});

			const that = this;
			this.value = {
				get uri() { return that.uri; },
				get range() { return that.range; },
				set range(value: vscode.Range) { that.range = value; },
				get comments() { return that.comments; },
				set comments(value: vscode.Comment[]) { that.comments = value; },
				get collapsibleState() { return that.collapsibleState; },
				set collapsibleState(value: vscode.CommentThreadCollapsibleState) { that.collapsibleState = value; },
				get canReply() { return that.canReply; },
				set canReply(state: boolean) { that.canReply = state; },
				get contextValue() { return that.contextValue; },
				set contextValue(value: string | undefined) { that.contextValue = value; },
				get label() { return that.label; },
				set label(value: string | undefined) { that.label = value; },
				dispose: () => {
					that.dispose();
				}
			};
		}


		@debounce(100)
		eventuallyUpdateCommentThread(): void {
			if (this._isDiposed) {
				return;
			}

			if (!this._acceptInputDisposables.value) {
				this._acceptInputDisposables.value = new DisposableStore();
			}

			const modified = (value: keyof CommentThreadModification): boolean =>
				Object.prototype.hasOwnProperty.call(this.modifications, value);

			const formattedModifications: CommentThreadChanges = {};
			if (modified('range')) {
				formattedModifications.range = extHostTypeConverter.Range.from(this._range);
			}
			if (modified('label')) {
				formattedModifications.label = this.label;
			}
			if (modified('contextValue')) {
				formattedModifications.contextValue = this.contextValue;
			}
			if (modified('comments')) {
				formattedModifications.comments =
					this._comments.map(cmt => convertToModeComment(this, cmt, this._commentsMap));
			}
			if (modified('collapsibleState')) {
				formattedModifications.collapseState = convertToCollapsibleState(this._collapseState);
			}
			if (modified('canReply')) {
				formattedModifications.canReply = this.canReply;
			}
			this.modifications = {};

			proxy.$updateCommentThread(
				this._commentControllerHandle,
				this.handle,
				this._id!,
				this._uri,
				formattedModifications
			);
		}

		getCommentByUniqueId(uniqueId: number): vscode.Comment | undefined {
			for (let key of this._commentsMap) {
				let comment = key[0];
				let id = key[1];
				if (uniqueId === id) {
					return comment;
				}
			}

			return undefined; // {{SQL CARBON EDIT}} strict-nulls
		}

		dispose() {
			this._isDiposed = true;
			this._acceptInputDisposables.dispose();
			this._localDisposables.forEach(disposable => disposable.dispose());
		}
	}

	type ReactionHandler = (comment: vscode.Comment, reaction: vscode.CommentReaction) => Promise<void>;

	class ExtHostCommentController {
		get id(): string {
			return this._id;
		}

		get label(): string {
			return this._label;
		}

		public get handle(): number {
			return this._handle;
		}

		private _threads: Map<number, ExtHostCommentThread> = new Map<number, ExtHostCommentThread>();
		commentingRangeProvider?: vscode.CommentingRangeProvider;

		private _reactionHandler?: ReactionHandler;

		get reactionHandler(): ReactionHandler | undefined {
			return this._reactionHandler;
		}

		set reactionHandler(handler: ReactionHandler | undefined) {
			this._reactionHandler = handler;

			proxy.$updateCommentControllerFeatures(this.handle, { reactionHandler: !!handler });
		}

		private _options: modes.CommentOptions | undefined;

		get options() {
			return this._options;
		}

		set options(options: modes.CommentOptions | undefined) {
			this._options = options;

			proxy.$updateCommentControllerFeatures(this.handle, { options: this._options });
		}


		private _localDisposables: types.Disposable[];
		readonly value: vscode.CommentController;

		constructor(
			private _extension: IExtensionDescription,
			private _handle: number,
			private _id: string,
			private _label: string
		) {
			proxy.$registerCommentController(this.handle, _id, _label);

			const that = this;
			this.value = Object.freeze({
				id: that.id,
				label: that.label,
				get options() { return that.options; },
				set options(options: vscode.CommentOptions | undefined) { that.options = options; },
				get commentingRangeProvider(): vscode.CommentingRangeProvider | undefined { return that.commentingRangeProvider; },
				set commentingRangeProvider(commentingRangeProvider: vscode.CommentingRangeProvider | undefined) { that.commentingRangeProvider = commentingRangeProvider; },
				get reactionHandler(): ReactionHandler | undefined { return that.reactionHandler; },
				set reactionHandler(handler: ReactionHandler | undefined) { that.reactionHandler = handler; },
				createCommentThread(uri: vscode.Uri, range: vscode.Range, comments: vscode.Comment[]): vscode.CommentThread {
					return that.createCommentThread(uri, range, comments).value;
				},
				dispose: () => { that.dispose(); },
			});

			this._localDisposables = [];
			this._localDisposables.push({
				dispose: () => {
					proxy.$unregisterCommentController(this.handle);
				}
			});
		}

		createCommentThread(resource: vscode.Uri, range: vscode.Range, comments: vscode.Comment[]): ExtHostCommentThread;
		createCommentThread(arg0: vscode.Uri | string, arg1: vscode.Uri | vscode.Range, arg2: vscode.Range | vscode.Comment[], arg3?: vscode.Comment[]): vscode.CommentThread {
			if (typeof arg0 === 'string') {
				const commentThread = new ExtHostCommentThread(this.id, this.handle, arg0, arg1 as vscode.Uri, arg2 as vscode.Range, arg3 as vscode.Comment[], this._extension.identifier);
				this._threads.set(commentThread.handle, commentThread);
				return commentThread;
			} else {
				const commentThread = new ExtHostCommentThread(this.id, this.handle, undefined, arg0 as vscode.Uri, arg1 as vscode.Range, arg2 as vscode.Comment[], this._extension.identifier);
				this._threads.set(commentThread.handle, commentThread);
				return commentThread;
			}
		}

		$createCommentThreadTemplate(uriComponents: UriComponents, range: IRange): ExtHostCommentThread {
			const commentThread = new ExtHostCommentThread(this.id, this.handle, undefined, URI.revive(uriComponents), extHostTypeConverter.Range.to(range), [], this._extension.identifier);
			commentThread.collapsibleState = modes.CommentThreadCollapsibleState.Expanded;
			this._threads.set(commentThread.handle, commentThread);
			return commentThread;
		}

		$updateCommentThreadTemplate(threadHandle: number, range: IRange): void {
			let thread = this._threads.get(threadHandle);
			if (thread) {
				thread.range = extHostTypeConverter.Range.to(range);
			}
		}

		$deleteCommentThread(threadHandle: number): void {
			let thread = this._threads.get(threadHandle);

			if (thread) {
				thread.dispose();
			}

			this._threads.delete(threadHandle);
		}

		getCommentThread(handle: number): ExtHostCommentThread | undefined {
			return this._threads.get(handle);
		}

		dispose(): void {
			this._threads.forEach(value => {
				value.dispose();
			});

			this._localDisposables.forEach(disposable => disposable.dispose());
		}
	}

	function convertToModeComment(thread: ExtHostCommentThread, vscodeComment: vscode.Comment, commentsMap: Map<vscode.Comment, number>): modes.Comment {
		let commentUniqueId = commentsMap.get(vscodeComment)!;
		if (!commentUniqueId) {
			commentUniqueId = ++thread.commentHandle;
			commentsMap.set(vscodeComment, commentUniqueId);
		}

		const iconPath = vscodeComment.author && vscodeComment.author.iconPath ? vscodeComment.author.iconPath.toString() : undefined;

		return {
			mode: vscodeComment.mode,
			contextValue: vscodeComment.contextValue,
			uniqueIdInThread: commentUniqueId,
			body: extHostTypeConverter.MarkdownString.from(vscodeComment.body),
			userName: vscodeComment.author.name,
			userIconPath: iconPath,
			label: vscodeComment.label,
			commentReactions: vscodeComment.reactions ? vscodeComment.reactions.map(reaction => convertToReaction(reaction)) : undefined
		};
	}

	function convertToReaction(reaction: vscode.CommentReaction): modes.CommentReaction {
		return {
			label: reaction.label,
			iconPath: reaction.iconPath ? extHostTypeConverter.pathOrURIToURI(reaction.iconPath) : undefined,
			count: reaction.count,
			hasReacted: reaction.authorHasReacted,
		};
	}

	function convertFromReaction(reaction: modes.CommentReaction): vscode.CommentReaction {
		return {
			label: reaction.label || '',
			count: reaction.count || 0,
			iconPath: reaction.iconPath ? URI.revive(reaction.iconPath) : '',
			authorHasReacted: reaction.hasReacted || false
		};
	}

	function convertToCollapsibleState(kind: vscode.CommentThreadCollapsibleState | undefined): modes.CommentThreadCollapsibleState {
		if (kind !== undefined) {
			switch (kind) {
				case types.CommentThreadCollapsibleState.Expanded:
					return modes.CommentThreadCollapsibleState.Expanded;
				case types.CommentThreadCollapsibleState.Collapsed:
					return modes.CommentThreadCollapsibleState.Collapsed;
			}
		}
		return modes.CommentThreadCollapsibleState.Collapsed;
	}

	return new ExtHostCommentsImpl();
}
