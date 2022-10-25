/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommentThreadChangedEvent, CommentInfo, Comment, CommentReaction, CommentingRanges, CommentThread, CommentOptions } from 'vs/editor/common/languages';
import { createDecorator, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { URI, UriComponents } from 'vs/base/common/uri';
import { Range, IRange } from 'vs/editor/common/core/range';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ICommentThreadChangedEvent } from 'vs/workbench/contrib/comments/common/commentModel';
import { CommentMenus } from 'vs/workbench/contrib/comments/browser/commentMenus';
import { ICellRange } from 'vs/workbench/contrib/notebook/common/notebookRange';

export const ICommentService = createDecorator<ICommentService>('commentService');

export interface IResourceCommentThreadEvent {
	resource: URI;
	commentInfos: ICommentInfo[];
}

export interface ICommentInfo extends CommentInfo {
	owner: string;
	label?: string;
}

export interface INotebookCommentInfo {
	extensionId?: string;
	threads: CommentThread<ICellRange>[];
	owner: string;
	label?: string;
}

export interface IWorkspaceCommentThreadsEvent {
	ownerId: string;
	commentThreads: CommentThread[];
}

export interface INotebookCommentThreadChangedEvent extends CommentThreadChangedEvent<ICellRange> {
	owner: string;
}

export interface ICommentController {
	id: string;
	features: {
		reactionGroup?: CommentReaction[];
		reactionHandler?: boolean;
		options?: CommentOptions;
	};
	options?: CommentOptions;
	contextValue?: string;
	createCommentThreadTemplate(resource: UriComponents, range: IRange): void;
	updateCommentThreadTemplate(threadHandle: number, range: IRange): Promise<void>;
	deleteCommentThreadMain(commentThreadId: string): void;
	toggleReaction(uri: URI, thread: CommentThread, comment: Comment, reaction: CommentReaction, token: CancellationToken): Promise<void>;
	getDocumentComments(resource: URI, token: CancellationToken): Promise<ICommentInfo>;
	getNotebookComments(resource: URI, token: CancellationToken): Promise<INotebookCommentInfo>;
	getCommentingRanges(resource: URI, token: CancellationToken): Promise<IRange[]>;
}

export interface ICommentService {
	readonly _serviceBrand: undefined;
	readonly onDidSetResourceCommentInfos: Event<IResourceCommentThreadEvent>;
	readonly onDidSetAllCommentThreads: Event<IWorkspaceCommentThreadsEvent>;
	readonly onDidUpdateCommentThreads: Event<ICommentThreadChangedEvent>;
	readonly onDidUpdateNotebookCommentThreads: Event<INotebookCommentThreadChangedEvent>;
	readonly onDidChangeActiveCommentThread: Event<CommentThread | null>;
	readonly onDidChangeCurrentCommentThread: Event<CommentThread | undefined>;
	readonly onDidUpdateCommentingRanges: Event<{ owner: string }>;
	readonly onDidChangeActiveCommentingRange: Event<{ range: Range; commentingRangesInfo: CommentingRanges }>;
	readonly onDidSetDataProvider: Event<void>;
	readonly onDidDeleteDataProvider: Event<string>;
	setDocumentComments(resource: URI, commentInfos: ICommentInfo[]): void;
	setWorkspaceComments(owner: string, commentsByResource: CommentThread<IRange | ICellRange>[]): void;
	removeWorkspaceComments(owner: string): void;
	registerCommentController(owner: string, commentControl: ICommentController): void;
	unregisterCommentController(owner: string): void;
	getCommentController(owner: string): ICommentController | undefined;
	createCommentThreadTemplate(owner: string, resource: URI, range: Range): void;
	updateCommentThreadTemplate(owner: string, threadHandle: number, range: Range): Promise<void>;
	getCommentMenus(owner: string): CommentMenus;
	updateComments(ownerId: string, event: CommentThreadChangedEvent<IRange>): void;
	updateNotebookComments(ownerId: string, event: CommentThreadChangedEvent<ICellRange>): void;
	disposeCommentThread(ownerId: string, threadId: string): void;
	getDocumentComments(resource: URI): Promise<(ICommentInfo | null)[]>;
	getNotebookComments(resource: URI): Promise<(INotebookCommentInfo | null)[]>;
	updateCommentingRanges(ownerId: string): void;
	getCommentingRanges(resource: URI): Promise<IRange[]>;
	hasReactionHandler(owner: string): boolean;
	toggleReaction(owner: string, resource: URI, thread: CommentThread<IRange | ICellRange>, comment: Comment, reaction: CommentReaction): Promise<void>;
	setActiveCommentThread(commentThread: CommentThread<IRange | ICellRange> | null): void;
	setCurrentCommentThread(commentThread: CommentThread<IRange | ICellRange> | undefined): void;
}

