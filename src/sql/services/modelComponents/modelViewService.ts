/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';

import * as sqlops from 'sqlops';
import { IItemConfig, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IView, IModelView } from 'sql/services/model/modelViewService';

export const SERVICE_ID = 'modelViewService';

export interface IModelViewService {
	_serviceBrand: any;
	onRegisteredModelView: Event<IModelView>;
	registerModelView(widget: IModelView);
}

export const IModelViewService = createDecorator<IModelViewService>(SERVICE_ID);