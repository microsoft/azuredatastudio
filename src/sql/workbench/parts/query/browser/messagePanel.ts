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
import { IThemeService, ITheme } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { OpenMode, ClickBehavior, ICancelableEvent, IControllerOptions } from 'vs/base/parts/tree/browser/treeDefaults';
import { WorkbenchTreeController } from 'vs/platform/list/browser/listService';
import { isArray } from 'vs/base/common/types';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { $, Dimension, createStyleSheet } from 'vs/base/browser/dom';
import { QueryEditor } from 'sql/workbench/parts/query/browser/queryEditor';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { resultsErrorColor } from 'sql/platform/theme/common/colors';
import { MessagePanelState } from 'sql/workbench/parts/query/common/messagePanelState';
import { ObjectTree } from 'vs/base/browser/ui/tree/objectTree';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IListVirtualDelegate, IListRenderer } from 'vs/base/browser/ui/list/list';
import { Event } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { Schemas } from 'vs/base/common/network';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/resourceConfiguration';
import { URI } from 'vs/base/common/uri';

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
	ERROR: 'error'
};

export class MessagePanelState extends Disposable {
	public scrollTop: number;
}

class Delegate implements IListVirtualDelegate<IQueryMessage> {
	private static readonly lineHeight = 22;

	getHeight(element: IQueryMessage): number {
		let lines = element.message.split('\n').length;
		return Delegate.lineHeight * lines;
	}

	getTemplateId(element: IQueryMessage): string {
		if (element.selection) {
			return TemplateIds.BATCH;
		} else if (element.isError) {
			return TemplateIds.ERROR;
		} else {
			return TemplateIds.MESSAGE;
		}
	}

	hasDynamicHeight(): boolean {
		return true;
	}
}

class MessageRenderer implements IListRenderer<IQueryMessage, IMessageTemplate> {
	public readonly templateId = TemplateIds.MESSAGE;

	renderTemplate(container: HTMLElement): IMessageTemplate {
		container.append($('.time-stamp'));
		const message = $('.message');
		container.append(message);
		return { message };
	}

	renderElement(element: IQueryMessage, index: number, templateData: IMessageTemplate, height: number): void {
		templateData.message.innerText = element.message;
	}

	disposeTemplate(templateData: IMessageTemplate): void {
		// no op
	}
}

class BatchMessageRenderer implements IListRenderer<IQueryMessage, IBatchTemplate> {
	public readonly templateId = TemplateIds.BATCH;

	renderTemplate(container: HTMLElement): IBatchTemplate {
		const timeStamp = $('.time-stamp');
		container.append(timeStamp);
		const message = $('.batch-start');
		container.append(message);
		return { message, timeStamp };
	}

	renderElement(element: IQueryMessage, index: number, templateData: IBatchTemplate, height: number): void {
		templateData.timeStamp.innerText = element.time;
		templateData.message.innerText = element.message;
	}

	disposeTemplate(templateData: IBatchTemplate): void {
		// no op
	}
}

class ErrorMessageRenderer implements IListRenderer<IQueryMessage, IMessageTemplate> {
	public readonly templateId = TemplateIds.ERROR;

	renderTemplate(container: HTMLElement): IMessageTemplate {
		container.append($('.time-stamp'));
		const message = $('.error-message');
		container.append(message);
		return { message };
	}

	renderElement(element: IQueryMessage, index: number, templateData: IMessageTemplate, height: number): void {
		templateData.message.innerText = element.message;
	}

	disposeTemplate(templateData: IMessageTemplate): void {
		// no op
	}
}

export class MessagePanel extends Disposable {
	private container = $('.message-list');
	private styleElement = createStyleSheet(this.container);

	private messages = new Array<IQueryMessage>();
	private lastSelectedString: string = null;

	private queryRunnerDisposables: IDisposable[] = [];
	private _state: MessagePanelState | undefined;

	private list: List<IQueryMessage>;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService private readonly themeService: IThemeService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IEditorService private readonly editorService: IEditorService
	) {
		super();
		const renderers = [new ErrorMessageRenderer(), new MessageRenderer(), new BatchMessageRenderer()];
		this.list = this._register(new List(this.container, new Delegate(), renderers, {
			mouseSupport: false,
			supportDynamicHeights: true,
			horizontalScrolling: false,
			setRowLineHeight: false
		}));
		this._register(attachListStyler(this.list, this.themeService));
		this._register(this.themeService.onThemeChange(this.applyStyles, this));
		this.applyStyles(this.themeService.getTheme());
		this.list.onMouseClick(e => {
			const element = e.element;
			this.list.setFocus([]);
			this.list.setSelection([]);
			const selection = window.getSelection();
			if (element && (selection.type !== 'Range' || this.lastSelectedString === selection.toString())) {
				// only focus the input if the user is not currently selecting.
				if (element.selection) {
					const selection: ISelectionData = element.selection;
					// this is a batch statement
					const editor = this.editorService.activeTextEditorWidget as ICodeEditor;
					editor.focus();
					editor.setSelection({ endColumn: selection.endColumn + 1, endLineNumber: selection.endLine + 1, startColumn: selection.startColumn + 1, startLineNumber: selection.startLine + 1 });
				}
			}
		});
		Event.map(this.list.onKeyDown, e => new StandardKeyboardEvent(e))(e => {
			if (e.equals(KeyMod.CtrlCmd | KeyCode.KEY_C) && this.lastSelectedString) {
				this.clipboardService.writeText(this.lastSelectedString);
			}
		});
		this.list.onContextMenu((e) => {
			this.contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => [
					instantiationService.createInstance(CopyMessagesAction),
					instantiationService.createInstance(CopyAllMessagesAction)
				],
				getActionsContext: () => {
					return <IMessagesActionContext>{
						selection: this.lastSelectedString,
						messages: this.messages
					};
				}
			});
		});
		this.list.onDidScroll(e => {
			if (this.state) {
				this.state.scrollTop = e.scrollTop;
			}
		});
	}

	public render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	public layout(size: Dimension): void {
		const previousScroll = this.state ? this.state.scrollTop || 0 : 0;
		this.list.layout(size.height, size.width);
		this.list.scrollTop = previousScroll;
	}

	public focus(): void {
		this.list.domFocus();
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
			this.messages.push(...message);
		} else {
			this.messages.push(message);
		}
		const previousScroll = this.state ? this.state.scrollTop || 0 : 0;
		this.list.splice(0, this.list.length, this.messages);
		this.list.scrollTop = previousScroll;
	}

	private applyStyles(theme: ITheme): void {
		const errorColor = theme.getColor(resultsErrorColor);
		const content: string[] = [];
		if (errorColor) {
			content.push(`.message-list .monaco-list-rows .error-message { color: ${errorColor}; }`);
		}

		const newStyles = content.join('\n');
		if (newStyles !== this.styleElement.innerHTML) {
			this.styleElement.innerHTML = newStyles;
		}
	}

	private reset() {
		this.messages = [];
		this.list.splice(0, this.list.length);
	}

	public set state(val: MessagePanelState) {
		this._state = val;
		if (this.state.scrollTop) {
			this.list.scrollTop = this.state.scrollTop;
		}
	}

	public get state(): MessagePanelState {
		return this._state;
	}

	public clear() {
		this.reset();
		this._state = undefined;
	}

	public dispose() {
		dispose(this.queryRunnerDisposables);
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