export class CommentService extends Disposable implements ICommentService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidSetDataProvider: Emitter<void> = this._register(new Emitter<void>());
	readonly onDidSetDataProvider: Event<void> = this._onDidSetDataProvider.event;

	private readonly _onDidDeleteDataProvider: Emitter<string> = this._register(new Emitter<string>());
	readonly onDidDeleteDataProvider: Event<string> = this._onDidDeleteDataProvider.event;

	private readonly _onDidSetResourceCommentInfos: Emitter<IResourceCommentThreadEvent> = this._register(new Emitter<IResourceCommentThreadEvent>());
	readonly onDidSetResourceCommentInfos: Event<IResourceCommentThreadEvent> = this._onDidSetResourceCommentInfos.event;

	private readonly _onDidSetAllCommentThreads: Emitter<IWorkspaceCommentThreadsEvent> = this._register(new Emitter<IWorkspaceCommentThreadsEvent>());
	readonly onDidSetAllCommentThreads: Event<IWorkspaceCommentThreadsEvent> = this._onDidSetAllCommentThreads.event;

	private readonly _onDidUpdateCommentThreads: Emitter<ICommentThreadChangedEvent> = this._register(new Emitter<ICommentThreadChangedEvent>());
	readonly onDidUpdateCommentThreads: Event<ICommentThreadChangedEvent> = this._onDidUpdateCommentThreads.event;

	private readonly _onDidUpdateNotebookCommentThreads: Emitter<INotebookCommentThreadChangedEvent> = this._register(new Emitter<INotebookCommentThreadChangedEvent>());
	readonly onDidUpdateNotebookCommentThreads: Event<INotebookCommentThreadChangedEvent> = this._onDidUpdateNotebookCommentThreads.event;

	private readonly _onDidUpdateCommentingRanges: Emitter<{ owner: string }> = this._register(new Emitter<{ owner: string }>());
	readonly onDidUpdateCommentingRanges: Event<{ owner: string }> = this._onDidUpdateCommentingRanges.event;

	private readonly _onDidChangeActiveCommentThread = this._register(new Emitter<CommentThread | null>());
	readonly onDidChangeActiveCommentThread = this._onDidChangeActiveCommentThread.event;

	private readonly _onDidChangeCurrentCommentThread = this._register(new Emitter<CommentThread | undefined>());
	readonly onDidChangeCurrentCommentThread = this._onDidChangeCurrentCommentThread.event;

	private readonly _onDidChangeActiveCommentingRange: Emitter<{
		range: Range; commentingRangesInfo:
		CommentingRanges;
	}> = this._register(new Emitter<{
		range: Range; commentingRangesInfo:
		CommentingRanges;
	}>());
	readonly onDidChangeActiveCommentingRange: Event<{ range: Range; commentingRangesInfo: CommentingRanges }> = this._onDidChangeActiveCommentingRange.event;

	private _commentControls = new Map<string, ICommentController>();
	private _commentMenus = new Map<string, CommentMenus>();

	constructor(
		@IInstantiationService protected instantiationService: IInstantiationService
	) {
		super();
	}

	/**
	 * The current comment thread is the thread that has focus or is being hovered.
	 * @param commentThread
	 */
	setCurrentCommentThread(commentThread: CommentThread | undefined) {
		this._onDidChangeCurrentCommentThread.fire(commentThread);
	}

	/**
	 * The active comment thread is the the thread that is currently being edited.
	 * @param commentThread
	 */
	setActiveCommentThread(commentThread: CommentThread | null) {
		this._onDidChangeActiveCommentThread.fire(commentThread);
	}

	setDocumentComments(resource: URI, commentInfos: ICommentInfo[]): void {
		this._onDidSetResourceCommentInfos.fire({ resource, commentInfos });
	}

	setWorkspaceComments(owner: string, commentsByResource: CommentThread[]): void {
		this._onDidSetAllCommentThreads.fire({ ownerId: owner, commentThreads: commentsByResource });
	}

	removeWorkspaceComments(owner: string): void {
		this._onDidSetAllCommentThreads.fire({ ownerId: owner, commentThreads: [] });
	}

	registerCommentController(owner: string, commentControl: ICommentController): void {
		this._commentControls.set(owner, commentControl);
		this._onDidSetDataProvider.fire();
	}

	unregisterCommentController(owner: string): void {
		this._commentControls.delete(owner);
		this._onDidDeleteDataProvider.fire(owner);
	}

	getCommentController(owner: string): ICommentController | undefined {
		return this._commentControls.get(owner);
	}

	createCommentThreadTemplate(owner: string, resource: URI, range: Range): void {
		const commentController = this._commentControls.get(owner);

		if (!commentController) {
			return;
		}

		commentController.createCommentThreadTemplate(resource, range);
	}

	async updateCommentThreadTemplate(owner: string, threadHandle: number, range: Range) {
		const commentController = this._commentControls.get(owner);

		if (!commentController) {
			return;
		}

		await commentController.updateCommentThreadTemplate(threadHandle, range);
	}

	disposeCommentThread(owner: string, threadId: string) {
		let controller = this.getCommentController(owner);
		if (controller) {
			controller.deleteCommentThreadMain(threadId);
		}
	}

	getCommentMenus(owner: string): CommentMenus {
		if (this._commentMenus.get(owner)) {
			return this._commentMenus.get(owner)!;
		}

		let menu = this.instantiationService.createInstance(CommentMenus);
		this._commentMenus.set(owner, menu);
		return menu;
	}

	updateComments(ownerId: string, event: CommentThreadChangedEvent<IRange>): void {
		const evt: ICommentThreadChangedEvent = Object.assign({}, event, { owner: ownerId });
		this._onDidUpdateCommentThreads.fire(evt);
	}

	updateNotebookComments(ownerId: string, event: CommentThreadChangedEvent<ICellRange>): void {
		const evt: INotebookCommentThreadChangedEvent = Object.assign({}, event, { owner: ownerId });
		this._onDidUpdateNotebookCommentThreads.fire(evt);
	}

	updateCommentingRanges(ownerId: string) {
		this._onDidUpdateCommentingRanges.fire({ owner: ownerId });
	}

	async toggleReaction(owner: string, resource: URI, thread: CommentThread, comment: Comment, reaction: CommentReaction): Promise<void> {
		const commentController = this._commentControls.get(owner);

		if (commentController) {
			return commentController.toggleReaction(resource, thread, comment, reaction, CancellationToken.None);
		} else {
			throw new Error('Not supported');
		}
	}

	hasReactionHandler(owner: string): boolean {
		const commentProvider = this._commentControls.get(owner);

		if (commentProvider) {
			return !!commentProvider.features.reactionHandler;
		}

		return false;
	}

	async getDocumentComments(resource: URI): Promise<(ICommentInfo | null)[]> {
		let commentControlResult: Promise<ICommentInfo | null>[] = [];

		this._commentControls.forEach(control => {
			commentControlResult.push(control.getDocumentComments(resource, CancellationToken.None)
				.catch(_ => {
					return null;
				}));
		});

		return Promise.all(commentControlResult);
	}

	async getNotebookComments(resource: URI): Promise<(INotebookCommentInfo | null)[]> {
		let commentControlResult: Promise<INotebookCommentInfo | null>[] = [];

		this._commentControls.forEach(control => {
			commentControlResult.push(control.getNotebookComments(resource, CancellationToken.None)
				.catch(_ => {
					return null;
				}));
		});

		return Promise.all(commentControlResult);
	}

	async getCommentingRanges(resource: URI): Promise<IRange[]> {
		let commentControlResult: Promise<IRange[]>[] = [];

		this._commentControls.forEach(control => {
			commentControlResult.push(control.getCommentingRanges(resource, CancellationToken.None));
		});

		let ret = await Promise.all(commentControlResult);
		return ret.reduce((prev, curr) => { prev.push(...curr); return prev; }, []);
	}
}
