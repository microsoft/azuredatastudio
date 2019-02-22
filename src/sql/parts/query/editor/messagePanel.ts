/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import 'vs/css!./media/messagePanel';
import { IMessagesActionContext, CopyMessagesAction, CopyAllMessagesAction } from './actions';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { $ } from 'sql/base/browser/builder';

import { IResultMessage, ISelectionData } from 'sqlops';

import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IDataSource, ITree, IRenderer, ContextMenuEvent } from 'vs/base/parts/tree/browser/tree';
import { TPromise } from 'vs/base/common/winjs.base';
import { generateUuid } from 'vs/base/common/uuid';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { OpenMode, ClickBehavior, ICancelableEvent, IControllerOptions } from 'vs/base/parts/tree/browser/treeDefaults';
import { WorkbenchTreeController } from 'vs/platform/list/browser/listService';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { isArray, isUndefinedOrNull } from 'vs/base/common/types';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

export interface IResultMessageIntern extends IResultMessage {
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
	public collapsed = false;

	constructor(@IConfigurationService configurationService: IConfigurationService) {
		let messagesOpenedSettings = configurationService.getValue<boolean>('sql.messagesDefaultOpen');
		if (!isUndefinedOrNull(messagesOpenedSettings)) {
			this.collapsed = !messagesOpenedSettings;
		}
	}

	dispose() {

	}
}

export class MessagePanel extends ViewletPanel {
	private messageLineCountMap = new Map<IResultMessage, number>();
	private ds = new MessageDataSource();
	private renderer = new MessageRenderer(this.messageLineCountMap);
	private model = new Model();
	private controller: MessageController;
	private container = $('div message-tree').getHTMLElement();

	private queryRunnerDisposables: IDisposable[] = [];
	private _state: MessagePanelState;

	private tree: ITree;
	private _selectAllMessages: boolean;

	constructor(
		options: IViewletPanelOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IThemeService private themeService: IThemeService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IClipboardService private clipboardService: IClipboardService
	) {
		super(options, keybindingService, contextMenuService, configurationService);
		this.controller = instantiationService.createInstance(MessageController, { openMode: OpenMode.SINGLE_CLICK, clickBehavior: ClickBehavior.ON_MOUSE_UP /* do not change, to preserve focus behaviour in input field */ });
		this.controller.toFocusOnClick = this.model;
		this.tree = new Tree(this.container, {
			dataSource: this.ds,
			renderer: this.renderer,
			controller: this.controller
		}, { keyboardSupport: false, horizontalScrollMode: ScrollbarVisibility.Auto });
		this.disposables.push(this.tree);
		this.tree.onDidScroll(e => {
			if (this.state) {
				this.state.scrollPosition = this.tree.getScrollPosition();
			}
		});
		this.onDidChange(e => {
			if (this.state) {
				this.state.collapsed = !this.isExpanded();
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
					let copyMessageAction = instantiationService.createInstance(CopyMessagesAction, this, this.clipboardService);
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
						instantiationService.createInstance(CopyMessagesAction, this, this.clipboardService),
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

	protected renderBody(container: HTMLElement): void {
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this.disposables.push(attachListStyler(this.tree, this.themeService));
		container.appendChild(this.container);
		this.tree.setInput(this.model);
	}

	protected layoutBody(size: number): void {
		const previousScrollPosition = this.tree.getScrollPosition();
		this.tree.layout(size);
		if (this.state && this.state.scrollPosition) {
			this.tree.setScrollPosition(this.state.scrollPosition);
		} else {
			if (previousScrollPosition === 1) {
				this.tree.setScrollPosition(1);
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

	private onMessage(message: IResultMessage | IResultMessage[]) {
		let hasError = false;
		let lines: number;
		if (isArray(message)) {
			hasError = message.find(e => e.isError) ? true : false;
			lines = message.reduce((currentTotal, resultMessage) => currentTotal + this.countMessageLines(resultMessage), 0);
			this.model.messages.push(...message);
		} else {
			hasError = message.isError;
			lines = this.countMessageLines(message);
			this.model.messages.push(message);
		}
		this.maximumBodySize += lines * 22;
		if (hasError) {
			this.setExpanded(true);
		}
		if (this.state.scrollPosition) {
			this.tree.refresh(this.model).then(() => {
				// Restore the previous scroll position when switching between tabs
				this.tree.setScrollPosition(this.state.scrollPosition);
			});
		} else {
			const previousScrollPosition = this.tree.getScrollPosition();
			this.tree.refresh(this.model).then(() => {
				// Scroll to the end if the user was already at the end otherwise leave the current scroll position
				if (previousScrollPosition === 1) {
					this.tree.setScrollPosition(1);
				}
			});
		}
	}

	private countMessageLines(resultMessage: IResultMessage): number {
		let lines = resultMessage.message.split('\n').length;
		this.messageLineCountMap.set(resultMessage, lines);
		return lines;
	}

	private reset() {
		this.model.messages = [];
		this.model.totalExecuteMessage = undefined;
		this.tree.refresh(this.model);
	}

	public set state(val: MessagePanelState) {
		this._state = val;
		if (this.state.scrollPosition) {
			this.tree.setScrollPosition(this.state.scrollPosition);
		}
		this.setExpanded(!this.state.collapsed);
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

	getChildren(tree: ITree, element: any): TPromise {
		if (element instanceof Model) {
			let messages = element.messages;
			if (element.totalExecuteMessage) {
				messages = messages.concat(element.totalExecuteMessage);
			}
			return TPromise.as(messages);
		} else {
			return TPromise.as(undefined);
		}
	}

	getParent(tree: ITree, element: any): TPromise {
		return TPromise.as(null);
	}
}

class MessageRenderer implements IRenderer {
	constructor(private messageLineCountMap: Map<IResultMessage, number>) {
	}

	getHeight(tree: ITree, element: any): number {
		const lineHeight = 22;
		if (this.messageLineCountMap.has(element)) {
			return lineHeight * this.messageLineCountMap.get(element);
		}
		return lineHeight;
	}

	getTemplateId(tree: ITree, element: any): string {
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
			$('div.time-stamp').appendTo(container);
			const message = $('div.message').style('white-space', 'pre').appendTo(container).getHTMLElement();
			return { message };
		} else if (templateId === TemplateIds.BATCH) {
			const timeStamp = $('div.time-stamp').appendTo(container).getHTMLElement();
			const message = $('div.batch-start').style('white-space', 'pre').appendTo(container).getHTMLElement();
			return { message, timeStamp };
		} else if (templateId === TemplateIds.ERROR) {
			$('div.time-stamp').appendTo(container);
			const message = $('div.error-message').appendTo(container).getHTMLElement();
			return { message };
		} else {
			return undefined;
		}
	}

	renderElement(tree: ITree, element: IResultMessage, templateId: string, templateData: IMessageTemplate | IBatchTemplate): void {
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
			let input = this.workbenchEditorService.activeEditor as QueryInput;
			input.updateSelection(selection);
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
