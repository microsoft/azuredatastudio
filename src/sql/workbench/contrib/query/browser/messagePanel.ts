/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/messagePanel';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { IQueryMessage } from 'sql/workbench/services/query/common/query';

import { ITreeRenderer, IDataSource, ITreeNode, ITreeContextMenuEvent } from 'vs/base/browser/ui/tree/tree';
import { generateUuid } from 'vs/base/common/uuid';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { WorkbenchDataTree } from 'vs/platform/list/browser/listService';
import { isArray, isString } from 'vs/base/common/types';
import { Disposable, DisposableStore, dispose } from 'vs/base/common/lifecycle';
import { $, Dimension, createStyleSheet, addStandardDisposableGenericMouseDownListner, toggleClass } from 'vs/base/browser/dom';
import { resultsErrorColor } from 'sql/platform/theme/common/colors';
import { CachedListVirtualDelegate, IIdentityProvider } from 'vs/base/browser/ui/list/list';
import { FuzzyScore } from 'vs/base/common/filters';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { localize } from 'vs/nls';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IAction, Action } from 'vs/base/common/actions';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { removeAnsiEscapeCodes } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IDataTreeViewState } from 'vs/base/browser/ui/tree/dataTree';
import { IRange } from 'vs/editor/common/core/range';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';

export interface IResultMessageIntern {
	id?: string;
	batchId?: number;
	isError: boolean;
	time?: string | Date;
	message: string;
	range?: IRange;
}

export interface IMessagePanelMessage {
	message: string;
	isError: boolean;
}

export interface IMessagePanelBatchMessage extends IMessagePanelMessage {
	range: IRange;
	time: string;
}

interface IMessageTemplate {
	message: HTMLElement;
}

interface IBatchTemplate extends IMessageTemplate {
	timeStamp: HTMLElement;
	disposable: DisposableStore;
}

const TemplateIds = {
	MESSAGE: 'message',
	BATCH: 'batch',
	MODEL: 'model',
	ERROR: 'error'
};

export class AccessibilityProvider implements IListAccessibilityProvider<IResultMessageIntern> {

	getWidgetAriaLabel(): string {
		return localize('messagePanel', "Message Panel");
	}

	getAriaLabel(element: IResultMessageIntern): string {
		return element.message;
	}
}

class IdentityProvider implements IIdentityProvider<IResultMessageIntern> {
	getId(element: IResultMessageIntern): { toString(): string; } {
		return () => element.id;
	}
}

export class MessagePanel extends Disposable {
	private model = new Model();
	private container = $('.message-tree');
	private styleElement = createStyleSheet(this.container);

	private queryRunnerDisposables = this._register(new DisposableStore());
	private _treeStates = new Map<string, IDataTreeViewState>();
	private currenturi: string;

