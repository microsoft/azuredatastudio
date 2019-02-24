/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Router } from '@angular/router';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { MetadataType, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { SingleConnectionManagementService } from 'sql/services/common/commonServiceInterface.service';
import {
	NewQueryAction, ScriptSelectAction, EditDataAction, ScriptCreateAction, ScriptExecuteAction, ScriptAlterAction,
	BackupAction, ManageActionContext, BaseActionContext, ManageAction, RestoreAction
} from 'sql/workbench/common/actions';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import * as Constants from 'sql/platform/connection/common/constants';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IAngularEventingService } from 'sql/platform/angularEventing/common/angularEventingService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

import { ObjectMetadata } from 'sqlops';

import * as tree from 'vs/base/parts/tree/browser/tree';
import * as TreeDefaults from 'vs/base/parts/tree/browser/treeDefaults';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IAction } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { generateUuid } from 'vs/base/common/uuid';
import { $ } from 'vs/base/browser/dom';
import { ExecuteCommandAction } from 'vs/platform/actions/common/actions';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IProgressService } from 'vs/platform/progress/common/progress';

export class ObjectMetadataWrapper implements ObjectMetadata {
	public metadataType: MetadataType;
	public metadataTypeName: string;
	public urn: string;
	public name: string;
	public schema: string;

	constructor(from?: ObjectMetadata) {
		if (from) {
			this.metadataType = from.metadataType;
			this.metadataTypeName = from.metadataTypeName;
			this.urn = from.urn;
			this.name = from.name;
			this.schema = from.schema;
		}
	}

	public matches(other: ObjectMetadataWrapper): boolean {
		if (!other) {
			return false;
		}

		return this.metadataType === other.metadataType
			&& this.schema === other.schema
			&& this.name === other.name;
	}

	public static createFromObjectMetadata(objectMetadata: ObjectMetadata[]): ObjectMetadataWrapper[] {
		if (!objectMetadata) {
			return undefined;
		}

		return objectMetadata.map(m => new ObjectMetadataWrapper(m));
	}

	// custom sort : Table > View > Stored Procedures > Function
	public static sort(metadata1: ObjectMetadataWrapper, metadata2: ObjectMetadataWrapper): number {
		// compare the object type
		if (metadata1.metadataType < metadata2.metadataType) {
			return -1;
		} else if (metadata1.metadataType > metadata2.metadataType) {
			return 1;

			// otherwise compare the schema
		} else {
			let schemaCompare: number = metadata1.schema && metadata2.schema
				? metadata1.schema.localeCompare(metadata2.schema)
				// schemas are not expected to be undefined, but if they are then compare using object names
				: 0;

			if (schemaCompare !== 0) {
				return schemaCompare;

				// otherwise compare the object name
			} else {
				return metadata1.name.localeCompare(metadata2.name);
			}
		}
	}
}

export declare type TreeResource = IConnectionProfile | ObjectMetadataWrapper;

// Empty class just for tree input
export class ExplorerModel {
	public static readonly id = generateUuid();
}

export class ExplorerController extends TreeDefaults.DefaultController {
	constructor(
		// URI for the dashboard for managing, should look into some other way of doing this
		private _uri,
		private _connectionService: SingleConnectionManagementService,
		private _router: Router,
		private _contextMenuService: IContextMenuService,
		private _capabilitiesService: ICapabilitiesService,
		private _instantiationService: IInstantiationService,
		private _progressService: IProgressService
	) {
		super();
	}

	protected onLeftClick(tree: tree.ITree, element: TreeResource, event: IMouseEvent, origin: string = 'mouse'): boolean {
		const payload = { origin: origin };
		const isDoubleClick = (origin === 'mouse' && event.detail === 2);
		// Cancel Event
		const isMouseDown = event && event.browserEvent && event.browserEvent.type === 'mousedown';

		if (!isMouseDown) {
			event.preventDefault(); // we cannot preventDefault onMouseDown because this would break DND otherwise
		}

		event.stopPropagation();

		tree.setFocus(element, payload);

		if (!(element instanceof ObjectMetadataWrapper) && isDoubleClick) {
			event.preventDefault(); // focus moves to editor, we need to prevent default
			this.handleItemDoubleClick(element);
		} else {
			tree.setFocus(element, payload);
			tree.setSelection([element], payload);
		}

		return true;
	}

