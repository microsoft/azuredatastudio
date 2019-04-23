/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Directive, ViewContainerRef, Inject, forwardRef } from '@angular/core';

@Directive({
	selector: '[component-host]',
})
export class ComponentHostDirective {
	constructor(@Inject(forwardRef(() => ViewContainerRef)) public viewContainerRef: ViewContainerRef) { }
}
