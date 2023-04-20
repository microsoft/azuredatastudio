/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/review';
import * as dom from 'vs/base/browser/dom';
import { Emitter } from 'vs/base/common/event';
import { Disposable, dispose, IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import * as languages from 'vs/editor/common/languages';
import { IMarkdownRendererOptions } from 'vs/editor/contrib/markdownRenderer/browser/markdownRenderer';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CommentMenus } from 'vs/workbench/contrib/comments/browser/commentMenus';
import { CommentReply } from 'vs/workbench/contrib/comments/browser/commentReply';
import { ICommentService } from 'vs/workbench/contrib/comments/browser/commentService';
import { CommentThreadBody } from 'vs/workbench/contrib/comments/browser/commentThreadBody';
import { CommentThreadHeader } from 'vs/workbench/contrib/comments/browser/commentThreadHeader';
import { CommentContextKeys } from 'vs/workbench/contrib/comments/common/commentContextKeys';
import { ICommentThreadWidget } from 'vs/workbench/contrib/comments/common/commentThreadWidget';
import { IColorTheme } from 'vs/platform/theme/common/themeService';
import { contrastBorder, focusBorder, inputValidationErrorBackground, inputValidationErrorBorder, inputValidationErrorForeground, textBlockQuoteBackground, textBlockQuoteBorder, textLinkActiveForeground, textLinkForeground } from 'vs/platform/theme/common/colorRegistry';
import { PANEL_BORDER } from 'vs/workbench/common/theme';
import { IRange } from 'vs/editor/common/core/range';
import { commentThreadStateBackgroundColorVar, commentThreadStateColorVar } from 'vs/workbench/contrib/comments/browser/commentColors';
import { ICellRange } from 'vs/workbench/contrib/notebook/common/notebookRange';
import { FontInfo } from 'vs/editor/common/config/fontInfo';

export const COMMENTEDITOR_DECORATION_KEY = 'commenteditordecoration';


export class CommentThreadWidget<T extends IRange | ICellRange = IRange> extends Disposable implements ICommentThreadWidget {
	private _header!: CommentThreadHeader<T>;
	private _body!: CommentThreadBody<T>;
	private _commentReply?: CommentReply<T>;
	private _commentMenus: CommentMenus;
	private _commentThreadDisposables: IDisposable[] = [];
	private _threadIsEmpty: IContextKey<boolean>;
	private _styleElement: HTMLStyleElement;
	private _commentThreadContextValue: IContextKey<string | undefined>;
	private _onDidResize = new Emitter<dom.Dimension>();
	onDidResize = this._onDidResize.event;

	get commentThread() {
		return this._commentThread;
	}

	constructor(
		readonly container: HTMLElement,
		private _owner: string,
		private _parentResourceUri: URI,
		private _contextKeyService: IContextKeyService,
		private _scopedInstatiationService: IInstantiationService,
		private _commentThread: languages.CommentThread<T>,
		private _pendingComment: string | null,
		private _markdownOptions: IMarkdownRendererOptions,
		private _commentOptions: languages.CommentOptions | undefined,
		private _containerDelegate: {
			actionRunner: (() => void) | null;
			collapse: () => void;
		},
		@ICommentService private commentService: ICommentService
	) {
		super();

		this._threadIsEmpty = CommentContextKeys.commentThreadIsEmpty.bindTo(this._contextKeyService);
		this._threadIsEmpty.set(!_commentThread.comments || !_commentThread.comments.length);

		this._commentMenus = this.commentService.getCommentMenus(this._owner);

		this._header = new CommentThreadHeader<T>(
			container,
			{
				collapse: this.collapse.bind(this)
			},
			this._commentMenus,
			this._commentThread,
			this._contextKeyService,
			this._scopedInstatiationService
		);

		this._header.updateCommentThread(this._commentThread);

		const bodyElement = <HTMLDivElement>dom.$('.body');
		container.appendChild(bodyElement);

		this._body = this._scopedInstatiationService.createInstance(
			CommentThreadBody,
			this._owner,
			this._parentResourceUri,
			bodyElement,
			this._markdownOptions,
			this._commentThread,
			this._scopedInstatiationService,
			this
		) as unknown as CommentThreadBody<T>;

		this._styleElement = dom.createStyleSheet(this.container);


		this._commentThreadContextValue = this._contextKeyService.createKey<string | undefined>('commentThread', undefined);
		this._commentThreadContextValue.set(_commentThread.contextValue);

		const commentControllerKey = this._contextKeyService.createKey<string | undefined>('commentController', undefined);
		const controller = this.commentService.getCommentController(this._owner);

		if (controller) {
			commentControllerKey.set(controller.contextValue);
		}

		this.currentThreadListeners();
	}

