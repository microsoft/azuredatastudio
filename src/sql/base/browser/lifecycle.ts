/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';

import { IDisposable, Disposable } from 'vs/base/common/lifecycle';

export function subscriptionToDisposable(sub: Subscription): IDisposable {
	return {
		dispose: () => {
			sub.unsubscribe();
		}
	};
}

export class AngularDisposable extends Disposable implements OnDestroy {
	public isDisposed = false;

	ngOnDestroy() {
		this.dispose();
		this.isDisposed = true;
	}
}
