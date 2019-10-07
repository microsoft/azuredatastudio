/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Router } from '@angular/router';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { MetadataType } from 'sql/platform/connection/common/connectionManagement';
import { SingleConnectionManagementService, CommonServiceInterface } from 'sql/platform/bootstrap/browser/commonServiceInterface.service';
import { ManageActionContext, BaseActionContext } from 'sql/workbench/browser/actions';

import * as tree from 'vs/base/parts/tree/browser/tree';
import * as TreeDefaults from 'vs/base/parts/tree/browser/treeDefaults';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IAction } from 'vs/base/common/actions';
import { generateUuid } from 'vs/base/common/uuid';
import { $ } from 'vs/base/browser/dom';
import { IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IEditorProgressService } from 'vs/platform/progress/common/progress';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { createAndFillInContextMenuActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { ItemContextKey } from 'sql/workbench/parts/dashboard/browser/widgets/explorer/explorerTreeContext';
import { ObjectMetadataWrapper } from 'sql/workbench/parts/dashboard/browser/widgets/explorer/objectMetadataWrapper';

export declare type TreeResource = IConnectionProfile | ObjectMetadataWrapper;

// Empty class just for tree input
export class ExplorerModel {
	public static readonly id = generateUuid();
}

export class ExplorerController extends TreeDefaults.DefaultController {
	private readonly contextKey = new ItemContextKey(this.contextKeyService);

	constructor(
		// URI for the dashboard for managing, should look into some other way of doing this
		private _uri,
		private _connectionService: SingleConnectionManagementService,
		private _router: Router,
		private readonly bootStrapService: CommonServiceInterface,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IEditorProgressService private readonly progressService: IEditorProgressService,
		@IMenuService private readonly menuService: IMenuService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService
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
		this.contextKey.set({
			resource: element,
			providerName: this.bootStrapService.connectionManagementService.connectionInfo.providerId,
			isCloud: this.bootStrapService.connectionManagementService.connectionInfo.serverInfo.isCloud
		});

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

		const menu = this.menuService.createMenu(MenuId.ExplorerWidgetContext, this.contextKeyService);
		const primary: IAction[] = [];
		const secondary: IAction[] = [];
		const result = { primary, secondary };
		createAndFillInContextMenuActions(menu, { shouldForwardArgs: true }, result, this.contextMenuService, g => g === 'inline');

		this.contextMenuService.showContextMenu({
			getAnchor: () => { return { x: event.posx, y: event.posy }; },
			getActions: () => result.secondary,
			getActionsContext: () => context
		});

		return true;
	}

	private handleItemDoubleClick(element: IConnectionProfile): void {
		this.progressService.showWhile(this._connectionService.changeDatabase(element.databaseName).then(result => {
			this._router.navigate(['database-dashboard']);
		}));
	}

	protected onEnter(tree: tree.ITree, event: IKeyboardEvent): boolean {
		const result = super.onEnter(tree, event);
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
		const row = $('.list-row');
		const label = $('.label');

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
					templateData.icon.className = 'icon storedprocedure';
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
		const filterString = this._filterString.trim().toLowerCase();
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
			const filterArray = filterString.split(':');

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
