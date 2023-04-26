/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IEditorMouseEvent, IMouseTarget, IPartialEditorMouseEvent } from 'vs/editor/browser/editorBrowser';
import { ICoordinatesConverter } from 'vs/editor/common/viewModel';
import { IMouseWheelEvent } from 'vs/base/browser/mouseEvent';

export interface EventCallback<T> {
	(event: T): void;
}

export class ViewUserInputEvents {

	public onKeyDown: EventCallback<IKeyboardEvent> | null = null;
	public onKeyUp: EventCallback<IKeyboardEvent> | null = null;
	public onContextMenu: EventCallback<IEditorMouseEvent> | null = null;
	public onMouseMove: EventCallback<IEditorMouseEvent> | null = null;
	public onMouseLeave: EventCallback<IPartialEditorMouseEvent> | null = null;
	public onMouseDown: EventCallback<IEditorMouseEvent> | null = null;
	public onMouseUp: EventCallback<IEditorMouseEvent> | null = null;
	public onMouseDrag: EventCallback<IEditorMouseEvent> | null = null;
	public onMouseDrop: EventCallback<IPartialEditorMouseEvent> | null = null;
	public onMouseDropCanceled: EventCallback<void> | null = null;
	public onMouseWheel: EventCallback<IMouseWheelEvent> | null = null;

	private readonly _coordinatesConverter: ICoordinatesConverter;

	constructor(coordinatesConverter: ICoordinatesConverter) {
		this._coordinatesConverter = coordinatesConverter;
	}

	public emitKeyDown(e: IKeyboardEvent): void {
		this.onKeyDown?.(e);
	}

	public emitKeyUp(e: IKeyboardEvent): void {
		this.onKeyUp?.(e);
	}

	public emitContextMenu(e: IEditorMouseEvent): void {
		this.onContextMenu?.(this._convertViewToModelMouseEvent(e));
	}

	public emitMouseMove(e: IEditorMouseEvent): void {
		this.onMouseMove?.(this._convertViewToModelMouseEvent(e));
	}

	public emitMouseLeave(e: IPartialEditorMouseEvent): void {
		this.onMouseLeave?.(this._convertViewToModelMouseEvent(e));
	}

	public emitMouseDown(e: IEditorMouseEvent): void {
		this.onMouseDown?.(this._convertViewToModelMouseEvent(e));
	}

	public emitMouseUp(e: IEditorMouseEvent): void {
		this.onMouseUp?.(this._convertViewToModelMouseEvent(e));
	}

	public emitMouseDrag(e: IEditorMouseEvent): void {
		this.onMouseDrag?.(this._convertViewToModelMouseEvent(e));
	}

	public emitMouseDrop(e: IPartialEditorMouseEvent): void {
		this.onMouseDrop?.(this._convertViewToModelMouseEvent(e));
	}

	public emitMouseDropCanceled(): void {
		this.onMouseDropCanceled?.();
	}

	public emitMouseWheel(e: IMouseWheelEvent): void {
		this.onMouseWheel?.(e);
	}

	private _convertViewToModelMouseEvent(e: IEditorMouseEvent): IEditorMouseEvent;
	private _convertViewToModelMouseEvent(e: IPartialEditorMouseEvent): IPartialEditorMouseEvent;
	private _convertViewToModelMouseEvent(e: IEditorMouseEvent | IPartialEditorMouseEvent): IEditorMouseEvent | IPartialEditorMouseEvent {
		if (e.target) {
			return {
				event: e.event,
				target: this._convertViewToModelMouseTarget(e.target)
			};
		}
		return e;
	}

	private _convertViewToModelMouseTarget(target: IMouseTarget): IMouseTarget {
		return ViewUserInputEvents.convertViewToModelMouseTarget(target, this._coordinatesConverter);
	}

	public static convertViewToModelMouseTarget(target: IMouseTarget, coordinatesConverter: ICoordinatesConverter): IMouseTarget {
		const result = { ...target };
		if (result.position) {
			result.position = coordinatesConverter.convertViewPositionToModelPosition(result.position);
		}
		if (result.range) {
			result.range = coordinatesConverter.convertViewRangeToModelRange(result.range);
		}
		return result;
	}
}
