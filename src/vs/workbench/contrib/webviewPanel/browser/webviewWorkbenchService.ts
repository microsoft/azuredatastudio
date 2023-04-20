/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancelablePromise, createCancelablePromise, DeferredPromise } from 'vs/base/common/async';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { memoize } from 'vs/base/common/decorators';
import { isCancellationError } from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import { Iterable } from 'vs/base/common/iterator';
import { combinedDisposable, Disposable, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { EditorActivation } from 'vs/platform/editor/common/editor';
import { createDecorator, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { GroupIdentifier } from 'vs/workbench/common/editor';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { IOverlayWebview, IWebviewService } from 'vs/workbench/contrib/webview/browser/webview';
import { WebviewInitInfo } from 'vs/workbench/contrib/webview/browser/webviewElement';
import { WebviewIconManager, WebviewIcons } from 'vs/workbench/contrib/webviewPanel/browser/webviewIconManager';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { ACTIVE_GROUP_TYPE, IEditorService, SIDE_GROUP_TYPE } from 'vs/workbench/services/editor/common/editorService';
import { WebviewInput, WebviewInputInitInfo } from './webviewEditorInput';

export const IWebviewWorkbenchService = createDecorator<IWebviewWorkbenchService>('webviewEditorService');

export interface ICreateWebViewShowOptions {
	readonly group?: IEditorGroup | GroupIdentifier | ACTIVE_GROUP_TYPE | SIDE_GROUP_TYPE;
	readonly preserveFocus?: boolean;
}

export interface IWebviewWorkbenchService {
	readonly _serviceBrand: undefined;

	readonly iconManager: WebviewIconManager;

	createWebview(
		webviewInitInfo: WebviewInitInfo,
		viewType: string,
		title: string,
		showOptions: ICreateWebViewShowOptions,
	): WebviewInput;

	reviveWebview(options: {
		webviewInitInfo: WebviewInitInfo;
		viewType: string;
		title: string;
		iconPath: WebviewIcons | undefined;
		state: any;
		group: number | undefined;
	}): WebviewInput;

	revealWebview(
		webview: WebviewInput,
		group: IEditorGroup | GroupIdentifier | ACTIVE_GROUP_TYPE | SIDE_GROUP_TYPE,
		preserveFocus: boolean
	): void;

	registerResolver(
		resolver: WebviewResolver
	): IDisposable;

	shouldPersist(
		input: WebviewInput
	): boolean;

	resolveWebview(
		webview: WebviewInput,
	): CancelablePromise<void>;

	readonly onDidChangeActiveWebviewEditor: Event<WebviewInput | undefined>;
}

export interface WebviewResolver {
	canResolve(
		webview: WebviewInput,
	): boolean;

	resolveWebview(
		webview: WebviewInput,
		cancellation: CancellationToken,
	): Promise<void>;
}

function canRevive(reviver: WebviewResolver, webview: WebviewInput): boolean {
	return reviver.canResolve(webview);
}


export class LazilyResolvedWebviewEditorInput extends WebviewInput {

	#resolved = false;
	#resolvePromise?: CancelablePromise<void>;


	constructor(
		init: WebviewInputInitInfo,
		webview: IOverlayWebview,
		@IWebviewWorkbenchService private readonly _webviewWorkbenchService: IWebviewWorkbenchService,
	) {
		super(init, webview, _webviewWorkbenchService.iconManager);
	}

	override dispose() {
		super.dispose();
		this.#resolvePromise?.cancel();
		this.#resolvePromise = undefined;
	}

	@memoize
	public override async resolve() {
		if (!this.#resolved) {
			this.#resolved = true;
			this.#resolvePromise = this._webviewWorkbenchService.resolveWebview(this);
			try {
				await this.#resolvePromise;
			} catch (e) {
				if (!isCancellationError(e)) {
					throw e;
				}
			}
		}
		return super.resolve();
	}

	protected override transfer(other: LazilyResolvedWebviewEditorInput): WebviewInput | undefined {
		if (!super.transfer(other)) {
			return undefined; // {{SQL CARBON EDIT}} strict-null-checks
		}

		other.#resolved = this.#resolved;
		return other;
	}
}


class RevivalPool {
	private _awaitingRevival: Array<{
		readonly input: WebviewInput;
		readonly promise: DeferredPromise<void>;
		readonly disposable: IDisposable;
	}> = [];

	public enqueueForRestoration(input: WebviewInput, token: CancellationToken): Promise<void> {
		const promise = new DeferredPromise<void>();

		const remove = () => {
			const index = this._awaitingRevival.findIndex(entry => input === entry.input);
			if (index >= 0) {
				this._awaitingRevival.splice(index, 1);
			}
		};

		const disposable = combinedDisposable(
			input.webview.onDidDispose(remove),
			token.onCancellationRequested(() => {
				remove();
				promise.cancel();
			}),
		);

		this._awaitingRevival.push({ input, promise, disposable });

		return promise.p;
	}

	public reviveFor(reviver: WebviewResolver, token: CancellationToken) {
		const toRevive = this._awaitingRevival.filter(({ input }) => canRevive(reviver, input));
		this._awaitingRevival = this._awaitingRevival.filter(({ input }) => !canRevive(reviver, input));

		for (const { input, promise: resolve, disposable } of toRevive) {
			reviver.resolveWebview(input, token).then(x => resolve.complete(x), err => resolve.error(err)).finally(() => {
				disposable.dispose();
			});
		}
	}
}


export class WebviewEditorService extends Disposable implements IWebviewWorkbenchService {
	declare readonly _serviceBrand: undefined;

	private readonly _revivers = new Set<WebviewResolver>();
	private readonly _revivalPool = new RevivalPool();

	private readonly _iconManager: WebviewIconManager;

	constructor(
		@IEditorService private readonly _editorService: IEditorService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IWebviewService private readonly _webviewService: IWebviewService,
	) {
		super();

		this._iconManager = this._register(this._instantiationService.createInstance(WebviewIconManager));

		this._register(_editorService.onDidActiveEditorChange(() => {
			this.updateActiveWebview();
		}));

		// The user may have switched focus between two sides of a diff editor
		this._register(_webviewService.onDidChangeActiveWebview(() => {
			this.updateActiveWebview();
		}));

		this.updateActiveWebview();
	}

	get iconManager() {
		return this._iconManager;
	}

	private _activeWebview: WebviewInput | undefined;

	private readonly _onDidChangeActiveWebviewEditor = this._register(new Emitter<WebviewInput | undefined>());
	public readonly onDidChangeActiveWebviewEditor = this._onDidChangeActiveWebviewEditor.event;

	private updateActiveWebview() {
		const activeInput = this._editorService.activeEditor;

		let newActiveWebview: WebviewInput | undefined;
		if (activeInput instanceof WebviewInput) {
			newActiveWebview = activeInput;
		} else if (activeInput instanceof DiffEditorInput) {
			if (activeInput.primary instanceof WebviewInput && activeInput.primary.webview === this._webviewService.activeWebview) {
				newActiveWebview = activeInput.primary;
			} else if (activeInput.secondary instanceof WebviewInput && activeInput.secondary.webview === this._webviewService.activeWebview) {
				newActiveWebview = activeInput.secondary;
			}
		}

		if (newActiveWebview !== this._activeWebview) {
			this._activeWebview = newActiveWebview;
			this._onDidChangeActiveWebviewEditor.fire(newActiveWebview);
		}
	}

	public createWebview(
		webviewInitInfo: WebviewInitInfo,
		viewType: string,
		title: string,
		showOptions: ICreateWebViewShowOptions,
	): WebviewInput {
		const webview = this._webviewService.createWebviewOverlay(webviewInitInfo);
		const webviewInput = this._instantiationService.createInstance(WebviewInput, { id: webviewInitInfo.id, viewType, name: title, providedId: webviewInitInfo.providedId }, webview, this.iconManager);
		this._editorService.openEditor(webviewInput, {
			pinned: true,
			preserveFocus: showOptions.preserveFocus,
			// preserve pre 1.38 behaviour to not make group active when preserveFocus: true
			// but make sure to restore the editor to fix https://github.com/microsoft/vscode/issues/79633
			activation: showOptions.preserveFocus ? EditorActivation.RESTORE : undefined
		}, showOptions.group);
		return webviewInput;
	}

	public revealWebview(
		webview: WebviewInput,
		group: IEditorGroup | GroupIdentifier | ACTIVE_GROUP_TYPE | SIDE_GROUP_TYPE,
		preserveFocus: boolean
	): void {
		const topLevelEditor = this.findTopLevelEditorForWebview(webview);

		this._editorService.openEditor(topLevelEditor, {
			preserveFocus,
			// preserve pre 1.38 behaviour to not make group active when preserveFocus: true
			// but make sure to restore the editor to fix https://github.com/microsoft/vscode/issues/79633
			activation: preserveFocus ? EditorActivation.RESTORE : undefined
		}, group);
	}

	private findTopLevelEditorForWebview(webview: WebviewInput): EditorInput {
		for (const editor of this._editorService.editors) {
			if (editor === webview) {
				return editor;
			}
			if (editor instanceof DiffEditorInput) {
				if (webview === editor.primary || webview === editor.secondary) {
					return editor;
				}
			}
		}
		return webview;
	}

	public reviveWebview(options: {
		webviewInitInfo: WebviewInitInfo;
		viewType: string;
		title: string;
		iconPath: WebviewIcons | undefined;
		state: any;
		group: number | undefined;
	}): WebviewInput {
		const webview = this._webviewService.createWebviewOverlay(options.webviewInitInfo);
		webview.state = options.state;

		const webviewInput = this._instantiationService.createInstance(LazilyResolvedWebviewEditorInput, { id: options.webviewInitInfo.id, viewType: options.viewType, providedId: options.webviewInitInfo.providedId, name: options.title }, webview);
		webviewInput.iconPath = options.iconPath;

		if (typeof options.group === 'number') {
			webviewInput.updateGroup(options.group);
		}
		return webviewInput;
	}

	public registerResolver(
		reviver: WebviewResolver
	): IDisposable {
		this._revivers.add(reviver);

		const cts = new CancellationTokenSource();
		this._revivalPool.reviveFor(reviver, cts.token);

		return toDisposable(() => {
			this._revivers.delete(reviver);
			cts.dispose(true);
		});
	}

	public shouldPersist(
		webview: WebviewInput
	): boolean {
		// Revived webviews may not have an actively registered reviver but we still want to presist them
		// since a reviver should exist when it is actually needed.
		if (webview instanceof LazilyResolvedWebviewEditorInput) {
			return true;
		}

		return Iterable.some(this._revivers.values(), reviver => canRevive(reviver, webview));
	}

	private async tryRevive(
		webview: WebviewInput,
		cancellation: CancellationToken,
	): Promise<boolean> {
		for (const reviver of this._revivers.values()) {
			if (canRevive(reviver, webview)) {
				await reviver.resolveWebview(webview, cancellation);
				return true;
			}
		}
		return false;
	}

	public resolveWebview(webview: WebviewInput): CancelablePromise<void> {
		return createCancelablePromise(async (cancellation) => {
			const didRevive = await this.tryRevive(webview, cancellation);
			if (!didRevive) {
				// A reviver may not be registered yet. Put into pool and resolve promise when we can revive
				return this._revivalPool.enqueueForRestoration(webview, cancellation);
			}
		});
	}

	public setIcons(id: string, iconPath: WebviewIcons | undefined): void {
		this._iconManager.setIcons(id, iconPath);
	}
}
