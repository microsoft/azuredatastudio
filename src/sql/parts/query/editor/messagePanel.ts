/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import 'vs/css!./media/messagePanel';

import { IResultMessage } from 'sqlops';

import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IDataSource, ITree, IRenderer, ContextMenuEvent, IController } from 'vs/base/parts/tree/browser/tree';
import { TPromise } from 'vs/base/common/winjs.base';
import { generateUuid } from 'vs/base/common/uuid';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { OpenMode, ClickBehavior, ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { WorkbenchTreeController } from 'vs/platform/list/browser/listService';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { $ } from 'vs/base/browser/builder';
import { isArray } from 'vs/base/common/types';

export interface IResultMessageIntern extends IResultMessage {
	id?: string;
}

const TemplateIds = {
	TIMESTAMP: 'timestamp',
	MESSAGE: 'message',
	MODEL: 'model'
};

export class MessagePanel extends ViewletPanel {
	private ds = new MessageDataSource();
	private renderer = new MessageRenderer();
	private model = new Model();
	private controller: MessageController;
	private container = $('div message-tree').getHTMLElement();

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

	public onMessage(message: IResultMessage | IResultMessage[]) {
		if (isArray(message)) {
			this.model.messages.push(...message);
		} else {
			this.model.messages.push(message);
		}
		this.tree.refresh(this.model).then(() => {
			this.tree.setScrollPosition(1);
		});
	}

	public reset() {
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
			return TPromise.as(element.messages);
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
		} else {
			return TemplateIds.MESSAGE;
		}
	}

	renderTemplate(tree: ITree, templateId: string, container: HTMLElement) {
		if (templateId === TemplateIds.MESSAGE) {
			const message = $('div .message').getHTMLElement();
			container.appendChild(message);
			return message;
		} else {
			return undefined;
		}
	}

	renderElement(tree: ITree, element: IResultMessage, templateId: string, templateData: HTMLElement): void {
		if (templateId === TemplateIds.MESSAGE) {
			templateData.innerText = element.message;
		}
	}

	disposeTemplate(tree: ITree, templateId: string, templateData: any): void {
	}
}

export class MessageController extends WorkbenchTreeController {

	private lastSelectedString: string = null;
	public toFocusOnClick: { focus(): void };

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

		return true;
	}
}

export class Model {
	public messages: IResultMessageIntern[] = [];

	public uuid = generateUuid();

	public focus() {

	}
}
