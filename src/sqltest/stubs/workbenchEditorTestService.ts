/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { createDecorator, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService, IEditor, IEditorInput, IEditorOptions, ITextEditorOptions, Position, Direction, IResourceInput, IResourceDiffInput, IResourceSideBySideInput }
	from 'vs/platform/editor/common/editor';
import { TPromise } from 'vs/base/common/winjs.base';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { EditorInput, EditorOptions, IFileEditorInput, TextEditorOptions, Extensions, SideBySideEditorInput } from 'vs/workbench/common/editor';
import { ICloseEditorsFilter } from 'vs/workbench/browser/parts/editor/editorPart';

export class WorkbenchEditorTestService implements IWorkbenchEditorService {
	_serviceBrand: ServiceIdentifier<any>;

	/**
	 * Returns the currently active editor or null if none.
	 */
	getActiveEditor(): IEditor {
		return undefined;
	}

	/**
	 * Returns the currently active editor input or null if none.
	 */
	getActiveEditorInput(): IEditorInput {
		return undefined;
	}

	/**
	 * Returns an array of visible editors.
	 */
	getVisibleEditors(): IEditor[] {
		return undefined;
	}

	/**
	 * Returns iff the provided input is currently visible.
	 *
	 * @param includeDiff iff set to true, will also consider diff editors to find out if the provided
	 * input is opened either on the left or right hand side of the diff editor.
	 */
	isVisible(input: IEditorInput, includeDiff: boolean): boolean {
		return undefined;
	}

	protected doOpenEditor(input: IEditorInput, options?: EditorOptions, sideBySide?: boolean): TPromise<IEditor>;
	protected doOpenEditor(input: IEditorInput, options?: EditorOptions, position?: Position): TPromise<IEditor>;
	protected doOpenEditor(input: IEditorInput, options?: EditorOptions, arg3?: any): TPromise<IEditor> {
		return undefined;
	}

	/**
	 * Opens an Editor on the given input with the provided options at the given position. If sideBySide parameter
	 * is provided, causes the editor service to decide in what position to open the input.
	 */
	public openEditor(input: IEditorInput, options?: IEditorOptions, sideBySide?: boolean): TPromise<IEditor>;
	public openEditor(input: IEditorInput, options?: IEditorOptions, position?: Position): TPromise<IEditor>;
	public openEditor(input: IResourceInput | IResourceDiffInput | IResourceSideBySideInput, position?: Position): TPromise<IEditor>;
	public openEditor(input: IResourceInput | IResourceDiffInput | IResourceSideBySideInput, sideBySide?: boolean): TPromise<IEditor>;
	public openEditor(input: any, arg2?: any, arg3?: any): TPromise<IEditor> {
		return undefined;
	}

	public openEditors(editors: { input: IResourceInput | IResourceDiffInput | IResourceSideBySideInput, position: Position }[]): TPromise<IEditor[]>;
	public openEditors(editors: { input: IEditorInput, position: Position, options?: IEditorOptions }[]): TPromise<IEditor[]>;
	public openEditors(editors: any[]): TPromise<IEditor[]> {
		return undefined;
	}

	public replaceEditors(editors: { toReplace: IResourceInput | IResourceDiffInput | IResourceSideBySideInput, replaceWith: IResourceInput | IResourceDiffInput | IResourceSideBySideInput }[], position?: Position): TPromise<BaseEditor[]>;
	public replaceEditors(editors: { toReplace: IEditorInput, replaceWith: IEditorInput, options?: IEditorOptions }[], position?: Position): TPromise<BaseEditor[]>;
	public replaceEditors(editors: any[], position?: Position): TPromise<BaseEditor[]> {
		return undefined;
	}

	/**
	 * Closes the editor at the provided position.
	 */
	closeEditor(position: Position, input: IEditorInput): TPromise<void> {
		return undefined;
	}

	/**
	 * Closes editors of a specific group at the provided position. If the optional editor is provided to exclude, it
	 * will not be closed. The direction can be used in that case to control if all other editors should get closed,
	 * or towards a specific direction.
	 */
	closeEditors(p1?: any, p2?: any, p3?: any): TPromise<void> {
		return undefined;
	}

	/**
	 * Closes all editors across all groups. The optional position allows to keep one group alive.
	 */
	closeAllEditors(except?: Position): TPromise<void> {
		return undefined;
	}

	/**
	 * Allows to resolve an untyped input to a workbench typed instanceof editor input
	 */
	createInput(input: IResourceInput | IResourceDiffInput | IResourceSideBySideInput): IEditorInput {
		return undefined;
	}
}