/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';

import { SqlMainContext, MainThreadAriaShape, ExtHostAriaShape } from 'sql/workbench/api/common/sqlExtHost.protocol';

export class ExtHostAria implements ExtHostAriaShape {

	private readonly _proxy: MainThreadAriaShape;

	constructor(_mainContext: IMainContext) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadAria);
	}

	$alert(msg: string, disableRepeat?: boolean): void {
		this._proxy.$alert(msg, disableRepeat);
	}

	$status(msg: string, disableRepeat?: boolean): void {
		this._proxy.$status(msg, disableRepeat);
	}

}

