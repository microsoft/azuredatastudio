/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';

import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';

import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';

export class GlobalNewProfilerAction extends Action {
	public static ID = 'explorer.newProfiler';
	public static LABEL = nls.localize('profilerWorkbenchAction.newProfiler', "New Profiler");

	constructor(
		id: string, label: string,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {
		super(id, label);
	}

	run(context?: any): TPromise<boolean> {
		// TODO: for test-only, grab the first MSSQL active connection for the profiler session
		// TODO: when finishing the feature the connection should come from the launch context
		let connectionProfile: IConnectionProfile;
		if (context && context.connectionProfile) {
			connectionProfile = context.connectionProfile;
		} else {
			let activeConnections = this._connectionService.getActiveConnections();
			if (activeConnections) {
				for (let i = 0; i < activeConnections.length; ++i) {
					if (activeConnections[i].providerName === 'MSSQL') {
						connectionProfile = activeConnections[i];
						break;
					}
				}
			}
		}

		let profilerInput = this._instantiationService.createInstance(ProfilerInput, connectionProfile);
		return this._editorService.openEditor(profilerInput, { pinned: true }, false).then(() => TPromise.as(true));
	}
}
