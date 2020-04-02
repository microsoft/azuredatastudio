/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/messagePanel';
import QueryRunner, { IQueryMessage } from 'sql/workbench/services/query/common/queryRunner';

import { ISelectionData } from 'azdata';

import { ITreeRenderer, IDataSource, ITreeNode, ITreeContextMenuEvent } from 'vs/base/browser/ui/tree/tree';
import { generateUuid } from 'vs/base/common/uuid';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { WorkbenchDataTree } from 'vs/platform/list/browser/listService';
import { isArray, isString } from 'vs/base/common/types';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { $, Dimension, createStyleSheet } from 'vs/base/browser/dom';
import { resultsErrorColor } from 'sql/platform/theme/common/colors';
import { MessagePanelState } from 'sql/workbench/common/editor/query/messagePanelState';
import { CachedListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { FuzzyScore } from 'vs/base/common/filters';

export interface IResultMessageIntern {
	id?: string;
	batchId?: number;
	isError: boolean;
	time?: string | Date;
	message: string;
	selection?: ISelectionData;
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

export class MessagePanel extends Disposable {
	private model = new Model();
	private container = $('.message-tree');
	private styleElement = createStyleSheet(this.container);

	private queryRunnerDisposables = this._register(new DisposableStore());
	private _state: MessagePanelState | undefined;

	private tree: WorkbenchDataTree<Model, IResultMessageIntern, FuzzyScore>;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService private readonly themeService: IThemeService
	) {
		super();
		this.tree = <WorkbenchDataTree<Model, IResultMessageIntern, FuzzyScore>>instantiationService.createInstance(
			WorkbenchDataTree,
			'MessagePanel',
			this.container,
			new MessagePanelDelegate(),
			[
				new MessageRenderer(),
				new ErrorMessageRenderer(),
				new BatchMessageRenderer()
			],
			new MessageDataSource(),
			{
				mouseSupport: false,
				setRowLineHeight: false,
				supportDynamicHeights: true
			});
		this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));
		this.tree.setInput(this.model);
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this._register(attachListStyler(this.tree, this.themeService));
		this._register(this.themeService.onDidColorThemeChange(this.applyStyles, this));
		this.applyStyles(this.themeService.getColorTheme());
	}

	private onContextMenu(e: ITreeContextMenuEvent<IResultMessageIntern>): void {
		//
	}

	public render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	public layout(size: Dimension): void {
		this.tree.layout(size.height);
		this.tree.updateChildren();
	}

	public focus(): void {
		this.tree.domFocus();
	}

	public set queryRunner(runner: QueryRunner) {
		this.queryRunnerDisposables.clear();
		this.reset();
		this.queryRunnerDisposables.add(runner.onQueryStart(() => this.reset()));
		this.queryRunnerDisposables.add(runner.onMessage(e => this.onMessage(e)));
		this.onMessage(runner.messages);
	}

	private onMessage(message: IQueryMessage | IQueryMessage[]) {
		if (isArray(message)) {
			this.model.messages.push(...message);
		} else {
			this.model.messages.push(message);
		}
		this.tree.updateChildren();
	}

	private applyStyles(theme: IColorTheme): void {
		const errorColor = theme.getColor(resultsErrorColor);
		const content: string[] = [];
		if (errorColor) {
			content.push(`.message-tree .monaco-tree-rows .error-message { color: ${errorColor}; }`);
		}

		const newStyles = content.join('\n');
		if (newStyles !== this.styleElement.innerHTML) {
			this.styleElement.innerHTML = newStyles;
		}
	}

	private reset() {
		this.model.messages = [];
		this._state = undefined;
		this.model.totalExecuteMessage = undefined;
		this.tree.updateChildren();
	}

	public set state(val: MessagePanelState) {
		this._state = val;
	}

	public get state(): MessagePanelState {
		return this._state;
	}

	public clear() {
		this.reset();
	}

	public dispose() {
		if (this.container) {
			this.container.remove();
			this.container = undefined;
		}
		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = undefined;
		}
		super.dispose();
	}
}

class MessageDataSource implements IDataSource<Model, IMessagePanelMessage | IMessagePanelBatchMessage> {
	hasChildren(element: Model | IMessagePanelMessage | IMessagePanelBatchMessage): boolean {
		return element instanceof Model;
	}

	getChildren(element: Model): (IMessagePanelMessage | IMessagePanelBatchMessage)[] {
		let messages = element.messages;
		if (element.totalExecuteMessage) {
			messages = messages.concat(element.totalExecuteMessage);
		}
		return messages || [];
	}
}

class MessagePanelDelegate extends CachedListVirtualDelegate<IResultMessageIntern> {
	protected estimateHeight(element: IResultMessageIntern): number {
		const lineHeight = 22;
		let lines = element.message.split('\n').length;
		return lineHeight * lines;
	}

	getTemplateId(element: IResultMessageIntern): string {
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

	hasDynamicHeight(element: IResultMessageIntern): boolean {
		// Empty elements should not have dynamic height since they will be invisible
		return element.message.toString().length > 0;
	}

}

class ErrorMessageRenderer implements ITreeRenderer<IResultMessageIntern, void, IMessageTemplate> {
	public readonly templateId = TemplateIds.ERROR;

	renderTemplate(container: HTMLElement): IMessageTemplate {
		container.append($('.time-stamp'));
		const message = $('.error-message');
		container.append(message);
		return { message };
	}

	renderElement(node: ITreeNode<IResultMessageIntern, void>, index: number, templateData: IMessageTemplate): void {
		let data: IMessageTemplate = templateData;
		data.message.innerText = node.element.message;
	}

	disposeTemplate(templateData: IMessageTemplate | IBatchTemplate): void {
	}
}

class BatchMessageRenderer implements ITreeRenderer<IResultMessageIntern, void, IBatchTemplate> {
	public readonly templateId = TemplateIds.BATCH;

	renderTemplate(container: HTMLElement): IBatchTemplate {
		const timeStamp = $('.time-stamp');
		container.append(timeStamp);
		const message = $('.batch-start');
		message.style.whiteSpace = 'pre';
		container.append(message);
		return { message, timeStamp };
	}

	renderElement(node: ITreeNode<IResultMessageIntern, void>, index: number, templateData: IBatchTemplate): void {
		let data = templateData as IBatchTemplate;
		if (isString(node.element.time)) {
			node.element.time = new Date(node.element.time!);
		}
		data.timeStamp.innerText = (node.element.time as Date).toLocaleTimeString();
		data.message.innerText = node.element.message;
	}

	disposeTemplate(templateData: IMessageTemplate | IBatchTemplate): void {
	}
}

class MessageRenderer implements ITreeRenderer<IResultMessageIntern, void, IMessageTemplate> {
	public readonly templateId = TemplateIds.MESSAGE;

	renderTemplate(container: HTMLElement): IMessageTemplate {
		container.append($('.time-stamp'));
		const message = $('.message');
		message.style.whiteSpace = 'pre';
		container.append(message);
		return { message };
	}

	renderElement(node: ITreeNode<IResultMessageIntern, void>, index: number, templateData: IMessageTemplate): void {
		let data: IMessageTemplate = templateData;
		data.message.innerText = node.element.message;
	}

	disposeTemplate(templateData: IMessageTemplate | IBatchTemplate): void {
	}
}

export class Model {
	public messages: Array<IMessagePanelMessage | IMessagePanelBatchMessage> = [];
	public totalExecuteMessage: IMessagePanelMessage;

	public uuid = generateUuid();
}
