/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, IConnectionProfile } from 'azdata';
import * as vsEvent from 'vs/base/common/event';
import { INotebookModel, ICellModel, IClientSession, NotebookContentChange, ISingleNotebookEditOperation, MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookFindModel } from 'sql/workbench/contrib/notebook/browser/models/notebookFindModel';
import { NotebookChangeType, CellType } from 'sql/workbench/services/notebook/common/contracts';
import { INotebookManager, INotebookService, INotebookEditor, ILanguageMagic, INotebookProvider, INavigationProvider, INotebookParams, INotebookSection, ICellEditorProvider, NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';
import { IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { IModelDecorationsChangeAccessor } from 'vs/editor/common/model';
import { NotebookFindMatch } from 'sql/workbench/contrib/notebook/browser/find/notebookFindDecorations';
import { RenderMimeRegistry } from 'sql/workbench/services/notebook/browser/outputs/registry';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { URI } from 'vs/base/common/uri';
import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { IContextViewProvider, IDelegate } from 'vs/base/browser/ui/contextview/contextview';

export class NotebookModelStub implements INotebookModel {
	constructor(private _languageInfo?: nb.ILanguageInfo) {
	}
	trustedMode: boolean;
	language: string;
	standardKernels: IStandardKernelWithProvider[];

	get languageInfo(): nb.ILanguageInfo {
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
	get sessionLoadFinished(): Promise<void> {
		throw new Error('method not implemented.');
	}
	get notebookManagers(): INotebookManager[] {
		throw new Error('method not implemented.');
	}
	get kernelChanged(): vsEvent.Event<nb.IKernelChangedArgs> {
		throw new Error('method not implemented.');
	}
	get kernelsChanged(): vsEvent.Event<nb.IKernelSpec> {
		throw new Error('method not implemented.');
	}
	get layoutChanged(): vsEvent.Event<void> {
		throw new Error('method not implemented.');
	}
	get defaultKernel(): nb.IKernelSpec {
		throw new Error('method not implemented.');
	}
	get contextsChanged(): vsEvent.Event<void> {
		throw new Error('method not implemented.');
	}
	get contextsLoading(): vsEvent.Event<void> {
		throw new Error('method not implemented.');
	}
	get contentChanged(): vsEvent.Event<NotebookContentChange> {
		throw new Error('method not implemented.');
	}
	get specs(): nb.IAllKernels {
		throw new Error('method not implemented.');
	}
	get context(): ConnectionProfile {
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
	moveCell(cellModel: ICellModel, direction: MoveDirection): void {
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
	get onValidConnectionSelected(): vsEvent.Event<boolean> {
		throw new Error('method not implemented.');
	}
	get onProviderIdChange(): vsEvent.Event<string> {
		throw new Error('method not implemented.');
	}
	toJSON(): nb.INotebookContents {
		throw new Error('Method not implemented.');
	}
	serializationStateChanged(changeType: NotebookChangeType, cell?: ICellModel): void {
		throw new Error('Method not implemented.');
	}
	get onActiveCellChanged(): vsEvent.Event<ICellModel> {
		throw new Error('Method not implemented.');
	}
	get onCellTypeChanged(): vsEvent.Event<ICellModel> {
		throw new Error('method not implemented.');
	}
	updateActiveCell(cell: ICellModel) {
		throw new Error('Method not implemented.');
	}
	requestConnection(): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
}

export class NotebookFindModelStub implements INotebookFindModel {
	getFindCount(): number {
		throw new Error('Method not implemented.');
	}
	getFindIndex(): number {
		throw new Error('Method not implemented.');
	}
	findNext(): Promise<NotebookRange> {
		throw new Error('Method not implemented.');
	}
	findPrevious(): Promise<NotebookRange> {
		throw new Error('Method not implemented.');
	}
	find(exp: string, matchCase?: boolean, wholeWord?: boolean, maxMatches?: number): Promise<NotebookRange> {
		throw new Error('Method not implemented.');
	}
	clearFind(): void {
		throw new Error('Method not implemented.');
	}
	findArray: NotebookRange[];
	getDecorationRange(id: string): NotebookRange {
		throw new Error('Method not implemented.');
	}
	changeDecorations<T>(callback: (changeAccessor: IModelDecorationsChangeAccessor) => T, ownerId: number): T {
		throw new Error('Method not implemented.');
	}
	getLineMaxColumn(lineNumber: number): number {
		throw new Error('Method not implemented.');
	}
	getLineCount(): number {
		throw new Error('Method not implemented.');
	}
	findMatches: NotebookFindMatch[];
	findExpression: string;
	onFindCountChange: vsEvent.Event<number>;
	getIndexByRange(range: NotebookRange): number {
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
	onServerStartedEmitter = new vsEvent.Emitter<void>();
	onServerStarted: vsEvent.Event<void> = this.onServerStartedEmitter.event;
	isStarted: boolean = false;
	calledStart: boolean = false;
	calledEnd: boolean = false;
	result: Promise<void> = undefined;

	startServer(kernelSpec: nb.IKernelSpec): Promise<void> {
		this.calledStart = true;
		return this.result;
	}
	stopServer(): Promise<void> {
		this.calledEnd = true;
		return this.result;
	}
}

export class NotebookServiceStub implements INotebookService {
	_serviceBrand: undefined;
	get onNotebookEditorAdd(): vsEvent.Event<INotebookEditor> {
		throw new Error('Method not implemented.');
	}
	get onNotebookEditorRemove(): vsEvent.Event<INotebookEditor> {
		throw new Error('Method not implemented.');
	}
	get onNotebookEditorRename(): vsEvent.Event<INotebookEditor> {
		throw new Error('Method not implemented.');
	}
	get isRegistrationComplete(): boolean {
		throw new Error('Method not implemented.');
	}
	get registrationComplete(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	get languageMagics(): ILanguageMagic[] {
		throw new Error('Method not implemented.');
	}
	setTrusted(notebookUri: URI, isTrusted: boolean): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	registerProvider(providerId: string, provider: INotebookProvider): void {
		throw new Error('Method not implemented.');
	}
	unregisterProvider(providerId: string): void {
		throw new Error('Method not implemented.');
	}
	registerNavigationProvider(provider: INavigationProvider): void {
		throw new Error('Method not implemented.');
	}
	getNavigationProvider(notebookUri: URI): INavigationProvider {
		throw new Error('Method not implemented.');
	}
	getSupportedFileExtensions(): string[] {
		throw new Error('Method not implemented.');
	}
	getProvidersForFileType(fileType: string): string[] {
		return [];
	}
	getStandardKernelsForProvider(provider: string): nb.IStandardKernel[] {
		throw new Error('Method not implemented.');
	}
	getOrCreateNotebookManager(providerId: string, uri: URI): Thenable<INotebookManager> {
		throw new Error('Method not implemented.');
	}
	addNotebookEditor(editor: INotebookEditor): void {
		throw new Error('Method not implemented.');
	}
	removeNotebookEditor(editor: INotebookEditor): void {
		throw new Error('Method not implemented.');
	}
	listNotebookEditors(): INotebookEditor[] {
		throw new Error('Method not implemented.');
	}
	findNotebookEditor(notebookUri: URI): INotebookEditor {
		throw new Error('Method not implemented.');
	}
	getMimeRegistry(): RenderMimeRegistry {
		throw new Error('Method not implemented.');
	}
	renameNotebookEditor(oldUri: URI, newUri: URI, currentEditor: INotebookEditor): void {
		throw new Error('Method not implemented.');
	}
	isNotebookTrustCached(notebookUri: URI, isDirty: boolean): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	serializeNotebookStateChange(notebookUri: URI, changeType: NotebookChangeType, cell?: ICellModel, isTrusted?: boolean): Promise<void> {
		throw new Error('Method not implemented.');
	}
	navigateTo(notebookUri: URI, sectionId: string): void {
		throw new Error('Method not implemented.');
	}
}

export class ClientSessionStub implements IClientSession {
	initialize(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	changeKernel(options: nb.IKernelSpec, oldKernel?: nb.IKernel): Promise<nb.IKernel> {
		throw new Error('Method not implemented.');
	}
	configureKernel(options: nb.IKernelSpec): Promise<void> {
		throw new Error('Method not implemented.');
	}
	shutdown(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	selectKernel(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	restart(): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	setPath(path: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	setName(name: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	setType(type: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	updateConnection(connection: IConnectionProfile): Promise<void> {
		throw new Error('Method not implemented.');
	}
	onKernelChanging(changeHandler: (kernel: nb.IKernelChangedArgs) => Promise<void>): void {
		throw new Error('Method not implemented.');
	}
	dispose(): void {
		throw new Error('Method not implemented.');
	}
	get terminated(): vsEvent.Event<void> {
		throw new Error('Method not implemented.');
	}
	get kernelChanged(): vsEvent.Event<nb.IKernelChangedArgs> {
		throw new Error('Method not implemented.');
	}
	get statusChanged(): vsEvent.Event<nb.ISession> {
		throw new Error('Method not implemented.');
	}
	get iopubMessage(): vsEvent.Event<nb.IMessage> {
		throw new Error('Method not implemented.');
	}
	get unhandledMessage(): vsEvent.Event<nb.IMessage> {
		throw new Error('Method not implemented.');
	}
	get propertyChanged(): vsEvent.Event<'path' | 'name' | 'type'> {
		throw new Error('Method not implemented.');
	}
	get kernel(): nb.IKernel | null {
		throw new Error('Method not implemented.');
	}
	get notebookUri(): URI {
		throw new Error('Method not implemented.');
	}
	get name(): string {
		throw new Error('Method not implemented.');
	}
	get type(): string {
		throw new Error('Method not implemented.');
	}
	get status(): nb.KernelStatus {
		throw new Error('Method not implemented.');
	}
	get isReady(): boolean {
		throw new Error('Method not implemented.');
	}
	get ready(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	get kernelChangeCompleted(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	get kernelDisplayName(): string {
		throw new Error('Method not implemented.');
	}
	get errorMessage(): string {
		throw new Error('Method not implemented.');
	}
	get isInErrorState(): boolean {
		throw new Error('Method not implemented.');
	}
	get cachedKernelSpec(): nb.IKernelSpec {
		throw new Error('Method not implemented.');
	}
}

export class KernelStub implements nb.IKernel {
	get id(): string {
		throw new Error('Method not implemented.');
	}
	get name(): string {
		throw new Error('Method not implemented.');
	}
	get supportsIntellisense(): boolean {
		throw new Error('Method not implemented.');
	}
	get requiresConnection(): boolean {
		throw new Error('Method not implemented.');
	}
	get isReady(): boolean {
		throw new Error('Method not implemented.');
	}
	get ready(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	get info(): nb.IInfoReply {
		throw new Error('Method not implemented.');
	}
	getSpec(): Thenable<nb.IKernelSpec> {
		throw new Error('Method not implemented.');
	}
	requestExecute(content: nb.IExecuteRequest, disposeOnDone?: boolean): nb.IFuture {
		throw new Error('Method not implemented.');
	}
	requestComplete(content: nb.ICompleteRequest): Thenable<nb.ICompleteReplyMsg> {
		throw new Error('Method not implemented.');
	}
	interrupt(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}

export class FutureStub implements nb.IFuture {
	constructor(private _msg: nb.IMessage, private _done: Thenable<nb.IShellMessage>) {
	}
	get msg(): nb.IMessage {
		return this._msg;
	}
	get done(): Thenable<nb.IShellMessage> {
		return this._done;
	}
	setReplyHandler(handler: nb.MessageHandler<nb.IShellMessage>): void {
		return;
	}
	setStdInHandler(handler: nb.MessageHandler<nb.IStdinMessage>): void {
		return;
	}
	setIOPubHandler(handler: nb.MessageHandler<nb.IIOPubMessage>): void {
		return;
	}
	registerMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		return;
	}
	removeMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		return;
	}
	sendInputReply(content: nb.IInputReply): void {
		return;
	}
	dispose() {
		return;
	}
}

export class NotebookComponentStub implements INotebookEditor {
	cellEditors: ICellEditorProvider[];
	deltaDecorations(newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange): void {
		throw new Error('Method not implemented.');
	}
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

export class NodeStub implements Node {
	get baseURI(): string {
		throw new Error('Method not implemented.');
	}
	get childNodes(): NodeListOf<ChildNode> {
		throw new Error('Method not implemented.');
	}
	get firstChild(): ChildNode {
		throw new Error('Method not implemented.');
	}
	get isConnected(): boolean {
		throw new Error('Method not implemented.');
	}
	get lastChild(): ChildNode {
		throw new Error('Method not implemented.');
	}
	get namespaceURI(): string {
		throw new Error('Method not implemented.');
	}
	get nextSibling(): ChildNode {
		throw new Error('Method not implemented.');
	}
	get nodeName(): string {
		throw new Error('Method not implemented.');
	}
	get nodeType(): number {
		throw new Error('Method not implemented.');
	}
	get ownerDocument(): Document {
		throw new Error('Method not implemented.');
	}
	get parentElement(): HTMLElement {
		throw new Error('Method not implemented.');
	}
	get parentNode(): Node & ParentNode {
		throw new Error('Method not implemented.');
	}
	get previousSibling(): ChildNode {
		throw new Error('Method not implemented.');
	}
	nodeValue: string;
	textContent: string;
	appendChild<T extends Node>(newChild: T): T {
		throw new Error('Method not implemented.');
	}
	cloneNode(deep?: boolean): Node {
		throw new Error('Method not implemented.');
	}
	compareDocumentPosition(other: Node): number {
		throw new Error('Method not implemented.');
	}
	contains(other: Node): boolean {
		throw new Error('Method not implemented.');
	}
	getRootNode(options?: GetRootNodeOptions): Node {
		throw new Error('Method not implemented.');
	}
	hasChildNodes(): boolean {
		throw new Error('Method not implemented.');
	}
	insertBefore<T extends Node>(newChild: T, refChild: Node): T {
		throw new Error('Method not implemented.');
	}
	isDefaultNamespace(namespace: string): boolean {
		throw new Error('Method not implemented.');
	}
	isEqualNode(otherNode: Node): boolean {
		throw new Error('Method not implemented.');
	}
	isSameNode(otherNode: Node): boolean {
		throw new Error('Method not implemented.');
	}
	lookupNamespaceURI(prefix: string): string {
		throw new Error('Method not implemented.');
	}
	lookupPrefix(namespace: string): string {
		throw new Error('Method not implemented.');
	}
	normalize(): void {
		throw new Error('Method not implemented.');
	}
	removeChild<T extends Node>(oldChild: T): T {
		throw new Error('Method not implemented.');
	}
	replaceChild<T extends Node>(newChild: Node, oldChild: T): T {
		throw new Error('Method not implemented.');
	}
	get ATTRIBUTE_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get CDATA_SECTION_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get COMMENT_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get DOCUMENT_FRAGMENT_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get DOCUMENT_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get DOCUMENT_POSITION_CONTAINED_BY(): number {
		throw new Error('Method not implemented.');
	}
	get DOCUMENT_POSITION_CONTAINS(): number {
		throw new Error('Method not implemented.');
	}
	get DOCUMENT_POSITION_DISCONNECTED(): number {
		throw new Error('Method not implemented.');
	}
	get DOCUMENT_POSITION_FOLLOWING(): number {
		throw new Error('Method not implemented.');
	}
	get DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC(): number {
		throw new Error('Method not implemented.');
	}
	get DOCUMENT_POSITION_PRECEDING(): number {
		throw new Error('Method not implemented.');
	}
	get DOCUMENT_TYPE_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get ELEMENT_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get ENTITY_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get ENTITY_REFERENCE_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get NOTATION_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get PROCESSING_INSTRUCTION_NODE(): number {
		throw new Error('Method not implemented.');
	}
	get TEXT_NODE(): number {
		throw new Error('Method not implemented.');
	}
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		throw new Error('Method not implemented.');
	}
	dispatchEvent(event: Event): boolean {
		throw new Error('Method not implemented.');
	}
	removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		throw new Error('Method not implemented.');
	}
}

export class NotebookEditorStub implements INotebookEditor {
	notebookParams: INotebookParams;
	id: string;
	cells?: ICellModel[];
	cellEditors: CellEditorProviderStub[];
	modelReady: Promise<INotebookModel>;
	model: INotebookModel;
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
	deltaDecorations(newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange): void {
		throw new Error('Method not implemented.');
	}
	addCell(cellType: CellType, index?: number, event?: UIEvent) {
		throw new Error('Method not implemented.');
	}
}

export class CellEditorProviderStub implements ICellEditorProvider {
	hasEditor(): boolean {
		throw new Error('Method not implemented.');
	}
	cellGuid(): string {
		throw new Error('Method not implemented.');
	}
	getEditor(): QueryTextEditor {
		throw new Error('Method not implemented.');
	}
	deltaDecorations(newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange): void {
		throw new Error('Method not implemented.');
	}
}

export interface IContextViewEmitterArgs {
	delegate: IDelegate,
	container?: HTMLElement
}

export class ContextViewProviderStub implements IContextViewProvider {
	showContextView(delegate: IDelegate, container?: HTMLElement): void {
		throw new Error('Method not implemented.');
	}
	hideContextView(): void {
		throw new Error('Method not implemented.');
	}
	layout(): void {
		throw new Error('Method not implemented.');
	}
}
