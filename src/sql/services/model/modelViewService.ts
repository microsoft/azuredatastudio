/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import { IItemConfig, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';
import Event, { Emitter } from 'vs/base/common/event';

export interface IView {
	readonly id: string;
	readonly connection: sqlops.connection.Connection;
	readonly serverInfo: sqlops.ServerInfo;
}

export interface IModelView extends IView {
	initializeModel(rootComponent: IComponentShape, validationCallback?: (componentId: string) => Thenable<boolean>): void;
	clearContainer(componentId: string): void;
	addToContainer(containerId: string, item: IItemConfig): void;
	setLayout(componentId: string, layout: any): void;
	setProperties(componentId: string, properties: { [key: string]: any }): void;
	registerEvent(componentId: string);
	onEvent: Event<any>;
	validate(componentId: string): Thenable<boolean>;
	readonly onDestroy: Event<void>;
}
