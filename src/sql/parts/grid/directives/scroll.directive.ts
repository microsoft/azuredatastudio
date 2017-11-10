/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the Source EULA. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { ElementRef, Directive, Input, Output, EventEmitter, forwardRef,
    Inject } from '@angular/core';
import { Observable } from 'rxjs/Observable';

@Directive({
  selector: '[onScroll]'
})
export class ScrollDirective {
    @Input() scrollEnabled: boolean = true;
    @Output('onScroll') onScroll = new EventEmitter();

    constructor(@Inject(forwardRef(() => ElementRef)) private _el: ElementRef) {
        const self = this;
        Observable.fromEvent(this._el.nativeElement, 'scroll').subscribe((event) => {
            if (self.scrollEnabled) {
                self.onScroll.emit(self._el.nativeElement.scrollTop);
            }
        });
    }
}
