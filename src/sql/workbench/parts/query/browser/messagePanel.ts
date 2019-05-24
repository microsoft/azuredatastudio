/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/messagePanel';
import { IMessagesActionContext, CopyMessagesAction, CopyAllMessagesAction } from './actions';
import QueryRunner, { IQueryMessage } from 'sql/platform/query/common/queryRunner';
import { IExpandableTree } from 'sql/workbench/parts/objectExplorer/browser/treeUpdateUtils';

import { ISelectionData } from 'azdata';

import { IDataSource, ITree, IRenderer, ContextMenuEvent } from 'vs/base/parts/tree/browser/tree';
import { generateUuid } from 'vs/base/common/uuid';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { OpenMode, ClickBehavior, ICancelableEvent, IControllerOptions } from 'vs/base/parts/tree/browser/treeDefaults';
import { WorkbenchTreeController } from 'vs/platform/list/browser/listService';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { isArray } from 'vs/base/common/types';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { $, Dimension } from 'vs/base/browser/dom';
import { QueryEditor } from 'sql/workbench/parts/query/browser/queryEditor';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';

export interface IResultMessageIntern extends IQueryMessage {
	id?: string;
}

export interface IMessagePanelMessage {
	message: string;
	isError: boolean;
}

export interface IMessagePanelBatchMessage extends IMessagePanelMessage {
	selection: ISelectionData;
	time: string;
}

interface IMessageTemplate {
	message: HTMLElement;
}

interface IBatchTemplate extends IMessageTemplate {
	timeStamp: HTMLElement;
}

const TemplateIds = {
	MESSAGE: 'message',
	BATCH: 'batch',
	MODEL: 'model',
	ERROR: 'error'
};

export class MessagePanelState {
	public scrollPosition: number;

	dispose() {

	}
}

export class MessagePanel extends Disposable {
	private messageLineCountMap = new Map<IQueryMessage, number>();
	private ds = new MessageDataSource();
	private renderer = new MessageRenderer(this.messageLineCountMap);
	private model = new Model();
	private controller: MessageController;
	private container = $('.message-tree');

	private queryRunnerDisposables: IDisposable[] = [];
	private _state: MessagePanelState;

