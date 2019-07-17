/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/panel';
import * as dom from 'vs/base/browser/dom';
import { IAction } from 'vs/base/common/actions';
import { Event } from 'vs/base/common/event';
import { CollapseAllAction, DefaultAccessibilityProvider, DefaultController, DefaultDragAndDrop } from 'vs/base/parts/tree/browser/treeDefaults';
import { isCodeEditor } from 'vs/editor/browser/editorBrowser';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TreeResourceNavigator, WorkbenchTree } from 'vs/platform/list/browser/listService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Panel } from 'vs/workbench/browser/panel';
import { CommentNode, CommentsModel, ResourceWithCommentThreads, ICommentThreadChangedEvent } from 'vs/workbench/contrib/comments/common/commentModel';
import { ReviewController } from 'vs/workbench/contrib/comments/browser/commentsEditorContribution';
import { CommentsDataFilter, CommentsDataSource, CommentsModelRenderer } from 'vs/workbench/contrib/comments/browser/commentsTreeViewer';
import { ICommentService, IWorkspaceCommentThreadsEvent } from 'vs/workbench/contrib/comments/browser/commentService';
import { IEditorService, ACTIVE_GROUP, SIDE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { textLinkForeground, textLinkActiveForeground, focusBorder, textPreformatForeground } from 'vs/platform/theme/common/colorRegistry';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ResourceLabels } from 'vs/workbench/browser/labels';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';

export const COMMENTS_PANEL_ID = 'workbench.panel.comments';
export const COMMENTS_PANEL_TITLE = 'Comments';

