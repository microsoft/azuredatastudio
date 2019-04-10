/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnDestroy } from '@angular/core';
import { AngularDisposable } from 'sql/base/node/lifecycle';

export abstract class CellView extends AngularDisposable implements OnDestroy {
	constructor() {
		super();
	}

	public abstract layout(): void;
}


