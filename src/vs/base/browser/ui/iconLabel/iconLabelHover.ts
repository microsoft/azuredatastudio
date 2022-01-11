/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { HoverPosition } from 'vs/base/browser/ui/hover/hoverWidget';
import { IHoverDelegate, IHoverDelegateTarget } from 'vs/base/browser/ui/iconLabel/iconHoverDelegate';
import { IIconLabelMarkdownString } from 'vs/base/browser/ui/iconLabel/iconLabel';
import { RunOnceScheduler } from 'vs/base/common/async';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { IMarkdownString } from 'vs/base/common/htmlContent';
import { IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { isFunction, isString } from 'vs/base/common/types';
import { localize } from 'vs/nls';


export function setupNativeHover(htmlElement: HTMLElement, tooltip: string | IIconLabelMarkdownString | undefined): void {
	if (isString(tooltip)) {
		htmlElement.title = tooltip;
	} else if (tooltip?.markdownNotSupportedFallback) {
		htmlElement.title = tooltip.markdownNotSupportedFallback;
	} else {
		htmlElement.removeAttribute('title');
	}
}

export function setupCustomHover(hoverDelegate: IHoverDelegate, htmlElement: HTMLElement, markdownTooltip: string | IIconLabelMarkdownString | undefined): IDisposable | undefined {
	if (!markdownTooltip) {
		return undefined;
	}

	const tooltip = getTooltipForCustom(markdownTooltip);

	let hoverPreparation: IDisposable | undefined;

	let hoverWidget: IDisposable | undefined;

	const mouseEnter = (e: MouseEvent) => {
		if (hoverPreparation) {
			return;
		}

		const tokenSource = new CancellationTokenSource();

		const mouseLeaveOrDown = (e: MouseEvent) => {
			const isMouseDown = e.type === dom.EventType.MOUSE_DOWN;
			if (isMouseDown) {
				hoverWidget?.dispose();
				hoverWidget = undefined;
			}
			if (isMouseDown || (<any>e).fromElement === htmlElement) {
				hoverPreparation?.dispose();
				hoverPreparation = undefined;
			}
		};
		const mouseLeaveDomListener = dom.addDisposableListener(htmlElement, dom.EventType.MOUSE_LEAVE, mouseLeaveOrDown, true);
		const mouseDownDownListener = dom.addDisposableListener(htmlElement, dom.EventType.MOUSE_DOWN, mouseLeaveOrDown, true);

		const target: IHoverDelegateTarget = {
			targetElements: [htmlElement],
			dispose: () => { }
		};

		let mouseMoveDomListener: IDisposable | undefined;
		if (hoverDelegate.placement === undefined || hoverDelegate.placement === 'mouse') {
			const mouseMove = (e: MouseEvent) => target.x = e.x + 10;
			mouseMoveDomListener = dom.addDisposableListener(htmlElement, dom.EventType.MOUSE_MOVE, mouseMove, true);
		}

		const showHover = async () => {
			if (hoverPreparation) {

				const hoverOptions = {
					content: localize('iconLabel.loading', "Loading..."),
					target,
					hoverPosition: HoverPosition.BELOW
				};
				hoverWidget?.dispose();
				hoverWidget = hoverDelegate.showHover(hoverOptions);

				const resolvedTooltip = (await tooltip(tokenSource.token)) ?? (!isString(markdownTooltip) ? markdownTooltip.markdownNotSupportedFallback : undefined);

				hoverWidget?.dispose();
				hoverWidget = undefined;

				// awaiting the tooltip could take a while. Make sure we're still preparing to hover.
				if (resolvedTooltip && hoverPreparation) {
					const hoverOptions = {
						content: resolvedTooltip,
						target,
						showPointer: hoverDelegate.placement === 'element',
						hoverPosition: HoverPosition.BELOW
					};

					hoverWidget = hoverDelegate.showHover(hoverOptions);
				}

			}
			mouseMoveDomListener?.dispose();
		};
		const timeout = new RunOnceScheduler(showHover, hoverDelegate.delay);
		timeout.schedule();

		hoverPreparation = toDisposable(() => {
			timeout.dispose();
			mouseMoveDomListener?.dispose();
			mouseDownDownListener.dispose();
			mouseLeaveDomListener.dispose();
			tokenSource.dispose(true);
		});
	};
	const mouseOverDomEmitter = dom.addDisposableListener(htmlElement, dom.EventType.MOUSE_OVER, mouseEnter, true);
	return toDisposable(() => {
		mouseOverDomEmitter.dispose();
		hoverPreparation?.dispose();
		hoverWidget?.dispose();
	});
}


function getTooltipForCustom(markdownTooltip: string | IIconLabelMarkdownString): (token: CancellationToken) => Promise<string | IMarkdownString | undefined> {
	if (isString(markdownTooltip)) {
		return async () => markdownTooltip;
	} else if (isFunction(markdownTooltip.markdown)) {
		return markdownTooltip.markdown;
	} else {
		const markdown = markdownTooltip.markdown;
		return async () => markdown;
	}
}