	public onContextMenu(tree: tree.ITree, element: TreeResource, event: tree.ContextMenuEvent): boolean {
		let context: ManageActionContext | BaseActionContext;

		if (element instanceof ObjectMetadataWrapper) {
			context = {
				object: element,
				profile: this._connectionService.connectionInfo.connectionProfile
			};
		} else {
			context = {
				profile: element,
				uri: this._uri
			};
		}

		this._contextMenuService.showContextMenu({
			getAnchor: () => { return { x: event.posx, y: event.posy }; },
			getActions: () => getExplorerActions(element, this._instantiationService, this._capabilitiesService, this._connectionService.connectionInfo),
			getActionsContext: () => context
		});

		return true;
	}

	private handleItemDoubleClick(element: IConnectionProfile): void {
		this._progressService.showWhile(this._connectionService.changeDatabase(element.databaseName).then(result => {
			this._router.navigate(['database-dashboard']);
		}));
	}

	protected onEnter(tree: tree.ITree, event: IKeyboardEvent): boolean {
		let result = super.onEnter(tree, event);
		if (result) {
			const focus = tree.getFocus();
			if (focus && !(focus instanceof ObjectMetadataWrapper)) {
				this._connectionService.changeDatabase(focus.databaseName).then(result => {
					this._router.navigate(['database-dashboard']);
				});
			}
		}
		return result;
	}
}

export class ExplorerDataSource implements tree.IDataSource {
	private _data: TreeResource[];

	public getId(tree: tree.ITree, element: TreeResource | ExplorerModel): string {
		if (element instanceof ObjectMetadataWrapper) {
			return element.urn || element.schema + element.name;
		} else if (element instanceof ExplorerModel) {
			return ExplorerModel.id;
		} else {
			return (element as IConnectionProfile).getOptionsKey();
		}
	}

	public hasChildren(tree: tree.ITree, element: TreeResource | ExplorerModel): boolean {
		if (element instanceof ExplorerModel) {
			return true;
		} else {
			return false;
		}
	}

	public getChildren(tree: tree.ITree, element: TreeResource | ExplorerModel): Promise<TreeResource[]> {
		if (element instanceof ExplorerModel) {
			return Promise.resolve(this._data);
		} else {
			return Promise.resolve(undefined);
		}
	}

	public getParent(tree: tree.ITree, element: TreeResource | ExplorerModel): Promise<ExplorerModel> {
		if (element instanceof ExplorerModel) {
			return Promise.resolve(undefined);
		} else {
			return Promise.resolve(new ExplorerModel());
		}
	}

	public set data(data: TreeResource[]) {
		this._data = data;
	}
}

enum TEMPLATEIDS {
	profile = 'profile',
	object = 'object'
}

export interface IListTemplate {
	icon?: HTMLElement;
	label: HTMLElement;
}

export class ExplorerRenderer implements tree.IRenderer {
	public getHeight(tree: tree.ITree, element: TreeResource): number {
		return 22;
	}

	public getTemplateId(tree: tree.ITree, element: TreeResource): string {
		if (element instanceof ObjectMetadataWrapper) {
			return TEMPLATEIDS.object;
		} else {
			return TEMPLATEIDS.profile;
		}
	}

	public renderTemplate(tree: tree.ITree, templateId: string, container: HTMLElement): IListTemplate {
		let row = $('.list-row');
		let label = $('.label');

		let icon: HTMLElement;
		if (templateId === TEMPLATEIDS.object) {
			icon = $('div');
		} else {
			icon = $('.icon.database');
		}

		row.appendChild(icon);
		row.appendChild(label);
		container.appendChild(row);

		return { icon, label };
	}

