/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IResultMessage } from 'sqlops';

import { ViewletPanel } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IDataSource, ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { TPromise } from 'vs/base/common/winjs.base';

const TemplateIds = {
	TIMESTAMP: 'timestamp',
	MESSAGE: 'message',
	MODEL: 'model'
};

export class MessagePanel extends ViewletPanel {
	private ds = new MessageDataSource();
	private renderer = new MessageRenderer();

	protected renderBody(container: HTMLElement): void {
		container.innerText = 'Messages';
	}

	protected layoutBody(size: number): void {
	}

	public onMessage(message: IResultMessage) {

	}
}

class MessageDataSource implements IDataSource {
	getId(tree: ITree, element: any): string {
		throw new Error("Method not implemented.");
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
		}
	}

	renderTemplate(tree: ITree, templateId: string, container: HTMLElement) {
		throw new Error("Method not implemented.");
	}

	renderElement(tree: ITree, element: any, templateId: string, templateData: any): void {
		throw new Error("Method not implemented.");
	}

	disposeTemplate(tree: ITree, templateId: string, templateData: any): void {
	}
}

export class Model {
	public messages: IResultMessage[] = [];
}
