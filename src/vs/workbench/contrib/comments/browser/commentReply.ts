/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from 'vs/base/browser/ui/mouseCursor/mouseCursor';
import { IAction } from 'vs/base/common/actions';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { MarshalledId } from 'vs/base/common/marshallingIds';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IRange } from 'vs/editor/common/core/range';
import * as languages from 'vs/editor/common/languages';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { ITextModel } from 'vs/editor/common/model';
import { IModelService } from 'vs/editor/common/services/model';
import * as nls from 'vs/nls';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { editorForeground, resolveColorValue } from 'vs/platform/theme/common/colorRegistry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { CommentFormActions } from 'vs/workbench/contrib/comments/browser/commentFormActions';
import { CommentMenus } from 'vs/workbench/contrib/comments/browser/commentMenus';
import { ICommentService } from 'vs/workbench/contrib/comments/browser/commentService';
import { CommentContextKeys } from 'vs/workbench/contrib/comments/common/commentContextKeys';
import { ICommentThreadWidget } from 'vs/workbench/contrib/comments/common/commentThreadWidget';
import { ICellRange } from 'vs/workbench/contrib/notebook/common/notebookRange';
import { SimpleCommentEditor } from './simpleCommentEditor';

const COMMENT_SCHEME = 'comment';
let INMEM_MODEL_ID = 0;
export const COMMENTEDITOR_DECORATION_KEY = 'commenteditordecoration';

export class CommentReply<T extends IRange | ICellRange> extends Disposable {
	commentEditor: ICodeEditor;
	form: HTMLElement;
	commentEditorIsEmpty: IContextKey<boolean>;
	private _error!: HTMLElement;
	private _formActions: HTMLElement | null;
	private _commentThreadDisposables: IDisposable[] = [];
	private _commentFormActions!: CommentFormActions;
	private _reviewThreadReplyButton!: HTMLElement;

	constructor(
		readonly owner: string,
		container: HTMLElement,
		private _commentThread: languages.CommentThread<T>,
		private _scopedInstatiationService: IInstantiationService,
		private _contextKeyService: IContextKeyService,
		private _commentMenus: CommentMenus,
		private _commentOptions: languages.CommentOptions | undefined,
		private _pendingComment: string | null,
		private _parentThread: ICommentThreadWidget,
		private _actionRunDelegate: (() => void) | null,
		@ICommentService private commentService: ICommentService,
		@ILanguageService private languageService: ILanguageService,
		@IModelService private modelService: IModelService,
		@IThemeService private themeService: IThemeService,
	) {
		super();

		this.form = dom.append(container, dom.$('.comment-form'));
		this.commentEditor = this._register(this._scopedInstatiationService.createInstance(SimpleCommentEditor, this.form, SimpleCommentEditor.getEditorOptions(), this._parentThread));
		this.commentEditorIsEmpty = CommentContextKeys.commentIsEmpty.bindTo(this._contextKeyService);
		this.commentEditorIsEmpty.set(!this._pendingComment);

		const hasExistingComments = this._commentThread.comments && this._commentThread.comments.length > 0;
		const modeId = generateUuid() + '-' + (hasExistingComments ? this._commentThread.threadId : ++INMEM_MODEL_ID);
		const params = JSON.stringify({
			extensionId: this._commentThread.extensionId,
			commentThreadId: this._commentThread.threadId
		});

		let resource = URI.parse(`${COMMENT_SCHEME}://${this._commentThread.extensionId}/commentinput-${modeId}.md?${params}`); // TODO. Remove params once extensions adopt authority.
		let commentController = this.commentService.getCommentController(owner);
		if (commentController) {
			resource = resource.with({ authority: commentController.id });
		}

		const model = this.modelService.createModel(this._pendingComment || '', this.languageService.createByFilepathOrFirstLine(resource), resource, false);
		this._register(model);
		this.commentEditor.setModel(model);

		this._register((this.commentEditor.getModel()!.onDidChangeContent(() => {
			this.setCommentEditorDecorations();
			this.commentEditorIsEmpty?.set(!this.commentEditor.getValue());
		})));

		this.createTextModelListener(this.commentEditor, this.form);

		this.setCommentEditorDecorations();

		// Only add the additional step of clicking a reply button to expand the textarea when there are existing comments
		if (hasExistingComments) {
			this.createReplyButton(this.commentEditor, this.form);
		} else {
			if (this._commentThread.comments && this._commentThread.comments.length === 0) {
				this.expandReplyArea();
			}
		}
		this._error = dom.append(this.form, dom.$('.validation-error.hidden'));

		this._formActions = dom.append(this.form, dom.$('.form-actions'));
		this.createCommentWidgetActions(this._formActions, model);
	}

	public updateCommentThread(commentThread: languages.CommentThread<IRange | ICellRange>) {
		const isReplying = this.commentEditor.hasTextFocus();

		if (!this._reviewThreadReplyButton) {
			this.createReplyButton(this.commentEditor, this.form);
		}

		if (this._commentThread.comments && this._commentThread.comments.length === 0) {
			this.expandReplyArea();
		}

		if (isReplying) {
			this.commentEditor.focus();
		}
	}

	public getPendingComment(): string | null {
		let model = this.commentEditor.getModel();

		if (model && model.getValueLength() > 0) { // checking length is cheap
			return model.getValue();
		}

		return null;
	}

	public layout(widthInPixel: number) {
		this.commentEditor.layout({ height: 5 * 18, width: widthInPixel - 54 /* margin 20px * 10 + scrollbar 14px*/ });
	}