	private tree: WorkbenchDataTree<Model, IResultMessageIntern, FuzzyScore>;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService private readonly themeService: IThemeService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService,
		@IConfigurationService private configurationService: IConfigurationService
	) {
		super();
		const wordWrap = this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').messages.wordwrap;
		toggleClass(this.container, 'word-wrap', wordWrap);
		this.tree = <WorkbenchDataTree<Model, IResultMessageIntern, FuzzyScore>>instantiationService.createInstance(
			WorkbenchDataTree,
			'MessagePanel',
			this.container,
			new MessagePanelDelegate(),
			[
				new MessageRenderer(),
				new ErrorMessageRenderer(),
				instantiationService.createInstance(BatchMessageRenderer)
			],
			new MessageDataSource(),
			{
				accessibilityProvider: new AccessibilityProvider(),
				mouseSupport: false,
				horizontalScrolling: !wordWrap,
				setRowLineHeight: false,
				supportDynamicHeights: wordWrap,
				identityProvider: new IdentityProvider()
			});
		this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));
		this.tree.setInput(this.model);
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this._register(attachListStyler(this.tree, this.themeService));
		this._register(this.themeService.onDidColorThemeChange(this.applyStyles, this));
		this.applyStyles(this.themeService.getColorTheme());
	}

	private onContextMenu(event: ITreeContextMenuEvent<IResultMessageIntern>): void {
		// Prevent native context menu from showing up
		const actions: IAction[] = [];
		actions.push(new Action('messagePanel.copy', localize('copy', "Copy"), undefined, true, async () => {
			const nativeSelection = window.getSelection();
			if (nativeSelection) {
				await this.clipboardService.writeText(nativeSelection.toString());
			}
			return Promise.resolve();
		}));
		actions.push(new Action('workbench.queryEditor.messages.action.copyAll', localize('copyAll', "Copy All"), undefined, true, async () => {
			await this.clipboardService.writeText(this.getVisibleContent());
			return Promise.resolve();
		}));

		this.contextMenuService.showContextMenu({
			getAnchor: () => event.anchor,
			getActions: () => actions
		});
	}

	getVisibleContent(): string {
		let text = '';
		const lineDelimiter = this.textResourcePropertiesService.getEOL(URI.parse(`queryEditor:messagePanel`));
		const traverseAndAppend = (node: ITreeNode<IResultMessageIntern, FuzzyScore>) => {
			node.children.forEach(child => {
				text += child.element.message.trimRight() + lineDelimiter;
				if (!child.collapsed && child.children.length) {
					traverseAndAppend(child);
				}
			});
		};
		traverseAndAppend(this.tree.getNode());

		return removeAnsiEscapeCodes(text);
	}

	public render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	public layout(size: Dimension): void {
		this.tree.layout(size.height, size.width);
		this.tree.updateChildren();
	}

	public focus(): void {
		this.tree.domFocus();
	}

	public set queryRunner(runner: QueryRunner) {
		if (this.currenturi) {
			this._treeStates.set(this.currenturi, this.tree.getViewState());
		}
		this.queryRunnerDisposables.clear();
		this.reset();
		this.currenturi = runner.uri;
		this.queryRunnerDisposables.add(runner.onQueryStart(() => this.reset()));
		this.queryRunnerDisposables.add(runner.onMessage(e => this.onMessage(e)));
		this.onMessage(runner.messages, true);
	}

	private onMessage(message: IQueryMessage | IQueryMessage[], setInput: boolean = false) {
		if (isArray(message)) {
			this.model.messages.push(...message);
		} else {
			this.model.messages.push(message);
		}
		if (setInput) {
			this.tree.setInput(this.model, this._treeStates.get(this.currenturi));
		} else {
			this.tree.updateChildren();
		}
	}

	private applyStyles(theme: IColorTheme): void {
		const errorColor = theme.getColor(resultsErrorColor);
		const content: string[] = [];
		if (errorColor) {
			content.push(`.message-tree .monaco-list-rows .error-message { color: ${errorColor}; }`);
		}

		const newStyles = content.join('\n');
		if (newStyles !== this.styleElement.innerHTML) {
			this.styleElement.innerHTML = newStyles;
		}
	}

	private reset() {
		this.model.messages = [];
		this.model.totalExecuteMessage = undefined;
		this.tree.updateChildren();
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
		} else if (element.range) {
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

	constructor(@IEditorService private readonly editorService: IEditorService) { }

	renderTemplate(container: HTMLElement): IBatchTemplate {
		const timeStamp = $('.time-stamp');
		container.append(timeStamp);
		const message = $('.batch-start');
		container.append(message);
		return { message, timeStamp, disposable: new DisposableStore() };
	}

	renderElement(node: ITreeNode<IResultMessageIntern, void>, index: number, templateData: IBatchTemplate): void {
		if (isString(node.element.time)) {
			node.element.time = new Date(node.element.time!);
		}
		templateData.timeStamp.innerText = (node.element.time as Date).toLocaleTimeString();
		templateData.message.innerText = node.element.message;
		if (node.element.range) {
			templateData.disposable.add(addStandardDisposableGenericMouseDownListner(templateData.message, () => {
				let editor = this.editorService.activeEditorPane as QueryEditor;
				const codeEditor = <ICodeEditor>editor.getControl();
				codeEditor.focus();
				codeEditor.setSelection(node.element.range);
				codeEditor.revealRangeInCenterIfOutsideViewport(node.element.range);
			}));
		}
	}

	disposeTemplate(templateData: IBatchTemplate): void {
		dispose(templateData.disposable);
	}
}

class MessageRenderer implements ITreeRenderer<IResultMessageIntern, void, IMessageTemplate> {
	public readonly templateId = TemplateIds.MESSAGE;

	renderTemplate(container: HTMLElement): IMessageTemplate {
		container.append($('.time-stamp'));
		const message = $('.message');
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