	private tree: ITree;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService private readonly themeService: IThemeService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService
	) {
		super();
		this.controller = instantiationService.createInstance(MessageController, { openMode: OpenMode.SINGLE_CLICK, clickBehavior: ClickBehavior.ON_MOUSE_UP /* do not change, to preserve focus behaviour in input field */ });
		this.controller.toFocusOnClick = this.model;
		this.tree = this._register(new Tree(this.container, {
			dataSource: this.ds,
			renderer: this.renderer,
			controller: this.controller
		}, { keyboardSupport: false, horizontalScrollMode: ScrollbarVisibility.Auto }));
		this.tree.onDidScroll(e => {
			// convert to old VS Code tree interface with expandable methods
			let expandableTree: IExpandableTree = <IExpandableTree>this.tree;

			if (this.state) {
				this.state.scrollPosition = expandableTree.getScrollPosition();
			}
		});
		this.controller.onKeyDown = (tree, event) => {
			if (event.ctrlKey) {
				let context: IMessagesActionContext = {
					selection: document.getSelection(),
					tree: this.tree,
				};
				// Ctrl + C for copy
				if (event.code === 'KeyC') {
					let copyMessageAction = instantiationService.createInstance(CopyMessagesAction, this.clipboardService);
					copyMessageAction.run(context);
				}
			}
			event.preventDefault();
			event.stopPropagation();
			return true;
		};
		this.controller.onContextMenu = (tree, element, event) => {
			if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === 'input') {
				return false; // allow context menu on input fields
			}

			// Prevent native context menu from showing up
			if (event) {
				event.preventDefault();
				event.stopPropagation();
			}

			const selection = document.getSelection();

			this.contextMenuService.showContextMenu({
				getAnchor: () => {
					return { x: event.posx, y: event.posy };
				},
				getActions: () => {
					return [
						instantiationService.createInstance(CopyMessagesAction, this.clipboardService),
						instantiationService.createInstance(CopyAllMessagesAction, this.tree, this.clipboardService)
					];
				},
				getActionsContext: () => {
					return <IMessagesActionContext>{
						selection,
						tree
					};
				}
			});

			return true;
		};
	}

	public render(container: HTMLElement): void {
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this._register(attachListStyler(this.tree, this.themeService));
		container.appendChild(this.container);
		this.tree.setInput(this.model);
	}

	public layout(size: Dimension): void {
		// convert to old VS Code tree interface with expandable methods
		let expandableTree: IExpandableTree = <IExpandableTree>this.tree;

		const previousScrollPosition = expandableTree.getScrollPosition();
		this.tree.layout(size.height);
		if (this.state && this.state.scrollPosition) {
			expandableTree.setScrollPosition(this.state.scrollPosition);
		} else {
			if (previousScrollPosition === 1) {
				expandableTree.setScrollPosition(1);
			}
		}
	}

	public set queryRunner(runner: QueryRunner) {
		dispose(this.queryRunnerDisposables);
		this.queryRunnerDisposables = [];
		this.reset();
		this.queryRunnerDisposables.push(runner.onQueryStart(() => this.reset()));
		this.queryRunnerDisposables.push(runner.onMessage(e => this.onMessage(e)));
		this.onMessage(runner.messages);
	}

	private onMessage(message: IQueryMessage | IQueryMessage[]) {
		if (isArray(message)) {
			this.model.messages.push(...message);
		} else {
			this.model.messages.push(message);
		}
		// convert to old VS Code tree interface with expandable methods
		let expandableTree: IExpandableTree = <IExpandableTree>this.tree;
		if (this.state.scrollPosition) {
			this.tree.refresh(this.model).then(() => {
				// Restore the previous scroll position when switching between tabs
				expandableTree.setScrollPosition(this.state.scrollPosition);
			});
		} else {
			const previousScrollPosition = expandableTree.getScrollPosition();
			this.tree.refresh(this.model).then(() => {
				// Scroll to the end if the user was already at the end otherwise leave the current scroll position
				if (previousScrollPosition === 1) {
					expandableTree.setScrollPosition(1);
				}
			});
		}
	}

	private reset() {
		this.model.messages = [];
		this.model.totalExecuteMessage = undefined;
		this.tree.refresh(this.model);
	}

	public set state(val: MessagePanelState) {
		this._state = val;
		// convert to old VS Code tree interface with expandable methods
		let expandableTree: IExpandableTree = <IExpandableTree>this.tree;
		if (this.state.scrollPosition) {
			expandableTree.setScrollPosition(this.state.scrollPosition);
		}
	}

	public get state(): MessagePanelState {
		return this._state;
	}

	public clear() {
		this.reset();
	}

	public dispose() {
		dispose(this.queryRunnerDisposables);
		super.dispose();
	}
}

class MessageDataSource implements IDataSource {
	getId(tree: ITree, element: Model | IResultMessageIntern): string {
		if (element instanceof Model) {
			return element.uuid;
		} else {
			if (!element.id) {
				element.id = generateUuid();
			}
			return element.id;
		}
	}

	hasChildren(tree: ITree, element: any): boolean {
		return element instanceof Model;
	}

	getChildren(tree: ITree, element: any): Promise<(IMessagePanelMessage | IMessagePanelBatchMessage)[]> {
		if (element instanceof Model) {
			let messages = element.messages;
			if (element.totalExecuteMessage) {
				messages = messages.concat(element.totalExecuteMessage);
			}
			return Promise.resolve(messages);
		} else {
			return Promise.resolve(undefined);
		}
	}

	getParent(tree: ITree, element: any): Promise<void> {
		return Promise.resolve(null);
	}
}

class MessageRenderer implements IRenderer {
	constructor(private messageLineCountMap: Map<IQueryMessage, number>) {
	}

