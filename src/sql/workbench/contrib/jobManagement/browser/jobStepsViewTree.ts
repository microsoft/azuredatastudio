/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as DOM from 'vs/base/browser/dom';
import * as tree from 'sql/base/parts/tree/browser/tree';
import * as TreeDefaults from 'sql/base/parts/tree/browser/treeDefaults';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { generateUuid } from 'vs/base/common/uuid';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IJobStepsViewRow } from 'sql/workbench/services/jobManagement/common/interfaces';

export class JobStepsViewRow implements IJobStepsViewRow {
	public stepId: string;
	public stepName: string;
	public message: string;
	public rowID: string = generateUuid();
	public runStatus: string;
}

// Empty class just for tree input
export class JobStepsViewModel {
	public static readonly id = generateUuid();
}

export class JobStepsViewController extends TreeDefaults.DefaultController {

	protected override onLeftClick(tree: tree.ITree, element: JobStepsViewRow, event: IMouseEvent, origin: string = 'mouse'): boolean {
		return true;
	}

	public override onContextMenu(tree: tree.ITree, element: JobStepsViewRow, event: tree.ContextMenuEvent): boolean {
		return true;
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

export class JobStepsViewDataSource implements tree.IDataSource {
	private _data: JobStepsViewRow[];

	public getId(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): string {
		if (element instanceof JobStepsViewModel) {
			return JobStepsViewModel.id;
		} else {
			return (element as JobStepsViewRow).rowID;
		}
	}

	public hasChildren(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): boolean {
		if (element instanceof JobStepsViewModel) {
			return true;
		} else {
			return false;
		}
	}

	public getChildren(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): Promise<JobStepsViewRow[]> {
		if (element instanceof JobStepsViewModel) {
			return Promise.resolve(this._data);
		} else {
			return Promise.resolve(undefined);
		}
	}

	public getParent(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): Promise<JobStepsViewModel> {
		if (element instanceof JobStepsViewModel) {
			return Promise.resolve(undefined);
		} else {
			return Promise.resolve(new JobStepsViewModel());
		}
	}

	public set data(data: JobStepsViewRow[]) {
		this._data = data;
	}
}

export interface IListTemplate {
	statusIcon: HTMLElement;
	label: HTMLElement;
}

export class JobStepsViewRenderer implements tree.IRenderer {

	public getHeight(tree: tree.ITree, element: JobStepsViewRow): number {
		return 40;
	}

	public getTemplateId(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): string {
		if (element instanceof JobStepsViewModel) {
			return 'jobStepsViewModel';
		} else {
			return 'jobStepsViewRow';
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

	public renderElement(tree: tree.ITree, element: JobStepsViewRow, templateId: string, templateData: IListTemplate): void {
		let stepIdCol: HTMLElement = DOM.$('div');
		stepIdCol.className = 'tree-id-col';
		stepIdCol.innerText = element.stepId;
		let stepNameCol: HTMLElement = DOM.$('div');
		stepNameCol.className = 'tree-name-col';
		stepNameCol.innerText = element.stepName;
		let stepMessageCol: HTMLElement = DOM.$('div');
		stepMessageCol.className = 'tree-message-col';
		stepMessageCol.innerText = element.message;
		if (element.rowID.indexOf('stepsColumn') !== -1) {
			stepNameCol.className += ' step-column-heading';
			stepIdCol.className += ' step-column-heading';
			stepMessageCol.className += ' step-column-heading';
		}
		DOM.clearNode(templateData.label);
		templateData.label.appendChild(stepIdCol);
		templateData.label.appendChild(stepNameCol);
		templateData.label.appendChild(stepMessageCol);
		if (element.runStatus) {
			if (element.runStatus === 'Succeeded') {
				templateData.statusIcon.className = 'status-icon step-passed';
			} else if (element.runStatus === 'Failed') {
				templateData.statusIcon.className = 'status-icon step-failed';
			} else {
				templateData.statusIcon.className = 'status-icon step-unknown';
			}
		} else {
			templateData.statusIcon.className = '';
		}
	}

	public disposeTemplate(tree: tree.ITree, templateId: string, templateData: IListTemplate): void {
		// no op
	}

	private createStatusIcon(): HTMLElement {
		let statusIcon: HTMLElement = DOM.$('div');
		return statusIcon;
	}
}

export class JobStepsViewFilter implements tree.IFilter {

	public isVisible(tree: tree.ITree, element: JobStepsViewRow): boolean {
		return this._isJobVisible();
	}

	private _isJobVisible(): boolean {
		return true;
	}

	public set filterString(val: string) {
	}
}