	public renderElement(tree: tree.ITree, element: TreeResource, templateId: string, templateData: IListTemplate): void {
		if (element instanceof ObjectMetadataWrapper) {
			switch (element.metadataType) {
				case MetadataType.Function:
					templateData.icon.className = 'icon scalarvaluedfunction';
					break;
				case MetadataType.SProc:
					templateData.icon.className = 'icon stored-procedure';
					break;
				case MetadataType.Table:
					templateData.icon.className = 'icon table';
					break;
				case MetadataType.View:
					templateData.icon.className = 'icon view';
					break;
			}
			templateData.label.innerText = element.schema + '.' + element.name;
		} else {
			templateData.label.innerText = element.databaseName;
		}
		templateData.label.title = templateData.label.innerText;
	}

	public disposeTemplate(tree: tree.ITree, templateId: string, templateData: IListTemplate): void {
		// no op
	}

}

export class ExplorerFilter implements tree.IFilter {
	private _filterString: string;

	public isVisible(tree: tree.ITree, element: TreeResource): boolean {
		if (element instanceof ObjectMetadataWrapper) {
			return this._doIsVisibleObjectMetadata(element);
		} else {
			return this._doIsVisibleConnectionProfile(element);
		}
	}

	// apply filter to databasename of the profile
	private _doIsVisibleConnectionProfile(element: IConnectionProfile): boolean {
		if (!this._filterString) {
			return true;
		}
		let filterString = this._filterString.trim().toLowerCase();
		return element.databaseName.toLowerCase().includes(filterString);
	}

	// apply filter for objectmetadatawrapper
	// could be improved by pre-processing the filter string
	private _doIsVisibleObjectMetadata(element: ObjectMetadataWrapper): boolean {
		if (!this._filterString) {
			return true;
		}
		// freeze filter string for edge cases
		let filterString = this._filterString.trim().toLowerCase();

		// determine if a filter is applied
		let metadataType: MetadataType;

		if (filterString.includes(':')) {
			let filterArray = filterString.split(':');

			if (filterArray.length > 2) {
				filterString = filterArray.slice(1, filterArray.length - 1).join(':');
			} else {
				filterString = filterArray[1];
			}

			switch (filterArray[0].toLowerCase()) {
				case 'v':
					metadataType = MetadataType.View;
					break;
				case 't':
					metadataType = MetadataType.Table;
					break;
				case 'sp':
					metadataType = MetadataType.SProc;
					break;
				case 'f':
					metadataType = MetadataType.Function;
					break;
				case 'a':
					return true;
				default:
					break;
			}
		}

		if (metadataType !== undefined) {
			return element.metadataType === metadataType && (element.schema + '.' + element.name).toLowerCase().includes(filterString);
		} else {
			return (element.schema + '.' + element.name).toLowerCase().includes(filterString);
		}
	}

	public set filterString(val: string) {
		this._filterString = val;
	}
}

