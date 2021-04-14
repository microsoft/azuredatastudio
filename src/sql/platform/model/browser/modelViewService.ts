/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Event } from 'vs/base/common/event';
import { IComponentEventArgs, ModelComponentTypes } from 'sql/platform/dashboard/browser/interfaces';

export interface IView {
	readonly id: string;
	readonly connection: azdata.connection.Connection;
	readonly serverInfo: azdata.ServerInfo;
}

export interface IComponentShape {
	type: ModelComponentTypes;
	id: string;
	properties?: { [key: string]: any };
	layout?: any;
	itemConfigs?: IItemConfig[];
}

export interface IItemConfig {
	componentShape: IComponentShape;
	config: any;
}

export interface IModelViewEventArgs extends IComponentEventArgs {
	isRootComponent: boolean;
}

export interface IModelView extends IView {
	initializeModel(rootComponent: IComponentShape, validationCallback?: (componentId: string) => Thenable<boolean>): void;
	clearContainer(componentId: string): void;
	/**
	 * Adds the specified items as children of the specified parent container
	 * @param containerId The ID of the container component to add the items to
	 * @param items The list of items to add to the container
	 */
	addToContainer(containerId: string, items: { itemConfig: IItemConfig, index?: number }[]): void;
	removeFromContainer(containerId: string, item: IItemConfig): void;
	setLayout(componentId: string, layout: any, initial?: boolean): void;
	setItemLayout(componentId: string, item: IItemConfig): void;
	setProperties(componentId: string, properties: { [key: string]: any }, initial?: boolean): void;
	setDataProvider(handle: number, componentId: string, context: any): void;
	refreshDataProvider(componentId: string, item: any): void;
	registerEvent(componentId: string, initial?: boolean): void;
	onEvent: Event<IModelViewEventArgs>;
	validate(componentId: string): Promise<boolean>;
	readonly onDestroy: Event<void>;
	focus(componentId: string): void;
	doAction(componentId: string, action: string, ...args: any[]): void;
}
