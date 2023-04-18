/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { computeClippingRect, Dimension } from 'vs/base/browser/dom';
import { IMouseWheelEvent } from 'vs/base/browser/mouseEvent';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, DisposableStore, MutableDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { IWebviewService, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_ENABLED, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_VISIBLE, IWebview, WebviewContentOptions, IWebviewElement, WebviewExtensionDescription, WebviewMessageReceivedEvent, WebviewOptions, IOverlayWebview } from 'vs/workbench/contrib/webview/browser/webview';
import { WebviewInitInfo } from 'vs/workbench/contrib/webview/browser/webviewElement';

/**
 * Webview that is absolutely positioned over another element and that can creates and destroys an underlying webview as needed.
 */
export class OverlayWebview extends Disposable implements IOverlayWebview {

	private readonly _onDidWheel = this._register(new Emitter<IMouseWheelEvent>());
	public readonly onDidWheel = this._onDidWheel.event;

	private _isFirstLoad = true;
	private readonly _firstLoadPendingMessages = new Set<{ readonly message: any; readonly transfer?: readonly ArrayBuffer[]; readonly resolve: (value: boolean) => void }>();
	private readonly _webview = this._register(new MutableDisposable<IWebviewElement>());
	private readonly _webviewEvents = this._register(new DisposableStore());

	private _html: string = '';
	private _initialScrollProgress: number = 0;
	private _state: string | undefined = undefined;
	private _repositionTimeout: any | undefined = undefined;

	private _extension: WebviewExtensionDescription | undefined;
	private _contentOptions: WebviewContentOptions;
	private _options: WebviewOptions;

	private _owner: any = undefined;

	private readonly _scopedContextKeyService = this._register(new MutableDisposable<IContextKeyService>());
	private _findWidgetVisible: IContextKey<boolean> | undefined;
	private _findWidgetEnabled: IContextKey<boolean> | undefined;

	public readonly id: string;
	public readonly providedId?: string;
	public readonly origin: string;

	public constructor(
		initInfo: WebviewInitInfo,
		@ILayoutService private readonly _layoutService: ILayoutService,
		@IWebviewService private readonly _webviewService: IWebviewService,
		@IContextKeyService private readonly _baseContextKeyService: IContextKeyService
	) {
		super();

		this.id = initInfo.id;
		this.providedId = initInfo.providedId;
		this.origin = initInfo.origin ?? generateUuid();

		this._extension = initInfo.extension;
		this._options = initInfo.options;
		this._contentOptions = initInfo.contentOptions;
	}

	public get isFocused() {
		return !!this._webview.value?.isFocused;
	}

	private _isDisposed = false;

	private readonly _onDidDispose = this._register(new Emitter<void>());
	public onDidDispose = this._onDidDispose.event;

	override dispose() {
		this._isDisposed = true;

		this._container?.remove();
		this._container = undefined;

		for (const msg of this._firstLoadPendingMessages) {
			msg.resolve(false);
		}
		this._firstLoadPendingMessages.clear();

		clearTimeout(this._repositionTimeout);

		this._onDidDispose.fire();

		super.dispose();
	}

	private _container: HTMLElement | undefined;

	public get container(): HTMLElement {
		if (this._isDisposed) {
			throw new Error(`DynamicWebviewEditorOverlay has been disposed`);
		}

		if (!this._container) {
			this._container = document.createElement('div');
			this._container.id = `webview-${this.id}`;
			this._container.style.visibility = 'hidden';

			// Webviews cannot be reparented in the dom as it will destroy their contents.
			// Mount them to a high level node to avoid this.
			this._layoutService.container.appendChild(this._container);
		}

		return this._container;
	}

	public claim(owner: any, scopedContextKeyService: IContextKeyService | undefined) {
		const oldOwner = this._owner;

		this._owner = owner;
		this.show();

		if (oldOwner !== owner) {
			const contextKeyService = (scopedContextKeyService || this._baseContextKeyService);

			// Explicitly clear before creating the new context.
			// Otherwise we create the new context while the old one is still around
			this._scopedContextKeyService.clear();
			this._scopedContextKeyService.value = contextKeyService.createScoped(this.container);

			this._findWidgetVisible?.reset();
			this._findWidgetVisible = KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_VISIBLE.bindTo(contextKeyService);

			this._findWidgetEnabled?.reset();
			this._findWidgetEnabled = KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_ENABLED.bindTo(contextKeyService);
			this._findWidgetEnabled.set(!!this.options.enableFindWidget);

			this._webview.value?.setContextKeyService(this._scopedContextKeyService.value);
		}
	}

