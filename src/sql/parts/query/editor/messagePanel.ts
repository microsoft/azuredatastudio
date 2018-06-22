/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import 'vs/css!./media/messagePanel';
import { IMessagesActionContext, SelectAllMessagesAction, CopyMessagesAction } from './actions';
import QueryRunner from 'sql/parts/query/execution/queryRunner';

import { IResultMessage, BatchSummary, ISelectionData } from 'sqlops';

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
import { $ } from 'vs/base/browser/builder';
import { isArray } from 'vs/base/common/types';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { localize } from 'vs/nls';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditor } from 'vs/editor/common/editorCommon';

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
	MODEL: 'model'
};

export class MessagePanel extends ViewletPanel {
	private ds = new MessageDataSource();
	private renderer = new MessageRenderer();
	private model = new Model();
	private controller: MessageController;
	private container = $('div message-tree').getHTMLElement();

	private queryRunnerDisposables: IDisposable[] = [];

	private tree: ITree;

	constructor(
		title: string, options: IViewletPanelOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IThemeService private themeService: IThemeService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(title, options, keybindingService, contextMenuService, configurationService);
		this.controller = instantiationService.createInstance(MessageController, { openMode: OpenMode.SINGLE_CLICK, clickBehavior: ClickBehavior.ON_MOUSE_UP /* do not change, to preserve focus behaviour in input field */ });
		this.controller.toFocusOnClick = this.model;
		this.tree = new Tree(this.container, {
			dataSource: this.ds,
			renderer: this.renderer,
			controller: this.controller
		}, { keyboardSupport: false });
	}

	protected renderBody(container: HTMLElement): void {
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		attachListStyler(this.tree, this.themeService);
		container.appendChild(this.container);
		this.tree.setInput(this.model);
	}

	protected layoutBody(size: number): void {
		this.tree.layout(size);
	}

	public set queryRunner(runner: QueryRunner) {
		dispose(this.queryRunnerDisposables);
		this.queryRunnerDisposables = [];
		this.reset();
		this.queryRunnerDisposables.push(runner.onQueryStart(() => this.reset()));
		this.queryRunnerDisposables.push(runner.onBatchStart(e => this.onBatchStart(e)));
		this.queryRunnerDisposables.push(runner.onMessage(e => this.onMessage(e)));
		this.queryRunnerDisposables.push(runner.onQueryEnd(e => this.onQueryEnd(e)));
	}

	private onMessage(message: IResultMessage | IResultMessage[]) {
		if (isArray(message)) {
			this.model.messages.push(...message.map(c => {
				return <IMessagePanelMessage>{
					isError: c.isError,
					message: c.message
				};
			}));
		} else {
			this.model.messages.push({
				message: message.message,
				isError: message.isError
			});
		}
		this.tree.refresh(this.model).then(() => {
			if (this.tree.getScrollPosition() === 1) {
				this.tree.setScrollPosition(1);
			}
		});
	}

	private onBatchStart(batch: BatchSummary) {
		this.model.messages.push({
			message: localize('query.message.startQuery', 'Started executing query at Line {0}', batch.selection.startLine),
			time: new Date(batch.executionStart).toLocaleTimeString(),
			selection: batch.selection,
			isError: false
		});
		this.tree.refresh(this.model).then(() => {
			if (this.tree.getScrollPosition() === 1) {
				this.tree.setScrollPosition(1);
			}
		});
	}

	private onQueryEnd(elapsedTime: string) {
		this.model.totalExecuteMessage = {
			message: localize('query.message.executionTime', 'Total execution time: {0}', elapsedTime),
			isError: false
		};
		this.tree.refresh(this.model).then(() => {
			if (this.tree.getScrollPosition() === 1) {
				this.tree.setScrollPosition(1);
			}
		});
	}

	private reset() {
		this.model.messages = [];
		this.tree.refresh(this.model);
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
				messages.concat(element.totalExecuteMessage);
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
	getHeight(tree: ITree, element: any): number {
		return 22;
	}

	getTemplateId(tree: ITree, element: any): string {
		if (element instanceof Model) {
			return TemplateIds.MODEL;
		} else if (element.selection) {
			return TemplateIds.BATCH;
		} else {
			return TemplateIds.MESSAGE;
		}
	}

	renderTemplate(tree: ITree, templateId: string, container: HTMLElement): IMessageTemplate | IBatchTemplate {

		if (templateId === TemplateIds.MESSAGE) {
			$('div.time-stamp').appendTo(container);
			const message = $('div.message').appendTo(container).getHTMLElement();
			return { message };
		} else if (templateId === TemplateIds.BATCH) {
			const timeStamp = $('div.time-stamp').appendTo(container).getHTMLElement();
			const message = $('div.batch-start').appendTo(container).getHTMLElement();
			return { message, timeStamp };
		} else {
			return undefined;
		}
	}

	renderElement(tree: ITree, element: IResultMessage, templateId: string, templateData: IMessageTemplate | IBatchTemplate): void {
		if (templateId === TemplateIds.MESSAGE) {
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
		@IWorkbenchEditorService private workbenchEditorService: IWorkbenchEditorService,
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
			let control = this.workbenchEditorService.getActiveEditor().getControl() as IEditor;
			control.setSelection({
				startColumn: selection.startColumn + 1,
				endColumn: selection.endColumn + 1,
				endLineNumber: selection.endLine + 1,
				startLineNumber: selection.startLine + 1
			});
			control.focus();
		}

		return true;
	}

	public onContextMenu(tree: ITree, element: any, event: ContextMenuEvent): boolean {
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
				return TPromise.as([
					this.instantiationService.createInstance(CopyMessagesAction),
					new SelectAllMessagesAction()
				]);
			},
			getActionsContext: () => {
				return <IMessagesActionContext>{
					selection,
					tree
				};
			}
		});

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
