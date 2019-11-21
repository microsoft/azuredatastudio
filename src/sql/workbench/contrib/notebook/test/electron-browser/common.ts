/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, IConnectionProfile } from 'azdata';

import { Event, Emitter } from 'vs/base/common/event';
import { INotebookModel, ICellModel, IClientSession, IDefaultConnection, NotebookContentChange, NotebookRange, NotebookFindMatch } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { NotebookChangeType, CellType } from 'sql/workbench/contrib/notebook/common/models/contracts';
import { INotebookManager } from 'sql/workbench/services/notebook/browser/notebookService';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IStandardKernelWithProvider } from 'sql/workbench/contrib/notebook/browser/models/notebookUtils';
import { IModelDecorationsChangeAccessor } from 'vs/editor/common/model';

export class NotebookModelStub implements INotebookModel {
	constructor(private _languageInfo?: nb.ILanguageInfo) {
	}
	public trustedMode: boolean;
	language: string;
	standardKernels: IStandardKernelWithProvider[];

	public get languageInfo(): nb.ILanguageInfo {
		return this._languageInfo;
	}
	onCellChange(cell: ICellModel, change: NotebookChangeType): void {
		// Default: do nothing
	}
	get cells(): ReadonlyArray<ICellModel> {
		throw new Error('method not implemented.');
	}
	get activeCell(): ICellModel {
		throw new Error('method not implemented.');
	}
	get clientSession(): IClientSession {
		throw new Error('method not implemented.');
	}
	get notebookManagers(): INotebookManager[] {
		throw new Error('method not implemented.');
	}
	get kernelChanged(): Event<nb.IKernelChangedArgs> {
		throw new Error('method not implemented.');
	}
	get kernelsChanged(): Event<nb.IKernelSpec> {
		throw new Error('method not implemented.');
	}
	get layoutChanged(): Event<void> {
		throw new Error('method not implemented.');
	}
	get defaultKernel(): nb.IKernelSpec {
		throw new Error('method not implemented.');
	}
	get contextsChanged(): Event<void> {
		throw new Error('method not implemented.');
	}
	get contextsLoading(): Event<void> {
		throw new Error('method not implemented.');
	}
	get contentChanged(): Event<NotebookContentChange> {
		throw new Error('method not implemented.');
	}
	get specs(): nb.IAllKernels {
		throw new Error('method not implemented.');
	}
	get contexts(): IDefaultConnection {
		throw new Error('method not implemented.');
	}
	get providerId(): string {
		throw new Error('method not implemented.');
	}
	get applicableConnectionProviderIds(): string[] {
		throw new Error('method not implemented.');
	}
	getStandardKernelFromName(name: string): IStandardKernelWithProvider {
		throw new Error('Method not implemented.');
	}
	changeKernel(displayName: string): void {
		throw new Error('Method not implemented.');
	}
	changeContext(host: string, connection?: IConnectionProfile, hideErrorMessage?: boolean): Promise<void> {
		throw new Error('Method not implemented.');
	}
	findCellIndex(cellModel: ICellModel): number {
		throw new Error('Method not implemented.');
	}
	addCell(cellType: CellType, index?: number): void {
		throw new Error('Method not implemented.');
	}
	deleteCell(cellModel: ICellModel): void {
		throw new Error('Method not implemented.');
	}
	pushEditOperations(edits: ISingleNotebookEditOperation[]): void {
		throw new Error('Method not implemented.');
	}
	getApplicableConnectionProviderIds(kernelName: string): string[] {
		throw new Error('Method not implemented.');
	}
	get onValidConnectionSelected(): Event<boolean> {
		throw new Error('method not implemented.');
	}
	get onProviderIdChange(): Event<string> {
		throw new Error('method not impelemented.');
	}
	toJSON(): nb.INotebookContents {
		throw new Error('Method not implemented.');
	}
	serializationStateChanged(changeType: NotebookChangeType): void {
		throw new Error('Method not implemented.');
	}
	findNext(): Thenable<NotebookRange> {
		throw new Error('Method not implemented.');
	}
	findPrevious(): Thenable<NotebookRange> {
		throw new Error('Method not implemented.');
	}
	find(exp: string, maxMatches?: number): Promise<NotebookRange> {
		throw new Error('Method not implemented.');
	}
	clearFind(): void {
		throw new Error('Method not implemented.');
	}
	getFindCount(): number {
		throw new Error('Method not implemented.');
	}
	getFindIndex(): number {
		throw new Error('Method not implemented.');
	}
	getDecorationRange(id: string): NotebookRange | null {
		throw new Error('Method not implemented.');
	}
	changeDecorations<T>(callback: (changeAccessor: IModelDecorationsChangeAccessor) => T, ownerId: number): T | null {
		throw new Error('Method not implemented.');
	}
	getLineMaxColumn(lineNumber: number): number {
		throw new Error('Method not implemented.');
	}
	getLineCount(): number {
		throw new Error('Method not implemented.');
	}
	findMatches: NotebookFindMatch[];
	onFindCountChange: Event<number>;
	findArray: NotebookRange[];
	get onActiveCellChanged(): Event<ICellModel> {
		throw new Error('Method not implemented.');
	}
	updateActiveCell(cell: ICellModel) {
		throw new Error('Method not implemented.');
	}

}

export class NotebookManagerStub implements INotebookManager {
	providerId: string;
	contentManager: nb.ContentManager;
	sessionManager: nb.SessionManager;
	serverManager: nb.ServerManager;
}

export class ServerManagerStub implements nb.ServerManager {
	public onServerStartedEmitter = new Emitter<void>();
	onServerStarted: Event<void> = this.onServerStartedEmitter.event;
	isStarted: boolean = false;
	calledStart: boolean = false;
	calledEnd: boolean = false;
	public result: Promise<void> = undefined;

	startServer(): Promise<void> {
		this.calledStart = true;
		return this.result;
	}
	stopServer(): Promise<void> {
		this.calledEnd = true;
		return this.result;
	}
}