	public release(owner: any) {
		if (this._owner !== owner) {
			return;
		}

		this._scopedContextKeyService.clear();

		this._owner = undefined;
		if (this._container) {
			this._container.style.visibility = 'hidden';
		}
		if (!this._options.retainContextWhenHidden) {
			this._webview.clear();
			this._webviewEvents.clear();
		}
	}

	public layoutWebviewOverElement(element: HTMLElement, dimension?: Dimension, clippingContainer?: HTMLElement) {
		this.doLayoutWebviewOverElement(element, dimension, clippingContainer);

		// Temporary fix for https://github.com/microsoft/vscode/issues/110450
		// There is an animation that lasts about 200ms, update the webview positioning once this animation is complete.
		clearTimeout(this._repositionTimeout);
		this._repositionTimeout = setTimeout(() => {
			this.doLayoutWebviewOverElement(element, dimension, clippingContainer);
		}, 200);
	}

	public doLayoutWebviewOverElement(element: HTMLElement, dimension?: Dimension, clippingContainer?: HTMLElement) {
		if (!this._container || !this._container.parentElement) {
			return;
		}

		const frameRect = element.getBoundingClientRect();
		const containerRect = this._container.parentElement.getBoundingClientRect();
		const parentBorderTop = (containerRect.height - this._container.parentElement.clientHeight) / 2.0;
		const parentBorderLeft = (containerRect.width - this._container.parentElement.clientWidth) / 2.0;
		this._container.style.position = 'absolute';
		this._container.style.overflow = 'hidden';
		this._container.style.top = `${frameRect.top - containerRect.top - parentBorderTop}px`;
		this._container.style.left = `${frameRect.left - containerRect.left - parentBorderLeft}px`;
		this._container.style.width = `${dimension ? dimension.width : frameRect.width}px`;
		this._container.style.height = `${dimension ? dimension.height : frameRect.height}px`;

		if (clippingContainer) {
			const { top, left, right, bottom } = computeClippingRect(frameRect, clippingContainer);
			this._container.style.clipPath = `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`;
		}
	}

	private show() {
		if (this._isDisposed) {
			throw new Error('Webview overlay is disposed');
		}

		if (!this._webview.value) {
			const webview = this._webviewService.createWebviewElement({
				id: this.id,
				providedId: this.providedId,
				origin: this.origin,
				options: this._options,
				contentOptions: this._contentOptions,
				extension: this.extension,
			});
			this._webview.value = webview;
			webview.state = this._state;

			if (this._scopedContextKeyService.value) {
				this._webview.value.setContextKeyService(this._scopedContextKeyService.value);
			}

			if (this._html) {
				webview.html = this._html;
			}

			if (this._options.tryRestoreScrollPosition) {
				webview.initialScrollProgress = this._initialScrollProgress;
			}

			this._findWidgetEnabled?.set(!!this.options.enableFindWidget);

			webview.mountTo(this.container);

			// Forward events from inner webview to outer listeners
			this._webviewEvents.clear();
			this._webviewEvents.add(webview.onDidFocus(() => { this._onDidFocus.fire(); }));
			this._webviewEvents.add(webview.onDidBlur(() => { this._onDidBlur.fire(); }));
			this._webviewEvents.add(webview.onDidClickLink(x => { this._onDidClickLink.fire(x); }));
			this._webviewEvents.add(webview.onMessage(x => { this._onMessage.fire(x); }));
			this._webviewEvents.add(webview.onMissingCsp(x => { this._onMissingCsp.fire(x); }));
			this._webviewEvents.add(webview.onDidWheel(x => { this._onDidWheel.fire(x); }));
			this._webviewEvents.add(webview.onDidReload(() => { this._onDidReload.fire(); }));

			this._webviewEvents.add(webview.onDidScroll(x => {
				this._initialScrollProgress = x.scrollYPercentage;
				this._onDidScroll.fire(x);
			}));

			this._webviewEvents.add(webview.onDidUpdateState(state => {
				this._state = state;
				this._onDidUpdateState.fire(state);
			}));

			if (this._isFirstLoad) {
				this._firstLoadPendingMessages.forEach(async msg => {
					msg.resolve(await webview.postMessage(msg.message, msg.transfer));
				});
			}
			this._isFirstLoad = false;
			this._firstLoadPendingMessages.clear();
		}

		this.container.style.visibility = 'visible';
	}