	private updateCurrentThread(hasMouse: boolean, hasFocus: boolean) {
		if (hasMouse || hasFocus) {
			this.commentService.setCurrentCommentThread(this.commentThread);
		} else {
			this.commentService.setCurrentCommentThread(undefined);
		}
	}

	private currentThreadListeners() {
		let hasMouse = false;
		let hasFocus = false;
		this._register(dom.addDisposableListener(this.container, dom.EventType.MOUSE_ENTER, (e) => {
			if ((<any>e).toElement === this.container) {
				hasMouse = true;
				this.updateCurrentThread(hasMouse, hasFocus);
			}
		}, true));
		this._register(dom.addDisposableListener(this.container, dom.EventType.MOUSE_LEAVE, (e) => {
			if ((<any>e).fromElement === this.container) {
				hasMouse = false;
				this.updateCurrentThread(hasMouse, hasFocus);
			}
		}, true));
		this._register(dom.addDisposableListener(this.container, dom.EventType.FOCUS_IN, () => {
			hasFocus = true;
			this.updateCurrentThread(hasMouse, hasFocus);
		}, true));
		this._register(dom.addDisposableListener(this.container, dom.EventType.FOCUS_OUT, () => {
			hasFocus = false;
			this.updateCurrentThread(hasMouse, hasFocus);
		}, true));
	}

	updateCommentThread(commentThread: languages.CommentThread<T>) {
		if (this._commentThread !== commentThread) {
			dispose(this._commentThreadDisposables);
		}

		this._commentThread = commentThread;
		this._commentThreadDisposables = [];
		this._bindCommentThreadListeners();

		this._body.updateCommentThread(commentThread);
		this._threadIsEmpty.set(!this._body.length);
		this._header.updateCommentThread(commentThread);
		this._commentReply?.updateCommentThread(commentThread);

		if (this._commentThread.contextValue) {
			this._commentThreadContextValue.set(this._commentThread.contextValue);
		} else {
			this._commentThreadContextValue.reset();
		}
	}

	display(lineHeight: number) {
		const headHeight = Math.ceil(lineHeight * 1.2);
		this._header.updateHeight(headHeight);

		this._body.display();

		// create comment thread only when it supports reply
		if (this._commentThread.canReply) {
			this._createCommentForm();
		}

		this._register(this._body.onDidResize(dimension => {
			this._refresh(dimension);
		}));

		// If there are no existing comments, place focus on the text area. This must be done after show, which also moves focus.
		// if this._commentThread.comments is undefined, it doesn't finish initialization yet, so we don't focus the editor immediately.
		if (this._commentThread.canReply && this._commentReply) {
			this._commentReply.focusIfNeeded();
		}

		this._bindCommentThreadListeners();
	}

	private _refresh(dimension: dom.Dimension) {
		this._body.layout();
		this._onDidResize.fire(dimension);
	}

	override dispose() {
		super.dispose();
		this.updateCurrentThread(false, false);
	}

	private _bindCommentThreadListeners() {
		this._commentThreadDisposables.push(this._commentThread.onDidChangeCanReply(() => {
			if (this._commentReply) {
				this._commentReply.updateCanReply();
			} else {
				if (this._commentThread.canReply) {
					this._createCommentForm();
				}
			}
		}));

		this._commentThreadDisposables.push(this._commentThread.onDidChangeComments(async _ => {
			await this.updateCommentThread(this._commentThread);
		}));

		this._commentThreadDisposables.push(this._commentThread.onDidChangeLabel(_ => {
			this._header.createThreadLabel();
		}));
	}

	private _createCommentForm() {
		this._commentReply = this._scopedInstatiationService.createInstance(
			CommentReply,
			this._owner,
			this._body.container,
			this._commentThread,
			this._scopedInstatiationService,
			this._contextKeyService,
			this._commentMenus,
			this._commentOptions,
			this._pendingComment,
			this,
			this._containerDelegate.actionRunner
		);

		this._register(this._commentReply);
	}

