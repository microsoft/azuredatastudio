/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Router } from '@angular/router';

import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { MetadataType } from 'sql/parts/connection/common/connectionManagement';
import { SingleConnectionManagementService } from 'sql/services/common/commonServiceInterface.service';
import {
	NewQueryAction, ScriptSelectAction, EditDataAction, ScriptCreateAction, ScriptExecuteAction, ScriptAlterAction,
	BackupAction, ManageActionContext, BaseActionContext, ManageAction, RestoreAction
} from 'sql/workbench/common/actions';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import * as Constants from 'sql/parts/connection/common/constants';
import * as tree from 'vs/base/parts/tree/browser/tree';
import * as TreeDefaults from 'vs/base/parts/tree/browser/treeDefaults';
import { Promise, TPromise } from 'vs/base/common/winjs.base';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IAction } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { generateUuid } from 'vs/base/common/uuid';
import * as DOM from 'vs/base/browser/dom';
import { OEAction } from 'sql/parts/objectExplorer/viewlet/objectExplorerActions';
import { Builder, $, withElementById } from 'vs/base/browser/builder';
import { AgentJobHistoryInfo } from 'sqlops';
import { Agent } from 'vs/base/node/request';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { JobHistoryComponent } from './jobHistory.component';

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
		} else {
			event.preventDefault();
			event.stopPropagation();
			return true;
		}
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
}

export interface IListTemplate {
	statusIcon: HTMLElement;
	label: HTMLElement;
}

export class JobHistoryRenderer implements tree.IRenderer {
	private _statusIcon: HTMLElement;

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
		this._statusIcon = this.createStatusIcon();
		row.appendChild(this._statusIcon);
		row.appendChild(label);
		container.appendChild(row);
		let statusIcon = this._statusIcon;
		return { statusIcon, label };
	}

	public renderElement(tree: tree.ITree, element: JobHistoryRow, templateId: string, templateData: IListTemplate): void {
		templateData.label.innerHTML = element.runDate + '&nbsp;&nbsp;' + element.runStatus;
		let statusClass: string;
		if (element.runStatus === 'Succeeded') {
			statusClass = ' job-passed';
		} else if (element.runStatus === 'Failed') {
			statusClass = ' job-failed';
		} else {
			statusClass = ' job-unknown';
		}
		this._statusIcon.className += statusClass;
	}

	public disposeTemplate(tree: tree.ITree, templateId: string, templateData: IListTemplate): void {
		// no op
	}

	private createStatusIcon(): HTMLElement {
		let statusIcon: HTMLElement = DOM.$('div');
		statusIcon.className += ' status-icon';
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