	public get html(): string { return this._html; }
	public set html(value: string) {
		this._html = value;
		this.withWebview(webview => webview.html = value);
	}

	public get initialScrollProgress(): number { return this._initialScrollProgress; }
	public set initialScrollProgress(value: number) {
		this._initialScrollProgress = value;
		this.withWebview(webview => webview.initialScrollProgress = value);
	}

	public get state(): string | undefined { return this._state; }
	public set state(value: string | undefined) {
		this._state = value;
		this.withWebview(webview => webview.state = value);
	}

	public get extension(): WebviewExtensionDescription | undefined { return this._extension; }
	public set extension(value: WebviewExtensionDescription | undefined) {
		this._extension = value;
		this.withWebview(webview => webview.extension = value);
	}

	public get options(): WebviewOptions { return this._options; }
	public set options(value: WebviewOptions) { this._options = { customClasses: this._options.customClasses, ...value }; }

	public get contentOptions(): WebviewContentOptions { return this._contentOptions; }
	public set contentOptions(value: WebviewContentOptions) {
		this._contentOptions = value;
		this.withWebview(webview => webview.contentOptions = value);
	}

	public set localResourcesRoot(resources: URI[]) {
		this.withWebview(webview => webview.localResourcesRoot = resources);
	}

	private readonly _onDidFocus = this._register(new Emitter<void>());
	public readonly onDidFocus: Event<void> = this._onDidFocus.event;

	private readonly _onDidBlur = this._register(new Emitter<void>());
	public readonly onDidBlur: Event<void> = this._onDidBlur.event;

	private readonly _onDidClickLink = this._register(new Emitter<string>());
	public readonly onDidClickLink: Event<string> = this._onDidClickLink.event;

	private readonly _onDidReload = this._register(new Emitter<void>());
	public readonly onDidReload = this._onDidReload.event;

	private readonly _onDidScroll = this._register(new Emitter<{ scrollYPercentage: number }>());
	public readonly onDidScroll: Event<{ scrollYPercentage: number }> = this._onDidScroll.event;

	private readonly _onDidUpdateState = this._register(new Emitter<string | undefined>());
	public readonly onDidUpdateState: Event<string | undefined> = this._onDidUpdateState.event;

	private readonly _onMessage = this._register(new Emitter<WebviewMessageReceivedEvent>());
	public readonly onMessage = this._onMessage.event;

	private readonly _onMissingCsp = this._register(new Emitter<ExtensionIdentifier>());
	public readonly onMissingCsp: Event<any> = this._onMissingCsp.event;

	public async postMessage(message: any, transfer?: readonly ArrayBuffer[]): Promise<boolean> {
		if (this._webview.value) {
			return this._webview.value.postMessage(message, transfer);
		}

		if (this._isFirstLoad) {
			let resolve: (x: boolean) => void;
			const p = new Promise<boolean>(r => resolve = r);
			this._firstLoadPendingMessages.add({ message, transfer, resolve: resolve! });
			return p;
		}

		return false;
	}

	focus(): void { this._webview.value?.focus(); }
	reload(): void { this._webview.value?.reload(); }
	selectAll(): void { this._webview.value?.selectAll(); }
	copy(): void { this._webview.value?.copy(); }
	paste(): void { this._webview.value?.paste(); }
	cut(): void { this._webview.value?.cut(); }
	undo(): void { this._webview.value?.undo(); }
	redo(): void { this._webview.value?.redo(); }

	showFind() {
		if (this._webview.value) {
			this._webview.value.showFind();
			this._findWidgetVisible?.set(true);
		}
	}

	hideFind() {
		this._findWidgetVisible?.reset();
		this._webview.value?.hideFind();
	}

	runFindAction(previous: boolean): void { this._webview.value?.runFindAction(previous); }

	private withWebview(f: (webview: IWebview) => void): void {
		if (this._webview.value) {
			f(this._webview.value);
		}
	}

	windowDidDragStart() {
		this._webview.value?.windowDidDragStart();
	}

	windowDidDragEnd() {
		this._webview.value?.windowDidDragEnd();
	}

	setContextKeyService(contextKeyService: IContextKeyService) {
		this._webview.value?.setContextKeyService(contextKeyService);
	}
}
