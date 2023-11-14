/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import { TableFilteringEnabledContextKey, InTableContextKey, InQueryResultGridContextKey } from 'sql/workbench/services/componentContext/browser/contextKeys';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IQueryResultGrid } from 'sql/workbench/contrib/query/browser/gridPanel';
import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';

export const SERVICE_ID = 'componentContextService';
export const IComponentContextService = createDecorator<IComponentContextService>(SERVICE_ID);

export interface ComponentRegistrationResult extends IDisposable {
	componentContextKeyService: IContextKeyService;
}

/**
 * Service to register components and find out the active component for keybindings.
 */
export interface IComponentContextService {
	_serviceBrand: undefined;
	/**
	 * Register a table
	 * @param table The table to register
	 * @param contextKeyService The context key service to use for the table. If not provided, the global context key service will be used.
	 */
	registerTable(table: Table<any>, contextKeyService?: IContextKeyService): ComponentRegistrationResult;
	/**
	 * Get the table that has the focus.
	 */
	getActiveTable(): Table<any> | undefined;

	/**
	 * Register a query result grid
	 * @param grid The grid to register
	 * @param contextKeyService The context key service to use for the grid. If not provided, the global context key service will be used.
	 */
	registerQueryResultGrid(grid: IQueryResultGrid, contextKeyService?: IContextKeyService): ComponentRegistrationResult;
	/**
	 * Get the grid that has the focus.
	 */
	getActiveQueryResultGrid(): IQueryResultGrid | undefined;
}

enum ComponentType {
	Table = 'Table',
	QueryResultGrid = 'QueryResultGrid'
}

export class ComponentContextService implements IComponentContextService {
	_serviceBrand: undefined;

	private _components: Map<number, { type: ComponentType, component: any }> = new Map<number, { type: ComponentType, component: any }>();
	private _currentId: number = 1;

	constructor(@IContextKeyService private readonly _contextKeyService: IContextKeyService) { }

	public registerTable(table: Table<any>, contextKeyService?: IContextKeyService): ComponentRegistrationResult {
		return this.registerComponent(ComponentType.Table, table, table.grid.getContainerNode(), contextKeyService, (service) => {
			InTableContextKey.bindTo(service).set(true);
			TableFilteringEnabledContextKey.bindTo(service).set(table.grid.getPlugins().find(p => p instanceof HeaderFilter) !== undefined)
		});
	}

	public getActiveTable(): Table<any> | undefined {
		return this.getActiveComponent<Table<any>>(ComponentType.Table, (table) => table.grid.getContainerNode());
	}

	public registerQueryResultGrid(grid: IQueryResultGrid, contextKeyService?: IContextKeyService): ComponentRegistrationResult {
		return this.registerComponent(ComponentType.QueryResultGrid, grid, grid.htmlElement, contextKeyService, (service) => {
			InQueryResultGridContextKey.bindTo(service).set(true);
		});
	}

	public getActiveQueryResultGrid(): IQueryResultGrid | undefined {
		return this.getActiveComponent<IQueryResultGrid>(ComponentType.QueryResultGrid, (grid) => grid.htmlElement);
	}

	private registerComponent(type: ComponentType, component: any, htmlElement: HTMLElement, contextKeyService: IContextKeyService, contextSetter: (contextKeyService: IContextKeyService) => void): ComponentRegistrationResult {
		const parentContextKeyService = contextKeyService ?? this._contextKeyService;
		const id = this._currentId++;
		this._components.set(id, { type, component });
		const service = parentContextKeyService.createScoped(htmlElement);
		contextSetter(service);
		return {
			componentContextKeyService: service,
			dispose: () => {
				this._components.delete(id);
				service.dispose();
			}
		};
	}

	/**
	 * Get the component that has the focus.
	 * @param type type of the component to look for.
	 * @param elementGetter function to get the html element of the component.
	 * @returns the component that has the focus or undefined if no component has the focus.
	 */
	private getActiveComponent<T>(type: ComponentType, elementGetter: (component: T) => HTMLElement): T | undefined {
		for (const item of this._components.values()) {
			if (item.type === type && elementGetter(item.component).contains(document.activeElement)) {
				return item.component;
			}
		}
		return undefined;
	}
}
