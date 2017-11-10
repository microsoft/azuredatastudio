/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/objectTypes/objecttypes';
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/explorerWidget';

import { Component, Inject, forwardRef, ChangeDetectorRef, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';

import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { MetadataType } from 'sql/parts/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { BaseActionContext } from 'sql/workbench/common/actions';
import { GetExplorerActions } from './explorerActions';
import { toDisposableSubscription } from 'sql/parts/common/rxjsUtils';
import { warn } from 'sql/base/common/log';
import { MultipleRequestDelayer } from 'sql/base/common/async';

import { IDisposable } from 'vs/base/common/lifecycle';
import { InputBox, IInputOptions } from 'vs/base/browser/ui/inputbox/inputBox';
import { attachInputBoxStyler, attachListStyler } from 'vs/platform/theme/common/styler';
import * as nls from 'vs/nls';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IDelegate, IRenderer } from 'vs/base/browser/ui/list/list';
import * as types from 'vs/base/common/types';
import { $, getContentHeight } from 'vs/base/browser/dom';
import { Delayer } from 'vs/base/common/async';

import { ObjectMetadata } from 'data';

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

declare type ListResource = string | ObjectMetadataWrapper;

enum TemplateIds {
	STRING = 'string',
	METADATA = 'metadata'
}

interface IListTemplate {
	icon?: HTMLElement;
	label: HTMLElement;
}

class Delegate implements IDelegate<ListResource> {
	getHeight(element: ListResource): number {
		return 22;
	}

	getTemplateId(element: ListResource): string {
		if (element instanceof ObjectMetadataWrapper) {
			return TemplateIds.METADATA.toString();
		} else if (types.isString(element)) {
			return TemplateIds.STRING.toString();
		} else {
			return '';
		}
	}
}

class StringRenderer implements IRenderer<string, IListTemplate> {
	public readonly templateId = TemplateIds.STRING.toString();

	renderTemplate(container: HTMLElement): IListTemplate {
		let row = $('.list-row');
		let icon = $('.icon.database');
		let label = $('.label');
		row.appendChild(icon);
		row.appendChild(label);
		container.appendChild(row);
		return { icon, label };
	}

	renderElement(element: string, index: number, templateData: IListTemplate): void {
		templateData.label.innerText = element;
	}

	disposeTemplate(templateData: IListTemplate): void {
		// no op
	}
}

class MetadataRenderer implements IRenderer<ObjectMetadataWrapper, IListTemplate> {
	public readonly templateId = TemplateIds.METADATA.toString();

	renderTemplate(container: HTMLElement): IListTemplate {
		let row = $('.list-row');
		let icon = $('div');
		let label = $('.label');
		row.appendChild(icon);
		row.appendChild(label);
		container.appendChild(row);
		return { icon, label };
	}

	renderElement(element: ObjectMetadataWrapper, index: number, templateData: IListTemplate): void {
		if (element && element) {
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
		}
	}

	disposeTemplate(templateData: IListTemplate): void {
		// no op
	}
}

@Component({
	selector: 'explorer-widget',
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/widgets/explorer/explorerWidget.component.html'))
})
export class ExplorerWidget extends DashboardWidget implements IDashboardWidget, OnInit, OnDestroy {

	private _isCloud: boolean;
	private _tableData: ListResource[];
	private _disposables: Array<IDisposable> = [];
	private _input: InputBox;
	private _table: List<ListResource>;
	private _lastClickedItem: ListResource;
	private _filterDelayer = new Delayer<void>(200);
	private _dblClickDelayer = new MultipleRequestDelayer<void>(500);

