import {EXTENSION_ID} from '../const';
import * as vscode from 'vscode';
import ContentProvider from '../content-provider';

export default class WorkspaceAdaptor {
    private readonly workspace: typeof vscode.workspace;

    constructor(workspace: typeof vscode.workspace) {
        this.workspace = workspace;
    }

    get<T>(configName: string): T {
        const extensionConfig = this.workspace.getConfiguration(EXTENSION_ID);
        return extensionConfig.get(configName) as T;
    }

    registerTextDocumentContentProvider(EXTENSION_SCHEME: string, contentProvider: ContentProvider): vscode.Disposable {
        return this.workspace.registerTextDocumentContentProvider(EXTENSION_SCHEME, contentProvider);
    }
}