	getHeight(tree: ITree, element: IQueryMessage): number {
		const lineHeight = 22;
		if (this.messageLineCountMap.has(element)) {
			return lineHeight * this.messageLineCountMap.get(element);
		}
		return lineHeight;
	}

	getTemplateId(tree: ITree, element: IQueryMessage): string {
		if (element instanceof Model) {
			return TemplateIds.MODEL;
		} else if (element.selection) {
			return TemplateIds.BATCH;
		} else if (element.isError) {
			return TemplateIds.ERROR;
		} else {
			return TemplateIds.MESSAGE;
		}
	}

	renderTemplate(tree: ITree, templateId: string, container: HTMLElement): IMessageTemplate | IBatchTemplate {

		if (templateId === TemplateIds.MESSAGE) {
			container.append($('.time-stamp'));
			const message = $('.message');
			message.style.whiteSpace = 'pre';
			container.append(message);
			return { message };
		} else if (templateId === TemplateIds.BATCH) {
			const timeStamp = $('.time-stamp');
			container.append(timeStamp);
			const message = $('.batch-start');
			message.style.whiteSpace = 'pre';
			container.append(message);
			return { message, timeStamp };
		} else if (templateId === TemplateIds.ERROR) {
			container.append($('.time-stamp'));
			const message = $('.error-message');
			container.append(message);
			return { message };
		} else {
			return undefined;
		}
	}

	renderElement(tree: ITree, element: IQueryMessage, templateId: string, templateData: IMessageTemplate | IBatchTemplate): void {
		if (templateId === TemplateIds.MESSAGE || templateId === TemplateIds.ERROR) {
			let data: IMessageTemplate = templateData;
			data.message.innerText = element.message;
		} else if (templateId === TemplateIds.BATCH) {
			let data = templateData as IBatchTemplate;
			data.timeStamp.innerText = element.time;
			data.message.innerText = element.message;
		}
	}

	disposeTemplate(tree: ITree, templateId: string, templateData: any): void {
	}
}

export class MessageController extends WorkbenchTreeController {

	private lastSelectedString: string = null;
	public toFocusOnClick: { focus(): void };

	constructor(
		options: IControllerOptions,
		@IConfigurationService configurationService: IConfigurationService,
		@IEditorService private workbenchEditorService: IEditorService,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super(options, configurationService);
	}

	protected onLeftClick(tree: ITree, element: any, eventish: ICancelableEvent, origin: string = 'mouse'): boolean {
		const mouseEvent = <IMouseEvent>eventish;
		// input and output are one element in the tree => we only expand if the user clicked on the output.
		// if ((element.reference > 0 || (element instanceof RawObjectReplElement && element.hasChildren)) && mouseEvent.target.className.indexOf('input expression') === -1) {
		super.onLeftClick(tree, element, eventish, origin);
		tree.clearFocus();
		tree.deselect(element);
		// }

		const selection = window.getSelection();
		if (selection.type !== 'Range' || this.lastSelectedString === selection.toString()) {
			// only focus the input if the user is not currently selecting.
			this.toFocusOnClick.focus();
		}
		this.lastSelectedString = selection.toString();

		if (element.selection) {
			let selection: ISelectionData = element.selection;
			// this is a batch statement
			let editor = this.workbenchEditorService.activeControl as QueryEditor;
			const codeEditor = <ICodeEditor>editor.getControl();
			codeEditor.focus();
			codeEditor.setSelection({ endColumn: selection.endColumn + 1, endLineNumber: selection.endLine + 1, startColumn: selection.startColumn + 1, startLineNumber: selection.startLine + 1 });
		}

		return true;
	}

	public onContextMenu(tree: ITree, element: any, event: ContextMenuEvent): boolean {
		return true;
	}
}

export class Model {
	public messages: Array<IMessagePanelMessage | IMessagePanelBatchMessage> = [];
	public totalExecuteMessage: IMessagePanelMessage;

	public uuid = generateUuid();

	public focus() {

	}
}
