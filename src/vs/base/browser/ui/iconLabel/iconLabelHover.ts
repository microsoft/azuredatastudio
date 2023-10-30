/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { HoverPosition } from 'vs/base/browser/ui/hover/hoverWidget';
import { IHoverDelegate, IHoverDelegateOptions, IHoverDelegateTarget, IHoverWidget } from 'vs/base/browser/ui/iconLabel/iconHoverDelegate';
import { TimeoutTimer } from 'vs/base/common/async';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { IMarkdownString, isMarkdownString } from 'vs/base/common/htmlContent';
import { stripIcons } from 'vs/base/common/iconLabels';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { isFunction, isString } from 'vs/base/common/types';
import { localize } from 'vs/nls';

export interface ITooltipMarkdownString {
	markdown: IMarkdownString | string | undefined | ((token: CancellationToken) => Promise<IMarkdownString | string | undefined>);
	markdownNotSupportedFallback: string | undefined;
}

export function setupNativeHover(htmlElement: HTMLElement, tooltip: string | ITooltipMarkdownString | undefined): void {
	if (isString(tooltip)) {
		// Icons don't render in the native hover so we strip them out
		htmlElement.title = stripIcons(tooltip);
	} else if (tooltip?.markdownNotSupportedFallback) {
		htmlElement.title = tooltip.markdownNotSupportedFallback;
	} else {
		htmlElement.removeAttribute('title');
	}
}

type IHoverContent = string | ITooltipMarkdownString | HTMLElement | undefined;
type IResolvedHoverContent = IMarkdownString | string | HTMLElement | undefined;

/**
 * Copied from src\vs\workbench\services\hover\browser\hover.ts
 * @deprecated Use IHoverService
 */
interface IHoverAction {
	label: string;
	commandId: string;
	iconClass?: string;
	run(target: HTMLElement): void;
}

export interface IUpdatableHoverOptions {
	actions?: IHoverAction[];
	linkHandler?(url: string): void;
}

export interface ICustomHover extends IDisposable {

	/**
	 * Allows to programmatically open the hover.
	 */
	show(focus?: boolean): void;

	/**
	 * Allows to programmatically hide the hover.
	 */
	hide(): void;

	/**
	 * Updates the contents of the hover.
	 */
	update(tooltip: IHoverContent, options?: IUpdatableHoverOptions): void;
}


class UpdatableHoverWidget implements IDisposable {

	private _hoverWidget: IHoverWidget | undefined;
	private _cancellationTokenSource: CancellationTokenSource | undefined;

	constructor(private hoverDelegate: IHoverDelegate, private target: IHoverDelegateTarget | HTMLElement, private fadeInAnimation: boolean) {
	}

	async update(content: IHoverContent, focus?: boolean, options?: IUpdatableHoverOptions): Promise<void> {
		if (this._cancellationTokenSource) {
			// there's an computation ongoing, cancel it
			this._cancellationTokenSource.dispose(true);
			this._cancellationTokenSource = undefined;
		}
		if (this.isDisposed) {
			return;
		}

		let resolvedContent;
		if (content === undefined || isString(content) || content instanceof HTMLElement) {
			resolvedContent = content;
		} else if (!isFunction(content.markdown)) {
			resolvedContent = content.markdown ?? content.markdownNotSupportedFallback;
		} else {
			// compute the content, potentially long-running

			// show 'Loading' if no hover is up yet
			if (!this._hoverWidget) {
				this.show(localize('iconLabel.loading', "Loading..."), focus);
			}

			// compute the content
			this._cancellationTokenSource = new CancellationTokenSource();
			const token = this._cancellationTokenSource.token;
			resolvedContent = await content.markdown(token);
			if (resolvedContent === undefined) {
				resolvedContent = content.markdownNotSupportedFallback;
			}

			if (this.isDisposed || token.isCancellationRequested) {
				// either the widget has been closed in the meantime
				// or there has been a new call to `update`
				return;
			}
		}

		this.show(resolvedContent, focus, options);
	}