function getExplorerActions(element: TreeResource, instantiationService: IInstantiationService, capabilitiesService: ICapabilitiesService, info: ConnectionManagementInfo): IAction[] {
	let actions: IAction[] = [];

	if (element instanceof ObjectMetadataWrapper) {
		if (element.metadataType === MetadataType.View || element.metadataType === MetadataType.Table) {
			actions.push(instantiationService.createInstance(ExplorerScriptSelectAction, ScriptSelectAction.ID, ScriptSelectAction.LABEL));
		}

		if (element.metadataType === MetadataType.Table) {
			actions.push(instantiationService.createInstance(EditDataAction, EditDataAction.ID, EditDataAction.LABEL));
		}

		if (element.metadataType === MetadataType.SProc && info.connectionProfile.providerName === Constants.mssqlProviderName) {
			actions.push(instantiationService.createInstance(ExplorerScriptExecuteAction, ScriptExecuteAction.ID, ScriptExecuteAction.LABEL));
		}

		if ((element.metadataType === MetadataType.SProc || element.metadataType === MetadataType.Function || element.metadataType === MetadataType.View)
			&& info.connectionProfile.providerName === Constants.mssqlProviderName) {
			actions.push(instantiationService.createInstance(ExplorerScriptAlterAction, ScriptAlterAction.ID, ScriptAlterAction.LABEL));
		}
	} else {
		actions.push(instantiationService.createInstance(CustomExecuteCommandAction, NewQueryAction.ID, NewQueryAction.LABEL));

		let action: IAction = instantiationService.createInstance(CustomExecuteCommandAction, RestoreAction.ID, RestoreAction.LABEL);
		if (capabilitiesService.isFeatureAvailable(action, info)) {
			actions.push(action);
		}

		action = instantiationService.createInstance(CustomExecuteCommandAction, BackupAction.ID, BackupAction.LABEL);
		if (capabilitiesService.isFeatureAvailable(action, info)) {
			actions.push(action);
		}

		actions.push(instantiationService.createInstance(ExplorerManageAction, ManageAction.ID, ManageAction.LABEL));
		return actions;
	}

	actions.push(instantiationService.createInstance(ExplorerScriptCreateAction, ScriptCreateAction.ID, ScriptCreateAction.LABEL));

	return actions;
}

class CustomExecuteCommandAction extends ExecuteCommandAction {
	run(context: ManageActionContext): Promise<any> {
		return super.run(context.profile);
	}
}

class ExplorerScriptSelectAction extends ScriptSelectAction {
	constructor(
		id: string, label: string,
		@IQueryEditorService queryEditorService: IQueryEditorService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IScriptingService scriptingService: IScriptingService,
		@IProgressService private progressService: IProgressService
	) {
		super(id, label, queryEditorService, connectionManagementService, scriptingService);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		let promise = super.run(actionContext);
		this.progressService.showWhile(promise);
		return promise;
	}
}

class ExplorerScriptCreateAction extends ScriptCreateAction {
	constructor(
		id: string, label: string,
		@IQueryEditorService queryEditorService: IQueryEditorService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IScriptingService scriptingService: IScriptingService,
		@IErrorMessageService errorMessageService: IErrorMessageService,
		@IProgressService private progressService: IProgressService
	) {
		super(id, label, queryEditorService, connectionManagementService, scriptingService, errorMessageService);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		let promise = super.run(actionContext);
		this.progressService.showWhile(promise);
		return promise;
	}
}

class ExplorerScriptAlterAction extends ScriptAlterAction {
	constructor(
		id: string, label: string,
		@IQueryEditorService queryEditorService: IQueryEditorService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IScriptingService scriptingService: IScriptingService,
		@IErrorMessageService errorMessageService: IErrorMessageService,
		@IProgressService private progressService: IProgressService
	) {
		super(id, label, queryEditorService, connectionManagementService, scriptingService, errorMessageService);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		let promise = super.run(actionContext);
		this.progressService.showWhile(promise);
		return promise;
	}
}

class ExplorerScriptExecuteAction extends ScriptExecuteAction {
	constructor(
		id: string, label: string,
		@IQueryEditorService queryEditorService: IQueryEditorService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IScriptingService scriptingService: IScriptingService,
		@IErrorMessageService errorMessageService: IErrorMessageService,
		@IProgressService private progressService: IProgressService
	) {
		super(id, label, queryEditorService, connectionManagementService, scriptingService, errorMessageService);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		let promise = super.run(actionContext);
		this.progressService.showWhile(promise);
		return promise;
	}
}

class ExplorerManageAction extends ManageAction {
	constructor(
		id: string, label: string,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IAngularEventingService angularEventingService: IAngularEventingService,
		@IProgressService private _progressService: IProgressService
	) {
		super(id, label, connectionManagementService, angularEventingService);
	}

	public run(actionContext: ManageActionContext): Promise<boolean> {
		let promise = super.run(actionContext);
		this._progressService.showWhile(promise);
		return promise;
	}
}
