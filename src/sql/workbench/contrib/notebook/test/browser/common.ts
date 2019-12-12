/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookEditor, INotebookSection, INotebookParams } from 'sql/workbench/services/notebook/browser/notebookService';
import { ICellModel, INotebookModel } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { CellType } from 'sql/workbench/contrib/notebook/common/models/contracts';

export class NotebookComponentStub implements INotebookEditor {
	get notebookParams(): INotebookParams {
		throw new Error('Method not implemented.');
	}
	get id(): string {
		throw new Error('Method not implemented.');
	}
	get cells(): ICellModel[] {
		throw new Error('Method not implemented.');
	}
	get modelReady(): Promise<INotebookModel> {
		throw new Error('Method not implemented.');
	}
	get model(): INotebookModel {
		throw new Error('Method not implemented.');
	}
	isDirty(): boolean {
		throw new Error('Method not implemented.');
	}
	isActive(): boolean {
		throw new Error('Method not implemented.');
	}
	isVisible(): boolean {
		throw new Error('Method not implemented.');
	}
	executeEdits(edits: ISingleNotebookEditOperation[]): boolean {
		throw new Error('Method not implemented.');
	}
	runCell(cell: ICellModel): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	runAllCells(startCell?: ICellModel, endCell?: ICellModel): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	clearOutput(cell: ICellModel): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	clearAllOutputs(): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	getSections(): INotebookSection[] {
		throw new Error('Method not implemented.');
	}
	navigateToSection(sectionId: string): void {
		throw new Error('Method not implemented.');
	}
	addCell(cellType: CellType, index?: number, event?: Event) {
		throw new Error('Method not implemented.');
	}
}
