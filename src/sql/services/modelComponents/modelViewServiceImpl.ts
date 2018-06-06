/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IModelViewService } from 'sql/services/modelComponents/modelViewService';
import { Event, Emitter } from 'vs/base/common/event';
import { IModelView } from 'sql/services/model/modelViewService';

export class ModelViewService implements IModelViewService {
	_serviceBrand: any;

	private _onRegisteredModelView = new Emitter<IModelView>();
	public readonly onRegisteredModelView: Event<IModelView> = this._onRegisteredModelView.event;

	public registerModelView(view: IModelView) {
		this._onRegisteredModelView.fire(view);
	}
}
