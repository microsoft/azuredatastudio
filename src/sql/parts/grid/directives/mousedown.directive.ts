/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the Source EULA. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { ElementRef, Directive, Inject, Output, EventEmitter, forwardRef } from '@angular/core';

@Directive({
  selector: '[mousedown]'
})
export class MouseDownDirective {
    @Output('mousedown') onMouseDown = new EventEmitter();

    constructor(@Inject(forwardRef(() => ElementRef)) private _el: ElementRef) {
        const self = this;
        setTimeout(() => {
            let $gridCanvas = $(this._el.nativeElement).find('.grid-canvas');
            $gridCanvas.on('mousedown', () => {
                self.onMouseDown.emit();
            });
            let jQueryCast: any = $;
            let mouseDownFuncs: any[] = jQueryCast._data($gridCanvas[0], 'events')['mousedown'];
            // reverse the event array so that our event fires first.
            mouseDownFuncs.reverse();
        });
    }
}