	private show(content: IResolvedHoverContent, focus?: boolean, options?: IUpdatableHoverOptions): void {
		const oldHoverWidget = this._hoverWidget;

		if (this.hasContent(content)) {
			const hoverOptions: IHoverDelegateOptions = {
				content,
				target: this.target,
				showPointer: this.hoverDelegate.placement === 'element',
				hoverPosition: HoverPosition.BELOW,
				skipFadeInAnimation: !this.fadeInAnimation || !!oldHoverWidget, // do not fade in if the hover is already showing
				...options
			};

			this._hoverWidget = this.hoverDelegate.showHover(hoverOptions, focus);
		}
		oldHoverWidget?.dispose();
	}

	private hasContent(content: IResolvedHoverContent): content is NonNullable<IResolvedHoverContent> {
		if (!content) {
			return false;
		}

		if (isMarkdownString(content)) {
			return !!content.value;
		}

		return true;
	}

	get isDisposed() {
		return this._hoverWidget?.isDisposed;
	}

	dispose(): void {
		this._hoverWidget?.dispose();
		this._cancellationTokenSource?.dispose(true);
		this._cancellationTokenSource = undefined;
	}
}

export function setupCustomHover(hoverDelegate: IHoverDelegate, htmlElement: HTMLElement, content: IHoverContent, options?: IUpdatableHoverOptions): ICustomHover {
	let hoverPreparation: IDisposable | undefined;

	let hoverWidget: UpdatableHoverWidget | undefined;

	const hideHover = (disposeWidget: boolean, disposePreparation: boolean) => {
		const hadHover = hoverWidget !== undefined;
		if (disposeWidget) {
			hoverWidget?.dispose();
			hoverWidget = undefined;
		}
		if (disposePreparation) {
			hoverPreparation?.dispose();
			hoverPreparation = undefined;
		}
		if (hadHover) {
			hoverDelegate.onDidHideHover?.();
		}
	};

	const triggerShowHover = (delay: number, focus?: boolean, target?: IHoverDelegateTarget) => {
		return new TimeoutTimer(async () => {
			if (!hoverWidget || hoverWidget.isDisposed) {
				hoverWidget = new UpdatableHoverWidget(hoverDelegate, target || htmlElement, delay > 0);
				await hoverWidget.update(content, focus, options);
			}
		}, delay);
	};

	const onMouseOver = () => {
		if (hoverPreparation) {
			return;
		}

		const toDispose: DisposableStore = new DisposableStore();

		const onMouseLeave = (e: MouseEvent) => hideHover(false, (<any>e).fromElement === htmlElement);
		toDispose.add(dom.addDisposableListener(htmlElement, dom.EventType.MOUSE_LEAVE, onMouseLeave, true));

		const onMouseDown = () => hideHover(true, true);
		toDispose.add(dom.addDisposableListener(htmlElement, dom.EventType.MOUSE_DOWN, onMouseDown, true));

		const target: IHoverDelegateTarget = {
			targetElements: [htmlElement],
			dispose: () => { }
		};
		if (hoverDelegate.placement === undefined || hoverDelegate.placement === 'mouse') {
			// track the mouse position
			const onMouseMove = (e: MouseEvent) => {
				target.x = e.x + 10;
				if ((e.target instanceof HTMLElement) && e.target.classList.contains('action-label')) {
					hideHover(true, true);
				}
			};
			toDispose.add(dom.addDisposableListener(htmlElement, dom.EventType.MOUSE_MOVE, onMouseMove, true));
		}
		toDispose.add(triggerShowHover(hoverDelegate.delay, false, target));

		hoverPreparation = toDispose;
	};
	const mouseOverDomEmitter = dom.addDisposableListener(htmlElement, dom.EventType.MOUSE_OVER, onMouseOver, true);
	const hover: ICustomHover = {
		show: focus => {
			hideHover(false, true); // terminate a ongoing mouse over preparation
			triggerShowHover(0, focus); // show hover immediately
		},
		hide: () => {
			hideHover(true, true);
		},
		update: async (newContent, hoverOptions) => {
			content = newContent;
			await hoverWidget?.update(content, undefined, hoverOptions);
		},
		dispose: () => {
			mouseOverDomEmitter.dispose();
			hideHover(true, true);
		}
	};
	return hover;
}
