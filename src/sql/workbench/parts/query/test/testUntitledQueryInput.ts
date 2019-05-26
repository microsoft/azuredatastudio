/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UntitledQueryEditorInput } from 'sql/workbench/parts/query/common/untitledQueryEditorInput';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { EncodingMode, ConfirmResult } from 'vs/workbench/common/editor';
import { Event } from 'vs/base/common/event';
import { QueryEditorState } from 'sql/workbench/parts/query/common/queryEditorInput';
import { QueryResultsInput } from 'sql/workbench/parts/query/common/queryResultsInput';
import { URI } from 'vs/base/common/uri';
import { INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { ISelectionData, ExecutionPlanOptions } from 'azdata';

type PublicPart<T> = { [K in keyof T]: T[K] };

export class TestUntitledQueryEditorInput implements PublicPart<UntitledQueryEditorInput> {

	public get onDidModelChangeContent(): Event<void> {
		throw new Error('Method not implemented');
	}

	public get onDidModelChangeEncoding(): Event<void> {
		throw new Error('Method not implemented');
	}

	public get state(): QueryEditorState {
		throw new Error('Method not implemented');
	}

	public get onDidChangeDirty(): Event<void> {
		throw new Error('Method not implemented');
	}

	public get onDidChangeLabel(): Event<void> {
		throw new Error('Method not implemented');
	}

	public get onDispose(): Event<void> {
		throw new Error('Method not implemented');
	}

	public getPreferredEditorId(candidates: string[]): string | null {
		throw new Error('Method not implemented');
	}

	public getTelemetryDescriptor(): { [key: string]: unknown } {
		throw new Error('Method not implemented');
	}

	public isDisposed(): boolean {
		throw new Error('Method not implemented');
	}

	// Getters for private properties
	public get uri(): string {
		throw new Error('Method not implemented');
	}

	public get results(): QueryResultsInput {
		throw new Error('Method not implemented');
	}
	// Description is shown beside the tab name in the combobox of open editors
	public getDescription(): string {
		throw new Error('Method not implemented');

	}

	public supportsSplitEditor(): boolean {
		throw new Error('Method not implemented');
	}

	public revert(): Promise<boolean> {
		throw new Error('Method not implemented');
	}

	public matches(otherInput: any): boolean {
		throw new Error('Method not implemented');
	}

	// Forwarding resource functions to the inline sql file editor
	public save(): Promise<boolean> {
		throw new Error('Method not implemented');
	}

	public isDirty(): boolean {
		throw new Error('Method not implemented');
	}

	public confirmSave(): Promise<ConfirmResult> {
		throw new Error('Method not implemented');
	}

	public getResource(): URI {
		throw new Error('Method not implemented');
	}

	public getName(longForm?: boolean): string {
		throw new Error('Method not implemented');
	}

	public getTitle(): string {
		throw new Error('Method not implemented');
	}

	public runQuery(selection: ISelectionData, executePlanOptions?: ExecutionPlanOptions): void {
		throw new Error('Method not implemented');
	}

	public runQueryStatement(selection: ISelectionData): void {
		throw new Error('Method not implemented');
	}

	public runQueryString(text: string): void {
		throw new Error('Method not implemented');
	}

	public onConnectStart(): void {
		throw new Error('Method not implemented');
	}

	public onConnectReject(): void {
		throw new Error('Method not implemented');
	}

	public onConnectCanceled(): void {
		throw new Error('Method not implemented');
	}

	public onConnectSuccess(params?: INewConnectionParams): void {
		throw new Error('Method not implemented');
	}

	public onDisconnect(): void {
		this.state.connected = false;
	}

	public onRunQuery(): void {
		this.state.executing = true;
		this.state.resultsVisible = true;
	}

	public onQueryComplete(): void {
		this.state.executing = false;
	}

	public dispose(): void {
		throw new Error('Method not implemented');
	}

	public close(): void {
		throw new Error('Method not implemented');
	}

	public get tabColor(): string {
		throw new Error('Method not implemented');
	}

	public resolve(): Promise<UntitledEditorModel & IResolvedTextEditorModel> {
		return this.text.resolve();
	}

	public get text(): UntitledEditorInput {
		throw new Error('Method not implemented');
	}

	public get hasAssociatedFilePath(): boolean {
		throw new Error('Method not implemented');
	}

	public suggestFileName(): string {
		throw new Error('Method not implemented');
	}

	public setMode(mode: string): void {
		throw new Error('Method not implemented');
	}

	public getMode(): string {
		throw new Error('Method not implemented');
	}

	public getTypeId(): string {
		throw new Error('Method not implemented');
	}

	public getEncoding(): string {
		throw new Error('Method not implemented');
	}

	public setEncoding(encoding: string, mode: EncodingMode): void {
		throw new Error('Method not implemented');
	}
}