export class CommentsPanel extends Panel {
	private treeLabels: ResourceLabels;
	private tree: WorkbenchTree;
	private treeContainer: HTMLElement;
	private messageBoxContainer: HTMLElement;
	private messageBox: HTMLElement;
	private commentsModel: CommentsModel;
	private collapseAllAction: IAction;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ICommentService private readonly commentService: ICommentService,
		@IEditorService private readonly editorService: IEditorService,
		@IOpenerService private readonly openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService
	) {
		super(COMMENTS_PANEL_ID, telemetryService, themeService, storageService);
	}

	public create(parent: HTMLElement): void {
		super.create(parent);

		dom.addClass(parent, 'comments-panel');

		let container = dom.append(parent, dom.$('.comments-panel-container'));
		this.treeContainer = dom.append(container, dom.$('.tree-container'));
		this.commentsModel = new CommentsModel();

		this.createTree();
		this.createMessageBox(container);

		this._register(this.commentService.onDidSetAllCommentThreads(this.onAllCommentsChanged, this));
		this._register(this.commentService.onDidUpdateCommentThreads(this.onCommentsUpdated, this));

		const styleElement = dom.createStyleSheet(parent);
		this.applyStyles(styleElement);
		this._register(this.themeService.onThemeChange(_ => this.applyStyles(styleElement)));

		this._register(this.onDidChangeVisibility(visible => {
			if (visible) {
				this.refresh();
			}
		}));

		this.render();
	}

	private applyStyles(styleElement: HTMLStyleElement) {
		const content: string[] = [];

		const theme = this.themeService.getTheme();
		const linkColor = theme.getColor(textLinkForeground);
		if (linkColor) {
			content.push(`.comments-panel .comments-panel-container a { color: ${linkColor}; }`);
		}

		const linkActiveColor = theme.getColor(textLinkActiveForeground);
		if (linkActiveColor) {
			content.push(`.comments-panel .comments-panel-container a:hover, a:active { color: ${linkActiveColor}; }`);
		}

		const focusColor = theme.getColor(focusBorder);
		if (focusColor) {
			content.push(`.comments-panel .commenst-panel-container a:focus { outline-color: ${focusColor}; }`);
		}

		const codeTextForegroundColor = theme.getColor(textPreformatForeground);
		if (codeTextForegroundColor) {
			content.push(`.comments-panel .comments-panel-container .text code { color: ${codeTextForegroundColor}; }`);
		}

		styleElement.innerHTML = content.join('\n');
	}

	private async render(): Promise<void> {
		dom.toggleClass(this.treeContainer, 'hidden', !this.commentsModel.hasCommentThreads());
		await this.tree.setInput(this.commentsModel);
		this.renderMessage();
	}

	public getActions(): IAction[] {
		if (!this.collapseAllAction) {
			this.collapseAllAction = this.instantiationService.createInstance(CollapseAllAction, this.tree, this.commentsModel.hasCommentThreads());
			this._register(this.collapseAllAction);
		}

		return [this.collapseAllAction];
	}

	public layout(dimensions: dom.Dimension): void {
		this.tree.layout(dimensions.height, dimensions.width);
	}

	public getTitle(): string {
		return COMMENTS_PANEL_TITLE;
	}

	private createMessageBox(parent: HTMLElement): void {
		this.messageBoxContainer = dom.append(parent, dom.$('.message-box-container'));
		this.messageBox = dom.append(this.messageBoxContainer, dom.$('span'));
		this.messageBox.setAttribute('tabindex', '0');
	}

	private renderMessage(): void {
		this.messageBox.textContent = this.commentsModel.getMessage();
		dom.toggleClass(this.messageBoxContainer, 'hidden', this.commentsModel.hasCommentThreads());
	}

	private createTree(): void {
		this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, this));

		this.tree = this._register(this.instantiationService.createInstance(WorkbenchTree, this.treeContainer, {
			dataSource: new CommentsDataSource(),
			renderer: new CommentsModelRenderer(this.treeLabels, this.openerService),
			accessibilityProvider: new DefaultAccessibilityProvider,
			controller: new DefaultController(),
			dnd: new DefaultDragAndDrop(),
			filter: new CommentsDataFilter()
		}, {
				twistiePixels: 20,
				ariaLabel: COMMENTS_PANEL_TITLE
			}));

		const commentsNavigator = this._register(new TreeResourceNavigator(this.tree, { openOnFocus: true }));
		this._register(Event.debounce(commentsNavigator.openResource, (last, event) => event, 100, true)(options => {
			this.openFile(options.element, options.editorOptions.pinned, options.editorOptions.preserveFocus, options.sideBySide);
		}));
	}

	private openFile(element: any, pinned?: boolean, preserveFocus?: boolean, sideBySide?: boolean): boolean {
		if (!element) {
			return false;
		}

		if (!(element instanceof ResourceWithCommentThreads || element instanceof CommentNode)) {
			return false;
		}

		const range = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].range : element.range;

		const activeEditor = this.editorService.activeEditor;
		let currentActiveResource = activeEditor ? activeEditor.getResource() : undefined;
		if (currentActiveResource && currentActiveResource.toString() === element.resource.toString()) {
			const threadToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].threadId : element.threadId;
			const commentToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].comment.commentId : element.comment.commentId;
			const control = this.editorService.activeTextEditorWidget;
			if (threadToReveal && isCodeEditor(control)) {
				const controller = ReviewController.get(control);
				controller.revealCommentThread(threadToReveal, commentToReveal, false);
			}

			return true;
		}

		const threadToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].threadId : element.threadId;
		const commentToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].comment : element.comment;

		this.editorService.openEditor({
			resource: element.resource,
			options: {
				pinned: pinned,
				preserveFocus: preserveFocus,
				selection: range
			}
		}, sideBySide ? SIDE_GROUP : ACTIVE_GROUP).then(editor => {
			if (editor) {
				const control = editor.getControl();
				if (threadToReveal && isCodeEditor(control)) {
					const controller = ReviewController.get(control);
					controller.revealCommentThread(threadToReveal, commentToReveal.commentId, true);
				}
			}
		});

		return true;
	}

	private refresh(): void {
		if (this.isVisible()) {
			this.collapseAllAction.enabled = this.commentsModel.hasCommentThreads();

			dom.toggleClass(this.treeContainer, 'hidden', !this.commentsModel.hasCommentThreads());
			this.tree.refresh().then(() => {
				this.renderMessage();
			}, (e) => {
				console.log(e);
			});
		}
	}

	private onAllCommentsChanged(e: IWorkspaceCommentThreadsEvent): void {
		this.commentsModel.setCommentThreads(e.ownerId, e.commentThreads);
		this.refresh();
	}

	private onCommentsUpdated(e: ICommentThreadChangedEvent): void {
		const didUpdate = this.commentsModel.updateCommentThreads(e);
		if (didUpdate) {
			this.refresh();
		}
	}
}

CommandsRegistry.registerCommand({
	id: 'workbench.action.focusCommentsPanel',
	handler: (accessor) => {
		const panelService = accessor.get(IPanelService);
		const panels = panelService.getPanels();
		if (panels.some(panelIdentifier => panelIdentifier.id === COMMENTS_PANEL_ID)) {
			panelService.openPanel(COMMENTS_PANEL_ID, true);
		}
	}
});