	getCommentCoords(commentUniqueId: number) {
		return this._body.getCommentCoords(commentUniqueId);
	}

	getPendingComment(): string | null {
		if (this._commentReply) {
			return this._commentReply.getPendingComment();
		}

		return null;
	}

	getDimensions() {
		return this._body?.getDimensions();
	}

	layout(widthInPixel?: number) {
		this._body.layout();

		if (widthInPixel !== undefined) {
			this._commentReply?.layout(widthInPixel);
		}
	}

	focusCommentEditor() {
		this._commentReply?.focusCommentEditor();
	}

	focus() {
		this._body.focus();
	}

	async submitComment() {
		const activeComment = this._body.activeComment;
		if (activeComment) {
			activeComment.submitComment();
		} else if ((this._commentReply?.getPendingComment()?.length ?? 0) > 0) {
			this._commentReply?.submitComment();
		}
	}

	collapse() {
		this._containerDelegate.collapse();
	}

	applyTheme(theme: IColorTheme, fontInfo: FontInfo) {
		const content: string[] = [];

		content.push(`.monaco-editor .review-widget > .body { border-top: 1px solid var(${commentThreadStateColorVar}) }`);
		content.push(`.monaco-editor .review-widget > .head { background-color: var(${commentThreadStateBackgroundColorVar}) }`);

		const linkColor = theme.getColor(textLinkForeground);
		if (linkColor) {
			content.push(`.review-widget .body .comment-body a { color: ${linkColor} }`);
		}

		const linkActiveColor = theme.getColor(textLinkActiveForeground);
		if (linkActiveColor) {
			content.push(`.review-widget .body .comment-body a:hover, a:active { color: ${linkActiveColor} }`);
		}

		const focusColor = theme.getColor(focusBorder);
		if (focusColor) {
			content.push(`.review-widget .body .comment-body a:focus { outline: 1px solid ${focusColor}; }`);
			content.push(`.review-widget .body .monaco-editor.focused { outline: 1px solid ${focusColor}; }`);
		}

		const blockQuoteBackground = theme.getColor(textBlockQuoteBackground);
		if (blockQuoteBackground) {
			content.push(`.review-widget .body .review-comment blockquote { background: ${blockQuoteBackground}; }`);
		}

		const blockQuoteBOrder = theme.getColor(textBlockQuoteBorder);
		if (blockQuoteBOrder) {
			content.push(`.review-widget .body .review-comment blockquote { border-color: ${blockQuoteBOrder}; }`);
		}

		const border = theme.getColor(PANEL_BORDER);
		if (border) {
			content.push(`.review-widget .body .review-comment .review-comment-contents .comment-reactions .action-item a.action-label { border-color: ${border}; }`);
		}

		const hcBorder = theme.getColor(contrastBorder);
		if (hcBorder) {
			content.push(`.review-widget .body .comment-form .review-thread-reply-button { outline-color: ${hcBorder}; }`);
			content.push(`.review-widget .body .monaco-editor { outline: 1px solid ${hcBorder}; }`);
		}

		const errorBorder = theme.getColor(inputValidationErrorBorder);
		if (errorBorder) {
			content.push(`.review-widget .validation-error { border: 1px solid ${errorBorder}; }`);
		}

		const errorBackground = theme.getColor(inputValidationErrorBackground);
		if (errorBackground) {
			content.push(`.review-widget .validation-error { background: ${errorBackground}; }`);
		}

		const errorForeground = theme.getColor(inputValidationErrorForeground);
		if (errorForeground) {
			content.push(`.review-widget .body .comment-form .validation-error { color: ${errorForeground}; }`);
		}

		const fontFamilyVar = '--comment-thread-editor-font-family';
		const fontSizeVar = '--comment-thread-editor-font-size';
		const fontWeightVar = '--comment-thread-editor-font-weight';
		this.container?.style.setProperty(fontFamilyVar, fontInfo.fontFamily);
		this.container?.style.setProperty(fontSizeVar, `${fontInfo.fontSize}px`);
		this.container?.style.setProperty(fontWeightVar, fontInfo.fontWeight);

		content.push(`.review-widget .body code {
			font-family: var(${fontFamilyVar});
			font-weight: var(${fontWeightVar});
		}`);

		this._styleElement.textContent = content.join('\n');
		this._commentReply?.setCommentEditorDecorations();
	}
}