	public focusIfNeeded() {
		if (!this._commentThread.comments || !this._commentThread.comments.length) {
			this.commentEditor.focus();
		} else if (this.commentEditor.getModel()!.getValueLength() > 0) {
			this.expandReplyArea();
		}
	}

	public focusCommentEditor() {
		this.commentEditor.focus();
	}

	public getCommentModel() {
		return this.commentEditor.getModel()!;
	}

	public updateCanReply() {
		if (!this._commentThread.canReply) {
			this.form.style.display = 'none';
		} else {
			this.form.style.display = 'block';
		}
	}

	async submitComment(): Promise<void> {
		if (this._commentFormActions) {
			this._commentFormActions.triggerDefaultAction();
		}
	}

	setCommentEditorDecorations() {
		const model = this.commentEditor.getModel();
		if (model) {
			const valueLength = model.getValueLength();
			const hasExistingComments = this._commentThread.comments && this._commentThread.comments.length > 0;
			const placeholder = valueLength > 0
				? ''
				: hasExistingComments
					? (this._commentOptions?.placeHolder || nls.localize('reply', "Reply..."))
					: (this._commentOptions?.placeHolder || nls.localize('newComment', "Type a new comment"));
			const decorations = [{
				range: {
					startLineNumber: 0,
					endLineNumber: 0,
					startColumn: 0,
					endColumn: 1
				},
				renderOptions: {
					after: {
						contentText: placeholder,
						color: `${resolveColorValue(editorForeground, this.themeService.getColorTheme())?.transparent(0.4)}`
					}
				}
			}];

			this.commentEditor.setDecorations('review-zone-widget', COMMENTEDITOR_DECORATION_KEY, decorations);
		}
	}

	private createTextModelListener(commentEditor: ICodeEditor, commentForm: HTMLElement) {
		this._commentThreadDisposables.push(commentEditor.onDidFocusEditorWidget(() => {
			this._commentThread.input = {
				uri: commentEditor.getModel()!.uri,
				value: commentEditor.getValue()
			};
			this.commentService.setActiveCommentThread(this._commentThread);
		}));

		this._commentThreadDisposables.push(commentEditor.getModel()!.onDidChangeContent(() => {
			let modelContent = commentEditor.getValue();
			if (this._commentThread.input && this._commentThread.input.uri === commentEditor.getModel()!.uri && this._commentThread.input.value !== modelContent) {
				let newInput: languages.CommentInput = this._commentThread.input;
				newInput.value = modelContent;
				this._commentThread.input = newInput;
			}
			this.commentService.setActiveCommentThread(this._commentThread);
		}));

		this._commentThreadDisposables.push(this._commentThread.onDidChangeInput(input => {
			let thread = this._commentThread;

			if (thread.input && thread.input.uri !== commentEditor.getModel()!.uri) {
				return;
			}
			if (!input) {
				return;
			}

			if (commentEditor.getValue() !== input.value) {
				commentEditor.setValue(input.value);

				if (input.value === '') {
					this._pendingComment = '';
					commentForm.classList.remove('expand');
					commentEditor.getDomNode()!.style.outline = '';
					this._error.textContent = '';
					this._error.classList.add('hidden');
				}
			}
		}));
	}

	/**
	 * Command based actions.
	 */
	private createCommentWidgetActions(container: HTMLElement, model: ITextModel) {
		const menu = this._commentMenus.getCommentThreadActions(this._contextKeyService);

		this._register(menu);
		this._register(menu.onDidChange(() => {
			this._commentFormActions.setActions(menu);
		}));

		this._commentFormActions = new CommentFormActions(container, async (action: IAction) => {
			if (this._actionRunDelegate) {
				this._actionRunDelegate();
			}

			action.run({
				thread: this._commentThread,
				text: this.commentEditor.getValue(),
				$mid: MarshalledId.CommentThreadReply
			});

			this.hideReplyArea();
		}, this.themeService);

		this._commentFormActions.setActions(menu);
	}

	private expandReplyArea() {
		if (!this.form.classList.contains('expand')) {
			this.form.classList.add('expand');
			this.commentEditor.focus();
			this.commentEditor.layout();
		}
	}

	private hideReplyArea() {
		this.commentEditor.getDomNode()!.style.outline = '';
		this._pendingComment = '';
		this.form.classList.remove('expand');
		this._error.textContent = '';
		this._error.classList.add('hidden');
	}

	private createReplyButton(commentEditor: ICodeEditor, commentForm: HTMLElement) {
		this._reviewThreadReplyButton = <HTMLButtonElement>dom.append(commentForm, dom.$(`button.review-thread-reply-button.${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`));
		this._reviewThreadReplyButton.title = this._commentOptions?.prompt || nls.localize('reply', "Reply...");

		this._reviewThreadReplyButton.textContent = this._commentOptions?.prompt || nls.localize('reply', "Reply...");
		// bind click/escape actions for reviewThreadReplyButton and textArea
		this._register(dom.addDisposableListener(this._reviewThreadReplyButton, 'click', _ => this.expandReplyArea()));
		this._register(dom.addDisposableListener(this._reviewThreadReplyButton, 'focus', _ => this.expandReplyArea()));

		commentEditor.onDidBlurEditorWidget(() => {
			if (commentEditor.getModel()!.getValueLength() === 0 && commentForm.classList.contains('expand')) {
				commentForm.classList.remove('expand');
			}
		});
	}

}
