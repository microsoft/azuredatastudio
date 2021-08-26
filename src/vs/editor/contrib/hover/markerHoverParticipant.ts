/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import * as dom from 'vs/base/browser/dom';
import { IDisposable, toDisposable, DisposableStore, Disposable } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { Range } from 'vs/editor/common/core/range';
import { CodeActionTriggerType } from 'vs/editor/common/modes';
import { isNonEmptyArray } from 'vs/base/common/arrays';
import { IMarker, IMarkerData, MarkerSeverity } from 'vs/platform/markers/common/markers';
import { basename } from 'vs/base/common/resources';
import { IMarkerDecorationsService } from 'vs/editor/common/services/markersDecorationService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { MarkerController, NextMarkerAction } from 'vs/editor/contrib/gotoError/gotoError';
import { CancelablePromise, createCancelablePromise, disposableTimeout } from 'vs/base/common/async';
import { getCodeActions, CodeActionSet } from 'vs/editor/contrib/codeAction/codeAction';
import { QuickFixAction, QuickFixController } from 'vs/editor/contrib/codeAction/codeActionCommands';
import { CodeActionKind, CodeActionTrigger } from 'vs/editor/contrib/codeAction/types';
import { IModelDecoration } from 'vs/editor/common/model';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { Progress } from 'vs/platform/progress/common/progress';
import { ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { HoverAnchor, HoverAnchorType, IEditorHover, IEditorHoverParticipant, IEditorHoverStatusBar, IHoverPart } from 'vs/editor/contrib/hover/hoverTypes';

const $ = dom.$;

export class MarkerHover implements IHoverPart {

	constructor(
		public readonly owner: IEditorHoverParticipant<MarkerHover>,
		public readonly range: Range,
		public readonly marker: IMarker,
	) { }

	public isValidForHoverAnchor(anchor: HoverAnchor): boolean {
		return (
			anchor.type === HoverAnchorType.Range
			&& this.range.startColumn <= anchor.range.startColumn
			&& this.range.endColumn >= anchor.range.endColumn
		);
	}
}

const markerCodeActionTrigger: CodeActionTrigger = {
	type: CodeActionTriggerType.Invoke,
	filter: { include: CodeActionKind.QuickFix }
};

export class MarkerHoverParticipant implements IEditorHoverParticipant<MarkerHover> {

	private recentMarkerCodeActionsInfo: { marker: IMarker, hasCodeActions: boolean } | undefined = undefined;

	constructor(
		private readonly _editor: ICodeEditor,
		private readonly _hover: IEditorHover,
		@IMarkerDecorationsService private readonly _markerDecorationsService: IMarkerDecorationsService,
		@IOpenerService private readonly _openerService: IOpenerService,
	) { }

	public computeSync(anchor: HoverAnchor, lineDecorations: IModelDecoration[]): MarkerHover[] {
		if (!this._editor.hasModel() || anchor.type !== HoverAnchorType.Range) {
			return [];
		}

		const model = this._editor.getModel();
		const lineNumber = anchor.range.startLineNumber;
		const maxColumn = model.getLineMaxColumn(lineNumber);
		const result: MarkerHover[] = [];
		for (const d of lineDecorations) {
			const startColumn = (d.range.startLineNumber === lineNumber) ? d.range.startColumn : 1;
			const endColumn = (d.range.endLineNumber === lineNumber) ? d.range.endColumn : maxColumn;

			const marker = this._markerDecorationsService.getMarker(model.uri, d);
			if (!marker) {
				continue;
			}

			const range = new Range(anchor.range.startLineNumber, startColumn, anchor.range.startLineNumber, endColumn);
			result.push(new MarkerHover(this, range, marker));
		}

		return result;
	}

	public renderHoverParts(hoverParts: MarkerHover[], fragment: DocumentFragment, statusBar: IEditorHoverStatusBar): IDisposable {
		if (!hoverParts.length) {
			return Disposable.None;
		}
		const disposables = new DisposableStore();
		hoverParts.forEach(msg => fragment.appendChild(this.renderMarkerHover(msg, disposables)));
		const markerHoverForStatusbar = hoverParts.length === 1 ? hoverParts[0] : hoverParts.sort((a, b) => MarkerSeverity.compare(a.marker.severity, b.marker.severity))[0];
		this.renderMarkerStatusbar(markerHoverForStatusbar, statusBar, disposables);
		return disposables;
	}

	private renderMarkerHover(markerHover: MarkerHover, disposables: DisposableStore): HTMLElement {
		const hoverElement = $('div.hover-row');
		const markerElement = dom.append(hoverElement, $('div.marker.hover-contents'));
		const { source, message, code, relatedInformation } = markerHover.marker;

		this._editor.applyFontInfo(markerElement);
		const messageElement = dom.append(markerElement, $('span'));
		messageElement.style.whiteSpace = 'pre-wrap';
		messageElement.innerText = message;

		if (source || code) {
			// Code has link
			if (code && typeof code !== 'string') {
				const sourceAndCodeElement = $('span');
				if (source) {
					const sourceElement = dom.append(sourceAndCodeElement, $('span'));
					sourceElement.innerText = source;
				}
				const codeLink = dom.append(sourceAndCodeElement, $('a.code-link'));
				codeLink.setAttribute('href', code.target.toString());

				disposables.add(dom.addDisposableListener(codeLink, 'click', (e) => {
					this._openerService.open(code.target, { allowCommands: true });
					e.preventDefault();
					e.stopPropagation();
				}));

				const codeElement = dom.append(codeLink, $('span'));
				codeElement.innerText = code.value;

				const detailsElement = dom.append(markerElement, sourceAndCodeElement);
				detailsElement.style.opacity = '0.6';
				detailsElement.style.paddingLeft = '6px';
			} else {
				const detailsElement = dom.append(markerElement, $('span'));
				detailsElement.style.opacity = '0.6';
				detailsElement.style.paddingLeft = '6px';
				detailsElement.innerText = source && code ? `${source}(${code})` : source ? source : `(${code})`;
			}
		}

		if (isNonEmptyArray(relatedInformation)) {
			for (const { message, resource, startLineNumber, startColumn } of relatedInformation) {
				const relatedInfoContainer = dom.append(markerElement, $('div'));
				relatedInfoContainer.style.marginTop = '8px';
				const a = dom.append(relatedInfoContainer, $('a'));
				a.innerText = `${basename(resource)}(${startLineNumber}, ${startColumn}): `;
				a.style.cursor = 'pointer';
				disposables.add(dom.addDisposableListener(a, 'click', (e) => {
					e.stopPropagation();
					e.preventDefault();
					if (this._openerService) {
						this._openerService.open(resource, {
							fromUserGesture: true,
							editorOptions: <ITextEditorOptions>{ selection: { startLineNumber, startColumn } }
						}).catch(onUnexpectedError);
					}
				}));
				const messageElement = dom.append<HTMLAnchorElement>(relatedInfoContainer, $('span'));
				messageElement.innerText = message;
				this._editor.applyFontInfo(messageElement);
			}
		}

		return hoverElement;
	}

	private renderMarkerStatusbar(markerHover: MarkerHover, statusBar: IEditorHoverStatusBar, disposables: DisposableStore): void {
		if (markerHover.marker.severity === MarkerSeverity.Error || markerHover.marker.severity === MarkerSeverity.Warning || markerHover.marker.severity === MarkerSeverity.Info) {
			statusBar.addAction({
				label: nls.localize('view problem', "View Problem"),
				commandId: NextMarkerAction.ID,
				run: () => {
					this._hover.hide();
					MarkerController.get(this._editor).showAtMarker(markerHover.marker);
					this._editor.focus();
				}
			});
		}

		if (!this._editor.getOption(EditorOption.readOnly)) {
			const quickfixPlaceholderElement = statusBar.append($('div'));
			if (this.recentMarkerCodeActionsInfo) {
				if (IMarkerData.makeKey(this.recentMarkerCodeActionsInfo.marker) === IMarkerData.makeKey(markerHover.marker)) {
					if (!this.recentMarkerCodeActionsInfo.hasCodeActions) {
						quickfixPlaceholderElement.textContent = nls.localize('noQuickFixes', "No quick fixes available");
					}
				} else {
					this.recentMarkerCodeActionsInfo = undefined;
				}
			}
			const updatePlaceholderDisposable = this.recentMarkerCodeActionsInfo && !this.recentMarkerCodeActionsInfo.hasCodeActions ? Disposable.None : disposables.add(disposableTimeout(() => quickfixPlaceholderElement.textContent = nls.localize('checkingForQuickFixes', "Checking for quick fixes..."), 200));
			if (!quickfixPlaceholderElement.textContent) {
				// Have some content in here to avoid flickering
				quickfixPlaceholderElement.textContent = String.fromCharCode(0xA0); // &nbsp;
			}
			const codeActionsPromise = this.getCodeActions(markerHover.marker);
			disposables.add(toDisposable(() => codeActionsPromise.cancel()));
			codeActionsPromise.then(actions => {
				updatePlaceholderDisposable.dispose();
				this.recentMarkerCodeActionsInfo = { marker: markerHover.marker, hasCodeActions: actions.validActions.length > 0 };

				if (!this.recentMarkerCodeActionsInfo.hasCodeActions) {
					actions.dispose();
					quickfixPlaceholderElement.textContent = nls.localize('noQuickFixes', "No quick fixes available");
					return;
				}
				quickfixPlaceholderElement.style.display = 'none';

				let showing = false;
				disposables.add(toDisposable(() => {
					if (!showing) {
						actions.dispose();
					}
				}));

				statusBar.addAction({
					label: nls.localize('quick fixes', "Quick Fix..."),
					commandId: QuickFixAction.Id,
					run: (target) => {
						showing = true;
						const controller = QuickFixController.get(this._editor);
						const elementPosition = dom.getDomNodePagePosition(target);
						// Hide the hover pre-emptively, otherwise the editor can close the code actions
						// context menu as well when using keyboard navigation
						this._hover.hide();
						controller.showCodeActions(markerCodeActionTrigger, actions, {
							x: elementPosition.left + 6,
							y: elementPosition.top + elementPosition.height + 6
						});
					}
				});
			});
		}
	}

	private getCodeActions(marker: IMarker): CancelablePromise<CodeActionSet> {
		return createCancelablePromise(cancellationToken => {
			return getCodeActions(
				this._editor.getModel()!,
				new Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn),
				markerCodeActionTrigger,
				Progress.None,
				cancellationToken);
		});
	}
}
