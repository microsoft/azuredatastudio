"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class VscodeWrapper {
    /**
     * Default constructor.
     */
    constructor(constants) {
        this._extensionConstants = constants;
        if (typeof VscodeWrapper._outputChannel === 'undefined') {
            VscodeWrapper._outputChannel = this.createOutputChannel(this._extensionConstants.outputChannelName);
        }
    }
    /**
     * Get the current active text editor
     */
    get activeTextEditor() {
        return vscode.window.activeTextEditor;
    }
    /**
     * get the current textDocument; any that are open?
     */
    get textDocuments() {
        return vscode.workspace.textDocuments;
    }
    /**
     * Parse uri
     */
    parseUri(uri) {
        return vscode.Uri.parse(uri);
    }
    /**
     * Get the URI string for the current active text editor
     */
    get activeTextEditorUri() {
        if (typeof vscode.window.activeTextEditor !== 'undefined' &&
            typeof vscode.window.activeTextEditor.document !== 'undefined') {
            return vscode.window.activeTextEditor.document.uri.toString();
        }
        return undefined;
    }
    get constants() {
        return this._extensionConstants;
    }
    /**
     * Create an output channel in vscode.
     */
    createOutputChannel(channelName) {
        return vscode.window.createOutputChannel(channelName);
    }
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
    executeCommand(command, ...rest) {
        return vscode.commands.executeCommand(command, ...rest);
    }
    /**
     * Get the configuration for a extensionName; NOT YET IMPLEMENTED
     * @param extensionName The string name of the extension to get the configuration for
     */
    getConfiguration(extensionName) {
        return vscode.workspace.getConfiguration(extensionName);
    }
    /**
     * @return 'true' if the active editor window has a .sql file, false otherwise
     */
    get isEditingSqlFile() {
        let sqlFile = false;
        let editor = this.activeTextEditor;
        if (editor) {
            if (editor.document.languageId === this._extensionConstants.languageId) {
                sqlFile = true;
            }
        }
        return sqlFile;
    }
    /**
     * An event that is emitted when a [text document](#TextDocument) is disposed.
     */
    get onDidCloseTextDocument() {
        return vscode.workspace.onDidCloseTextDocument;
    }
    /**
     * An event that is emitted when a [text document](#TextDocument) is opened.
     */
    get onDidOpenTextDocument() {
        return vscode.workspace.onDidOpenTextDocument;
    }
    /**
     * An event that is emitted when a [text document](#TextDocument) is saved to disk.
     */
    get onDidSaveTextDocument() {
        return vscode.workspace.onDidSaveTextDocument;
    }
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
    openTextDocument(uri) {
        return vscode.workspace.openTextDocument(uri);
    }
    /**
     * Helper to log messages to output channel.
     */
    logToOutputChannel(msg) {
        let date = new Date();
        if (msg instanceof Array) {
            msg.forEach(element => {
                VscodeWrapper._outputChannel.appendLine('[' + date.toLocaleTimeString() + '] ' + element.toString());
            });
        }
        else {
            VscodeWrapper._outputChannel.appendLine('[' + date.toLocaleTimeString() + '] ' + msg.toString());
        }
    }
    /**
     * Create a vscode.Range object
     * @param start The start position for the range
     * @param end The end position for the range
     */
    range(start, end) {
        return new vscode.Range(start, end);
    }
    /**
     * Create a vscode.Position object
     * @param line The line for the position
     * @param column The column for the position
     */
    position(line, column) {
        return new vscode.Position(line, column);
    }
    /**
     * Create a vscode.Selection object
     * @param start The start postion of the selection
     * @param end The end position of the selection
     */
    selection(start, end) {
        return new vscode.Selection(start, end);
    }
    /**
     * Formats and shows a vscode error message
     */
    showErrorMessage(msg, ...items) {
        return vscode.window.showErrorMessage(this._extensionConstants.extensionName + ': ' + msg, ...items);
    }
    /**
     * Formats and shows a vscode information message
     */
    showInformationMessage(msg, ...items) {
        return vscode.window.showInformationMessage(this._extensionConstants.extensionName + ': ' + msg, ...items);
    }
    /**
     * Shows a selection list.
     *
     * @param items An array of items, or a promise that resolves to an array of items.
     * @param options Configures the behavior of the selection list.
     * @return A promise that resolves to the selected item or undefined.
     */
    showQuickPick(items, options) {
        return vscode.window.showQuickPick(items, options);
    }
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
    showTextDocument(document, column, preserveFocus) {
        return vscode.window.showTextDocument(document, column, preserveFocus);
    }
    /**
     * Formats and shows a vscode warning message
     */
    showWarningMessage(msg) {
        return vscode.window.showWarningMessage(this._extensionConstants.extensionName + ': ' + msg);
    }
    /**
     * Returns a array of the text editors currently visible in the window
     */
    get visibleEditors() {
        return vscode.window.visibleTextEditors;
    }
    /**
     * Create an URI from a file system path. The [scheme](#Uri.scheme)
     * will be `file`.
     *
     * @param path A file system or UNC path.
     * @return A new Uri instance.
     * @see vscode.Uri.file
     */
    uriFile(path) {
        return vscode.Uri.file(path);
    }
    /**
     * Create an URI from a string. Will throw if the given value is not
     * valid.
     *
     * @param value The string value of an Uri.
     * @return A new Uri instance.
     * @see vscode.Uri.parse
     */
    uriParse(value) {
        return vscode.Uri.parse(value);
    }
    /**
     * The folder that is open in VS Code. `undefined` when no folder
     * has been opened.
     *
     * @readonly
     * @see vscode.workspace.rootPath
     */
    get workspaceRootPath() {
        return vscode.workspace.rootPath;
    }
}
exports.VscodeWrapper = VscodeWrapper;
//# sourceMappingURL=vscodeWrapper.js.map