	@ViewChild('input') private _inputContainer: ElementRef;
	@ViewChild('table') private _tableContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => DashboardServiceInterface)) private _bootstrap: DashboardServiceInterface,
		@Inject(forwardRef(() => Router)) private _router: Router,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
		super();
		this._isCloud = _bootstrap.connectionManagementService.connectionInfo.serverInfo.isCloud;
		this.init();
	}

	ngOnInit() {
		let inputOptions: IInputOptions = {
			placeholder: this._config.context === 'database' ? nls.localize('seachObjects', 'Search by name of type (a:, t:, v:, f:, or sp:)') : nls.localize('searchDatabases', 'Search databases')
		};
		this._input = new InputBox(this._inputContainer.nativeElement, this._bootstrap.contextViewService, inputOptions);
		this._disposables.push(this._input.onDidChange(e => {
			this._filterDelayer.trigger(() => {
				this._table.splice(0, this._table.length, this._filterTable(e));
			});
		}));
		this._table = new List<ListResource>(this._tableContainer.nativeElement, new Delegate(), [new MetadataRenderer(), new StringRenderer()]);
		this._disposables.push(this._table.onContextMenu(e => {
			this.handleContextMenu(e.element, e.index, e.anchor);
		}));
		this._disposables.push(this._table.onSelectionChange(e => {
			if (e.elements.length > 0 && this._lastClickedItem === e.elements[0]) {
				this._dblClickDelayer.trigger(() => this.handleItemDoubleClick(e.elements[0]));
			} else {
				this._lastClickedItem = e.elements.length > 0 ? e.elements[0] : undefined;
			}
		}));
		this._table.layout(getContentHeight(this._tableContainer.nativeElement));
		this._disposables.push(this._input);
		this._disposables.push(attachInputBoxStyler(this._input, this._bootstrap.themeService));
		this._disposables.push(this._table);
		this._disposables.push(attachListStyler(this._table, this._bootstrap.themeService));
	}

	ngOnDestroy() {
		this._disposables.forEach(i => i.dispose());
	}

	private init(): void {
		if (this._config.context === 'database') {
			this._disposables.push(toDisposableSubscription(this._bootstrap.metadataService.metadata.subscribe(
				data => {
					if (data) {
						this._tableData = ObjectMetadataWrapper.createFromObjectMetadata(data.objectMetadata);
						this._tableData.sort(ObjectMetadataWrapper.sort);
						this._table.splice(0, this._table.length, this._tableData);
					}
				},
				error => {
					(<HTMLElement>this._el.nativeElement).innerText = nls.localize('dashboard.explorer.objectError', "Unable to load objects");
				}
			)));
		} else {
			this._disposables.push(toDisposableSubscription(this._bootstrap.metadataService.databaseNames.subscribe(
				data => {
					this._tableData = data;
					this._table.splice(0, this._table.length, this._tableData);
				},
				error => {
					(<HTMLElement>this._el.nativeElement).innerText = nls.localize('dashboard.explorer.databaseError', "Unable to load databases");
				}
			)));
		}
	}

	/**
	 * Handles action when an item is double clicked in the explorer widget
	 * @param val If on server page, explorer objects will be strings representing databases;
	 * If on databasepage, explorer objects will be ObjectMetadataWrapper representing object types;
	 *
	 */
	private handleItemDoubleClick(val: ListResource): void {
		if (types.isString(val)) {
			this._bootstrap.connectionManagementService.changeDatabase(val as string).then(result => {
				this._router.navigate(['database-dashboard']);
			});
		}
	}

	/**
	 * Handles action when a item is clicked in the explorer widget
	 * @param val If on server page, explorer objects will be strings representing databases;
	 * If on databasepage, explorer objects will be ObjectMetadataWrapper representing object types;
	 * @param index Index of the value in the array the ngFor template is built from
	 * @param event Click event
	 */
	private handleContextMenu(val: ListResource, index: number, anchor: HTMLElement | { x: number, y: number }): void {
		// event will exist if the context menu span was clicked
		if (event) {
			if (this._config.context === 'server') {
				let newProfile = <IConnectionProfile>Object.create(this._bootstrap.connectionManagementService.connectionInfo.connectionProfile);
				newProfile.databaseName = val as string;
				this._bootstrap.contextMenuService.showContextMenu({
					getAnchor: () => anchor,
					getActions: () => GetExplorerActions(undefined, this._isCloud, this._bootstrap),
					getActionsContext: () => {
						return <BaseActionContext>{
							uri: this._bootstrap.getUnderlyingUri(),
							profile: newProfile,
							connInfo: this._bootstrap.connectionManagementService.connectionInfo,
							databasename: val as string
						};
					}
				});
			} else if (this._config.context === 'database') {
				let object = val as ObjectMetadataWrapper;
				this._bootstrap.contextMenuService.showContextMenu({
					getAnchor: () => anchor,
					getActions: () => GetExplorerActions(object.metadataType, this._isCloud, this._bootstrap),
					getActionsContext: () => {
						return <BaseActionContext>{
							object: object,
							uri: this._bootstrap.getUnderlyingUri(),
							profile: this._bootstrap.connectionManagementService.connectionInfo.connectionProfile
						};
					}
				});
			} else {
				warn('Unknown dashboard context: ', this._config.context);
			}
		}
		this._changeRef.detectChanges();
	}

	private _filterTable(val: string): ListResource[] {
		let items = this._tableData;
		if (!items) {
			return items;
		}

		// format filter string for clean filter, no white space and lower case
		let filterString = val.trim().toLowerCase();

		// handle case when passed a string array
		if (types.isString(items[0])) {
			let _items = <string[]>items;
			return _items.filter(item => {
				return item.toLowerCase().includes(filterString);
			});
		}

		// make typescript compiler happy
		let objectItems = items as ObjectMetadataWrapper[];

		// determine is a filter is applied
		let metadataType: MetadataType;

		if (val.includes(':')) {
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
					return objectItems;
				default:
					break;
			}
		}

		return objectItems.filter(item => {
			if (metadataType !== undefined) {
				return item.metadataType === metadataType && (item.schema + '.' + item.name).toLowerCase().includes(filterString);
			} else {
				return (item.schema + '.' + item.name).toLowerCase().includes(filterString);
			}
		});
	}
}
