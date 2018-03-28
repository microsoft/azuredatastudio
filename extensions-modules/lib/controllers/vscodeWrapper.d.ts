import vscode = require('vscode');
import { IExtensionConstants } from '../models/contracts/contracts';
export declare class VscodeWrapper {
    private _extensionConstants;
    /**
     * Output channel for logging. Shared among all instances.
     */
    private static _outputChannel;
    /**
     * Default constructor.
     */
    constructor(constants: IExtensionConstants);
    /**
     * Get the current active text editor
     */
    readonly activeTextEditor: vscode.TextEditor;
    /**
     * get the current textDocument; any that are open?
     */
    readonly textDocuments: vscode.TextDocument[];
    /**
     * Parse uri
     */
    parseUri(uri: string): vscode.Uri;
    /**
     * Get the URI string for the current active text editor
     */
    readonly activeTextEditorUri: string;
    readonly constants: IExtensionConstants;
    /**
     * Create an output channel in vscode.
     */
    createOutputChannel(channelName: string): vscode.OutputChannel;
    /**
     * Executes the command denoted by the given command identifier.
     *
     * When executing an editor command not all types are allowed to
     * be passed as arguments. Allowed are the primitive types `string`, `boolean`,
     * `number`, `undefined`, and `null`, as well as classes defined in this API.
     * There are no restrictions when executing commands that have been contributed
     * by extensions.
     *
     * @param command Identifier of the command to execute.
     * @param rest Parameters passed to the command function.
     * @return A thenable that resolves to the returned value of the given command. `undefined` when
     * the command handler function doesn't return anything.
     * @see vscode.commands.executeCommand
     */
    executeCommand<T>(command: string, ...rest: any[]): Thenable<T>;
    /**
     * Get the configuration for a extensionName; NOT YET IMPLEMENTED
     * @param extensionName The string name of the extension to get the configuration for
     */
    getConfiguration(extensionName: string): vscode.WorkspaceConfiguration;
    /**
     * @return 'true' if the active editor window has a .sql file, false otherwise
     */
    readonly isEditingSqlFile: boolean;
    /**
     * An event that is emitted when a [text document](#TextDocument) is disposed.
     */
    readonly onDidCloseTextDocument: vscode.Event<vscode.TextDocument>;
    /**
     * An event that is emitted when a [text document](#TextDocument) is opened.
     */
    readonly onDidOpenTextDocument: vscode.Event<vscode.TextDocument>;
    /**
     * An event that is emitted when a [text document](#TextDocument) is saved to disk.
     */
    readonly onDidSaveTextDocument: vscode.Event<vscode.TextDocument>;
    /**
     * Opens the denoted document from disk. Will return early if the
     * document is already open, otherwise the document is loaded and the
     * [open document](#workspace.onDidOpenTextDocument)-event fires.
     * The document to open is denoted by the [uri](#Uri). Two schemes are supported:
     *
     * file: A file on disk, will be rejected if the file does not exist or cannot be loaded, e.g. `file:///Users/frodo/r.ini`.
     * untitled: A new file that should be saved on disk, e.g. `untitled:c:\frodo\new.js`. The language will be derived from the file name.
     *
     * Uris with other schemes will make this method return a rejected promise.
     *
     * @param uri Identifies the resource to open.
     * @return A promise that resolves to a [document](#TextDocument).
     * @see vscode.workspace.openTextDocument
     */
    openTextDocument(uri: vscode.Uri): Thenable<vscode.TextDocument>;
    /**
     * Helper to log messages to output channel.
     */
    logToOutputChannel(msg: any): void;
    /**
     * Create a vscode.Range object
     * @param start The start position for the range
     * @param end The end position for the range
     */
    range(start: vscode.Position, end: vscode.Position): vscode.Range;
    /**
     * Create a vscode.Position object
     * @param line The line for the position
     * @param column The column for the position
     */
    position(line: number, column: number): vscode.Position;
    /**
     * Create a vscode.Selection object
     * @param start The start postion of the selection
     * @param end The end position of the selection
     */
    selection(start: vscode.Position, end: vscode.Position): vscode.Selection;
    /**
     * Formats and shows a vscode error message
     */
    showErrorMessage(msg: string, ...items: string[]): Thenable<string>;
    /**
     * Formats and shows a vscode information message
     */
    showInformationMessage(msg: string, ...items: string[]): Thenable<string>;
    /**
     * Shows a selection list.
     *
     * @param items An array of items, or a promise that resolves to an array of items.
     * @param options Configures the behavior of the selection list.
     * @return A promise that resolves to the selected item or undefined.
     */
    showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, options?: vscode.QuickPickOptions): Thenable<T>;
    /**
     * Show the given document in a text editor. A [column](#ViewColumn) can be provided
     * to control where the editor is being shown. Might change the [active editor](#window.activeTextEditor).
     *
     * @param document A text document to be shown.
     * @param column A view column in which the editor should be shown. The default is the [one](#ViewColumn.One), other values
     * are adjusted to be __Min(column, columnCount + 1)__.
     * @param preserveFocus When `true` the editor will not take focus.
     * @return A promise that resolves to an [editor](#TextEditor).
     */
    showTextDocument(document: vscode.TextDocument, column?: vscode.ViewColumn, preserveFocus?: boolean): Thenable<vscode.TextEditor>;
    /**
     * Formats and shows a vscode warning message
     */
    showWarningMessage(msg: string): Thenable<string>;
    /**
     * Returns a array of the text editors currently visible in the window
     */
    readonly visibleEditors: vscode.TextEditor[];
    /**
     * Create an URI from a file system path. The [scheme](#Uri.scheme)
     * will be `file`.
     *
     * @param path A file system or UNC path.
     * @return A new Uri instance.
     * @see vscode.Uri.file
     */
    uriFile(path: string): vscode.Uri;
    /**
     * Create an URI from a string. Will throw if the given value is not
     * valid.
     *
     * @param value The string value of an Uri.
     * @return A new Uri instance.
     * @see vscode.Uri.parse
     */
    uriParse(value: string): vscode.Uri;
    /**
     * The folder that is open in VS Code. `undefined` when no folder
     * has been opened.
     *
     * @readonly
     * @see vscode.workspace.rootPath
     */
    readonly workspaceRootPath: string;
}
