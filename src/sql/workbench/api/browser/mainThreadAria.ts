/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlMainContext, MainThreadAriaShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { Disposable } from 'vs/base/common/lifecycle';
import * as aria from 'vs/base/browser/ui/aria/aria';


@extHostNamedCustomer(SqlMainContext.MainThreadAria)
export class MainThreadAria extends Disposable implements MainThreadAriaShape {

	constructor() {
		super();
	}

	$alert(msg: string, disableRepeat?: boolean): void {
		aria.alert(msg, disableRepeat);
	}

	$status(msg: string, disableRepeat?: boolean): void {
		aria.status(msg, disableRepeat);
	}

}
