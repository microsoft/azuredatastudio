/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	NewQueryAction, ScriptSelectAction, EditDataAction, ScriptCreateAction, ScriptExecuteAction, ScriptAlterAction,
	BackupAction, ManageActionContext, BaseActionContext, ManageAction, RestoreAction
} from 'sql/workbench/common/actions';
import * as tree from 'vs/base/parts/tree/browser/tree';
import * as TreeDefaults from 'vs/base/parts/tree/browser/treeDefaults';
import { Promise, TPromise } from 'vs/base/common/winjs.base';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { generateUuid } from 'vs/base/common/uuid';
import * as DOM from 'vs/base/browser/dom';
import { AgentJobHistoryInfo } from 'sqlops';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';

export class JobHistoryRow {
	runDate: string;
	runStatus: string;
	instanceID: number;
	rowID: string = generateUuid();
}

// Empty class just for tree input
export class JobHistoryModel {
	public static readonly id = generateUuid();
}

export class JobHistoryController extends TreeDefaults.DefaultController {
	private _jobHistories: AgentJobHistoryInfo[];

	protected onLeftClick(tree: tree.ITree, element: JobHistoryRow, event: IMouseEvent, origin: string = 'mouse'): boolean {
		return true;
	}

	public set jobHistories(value: AgentJobHistoryInfo[]) {
		this._jobHistories = value;
	}

	public get jobHistories(): AgentJobHistoryInfo[] {
		return this._jobHistories;
	}

	public onKeyDownWrapper(tree: tree.ITree, event: IKeyboardEvent): boolean {
		if (event.code === 'ArrowDown' || event.keyCode === 40) {
			super.onDown(tree, event);
			return super.onEnter(tree, event);
		} else if (event.code === 'ArrowUp' || event.keyCode === 38) {
			super.onUp(tree, event);
			return super.onEnter(tree, event);
		} else if (event.code !== 'Tab' && event.keyCode !== 2) {
			event.preventDefault();
			event.stopPropagation();
			return true;
		}
		return false;
	}
}

export class JobHistoryDataSource implements tree.IDataSource {
	private _data: JobHistoryRow[];

	public getId(tree: tree.ITree, element: JobHistoryRow | JobHistoryModel): string {
		if (element instanceof JobHistoryModel) {
			return JobHistoryModel.id;
		} else {
			return (element as JobHistoryRow).rowID;
		}
	}

	public hasChildren(tree: tree.ITree, element: JobHistoryRow | JobHistoryModel): boolean {
		if (element instanceof JobHistoryModel) {
			return true;
		} else {
			return false;
		}
	}

	public getChildren(tree: tree.ITree, element: JobHistoryRow | JobHistoryModel): Promise {
		if (element instanceof JobHistoryModel) {
			return TPromise.as(this._data);
		} else {
			return TPromise.as(undefined);
		}
	}

	public getParent(tree: tree.ITree, element: JobHistoryRow | JobHistoryModel): Promise {
		if (element instanceof JobHistoryModel) {
			return TPromise.as(undefined);
		} else {
			return TPromise.as(new JobHistoryModel());
		}
	}

	public set data(data: JobHistoryRow[]) {
		this._data = data;
	}

	public getFirstElement() {
		return this._data[0];
	}
}

export interface IListTemplate {
	statusIcon: HTMLElement;
	label: HTMLElement;
}

export class JobHistoryRenderer implements tree.IRenderer {

	public getHeight(tree: tree.ITree, element: JobHistoryRow): number {
		return 30;
	}

	public getTemplateId(tree: tree.ITree, element: JobHistoryRow | JobHistoryModel): string {
		if (element instanceof JobHistoryModel) {
			return 'jobHistoryModel';
		} else {
			return 'jobHistoryInfo';
		}
	}

	public renderTemplate(tree: tree.ITree, templateId: string, container: HTMLElement): IListTemplate {
		let row = DOM.$('.list-row');
		let label = DOM.$('.label');
		let statusIcon = this.createStatusIcon();
		row.appendChild(statusIcon);
		row.appendChild(label);
		container.appendChild(row);
		return { statusIcon, label };
	}

	public renderElement(tree: tree.ITree, element: JobHistoryRow, templateId: string, templateData: IListTemplate): void {
		templateData.label.innerHTML = element.runDate + '&nbsp;&nbsp;' + element.runStatus;
		let statusClass: string;
		if (element.runStatus === 'Succeeded') {
			statusClass = 'status-icon job-passed';
		} else if (element.runStatus === 'Failed') {
			statusClass = 'status-icon job-failed';
		} else {
			statusClass = 'status-icon job-unknown';
		}
		templateData.statusIcon.className = statusClass;
	}

	public disposeTemplate(tree: tree.ITree, templateId: string, templateData: IListTemplate): void {
		// no op
	}

	private createStatusIcon(): HTMLElement {
		let statusIcon: HTMLElement = DOM.$('div');
		return statusIcon;
	}
}

export class JobHistoryFilter implements tree.IFilter {
	private _filterString: string;

	public isVisible(tree: tree.ITree, element: JobHistoryRow): boolean {
		return this._isJobVisible();
	}

	private _isJobVisible(): boolean {
		return true;
	}

	public set filterString(val: string) {
		this._filterString = val;
	}
}
