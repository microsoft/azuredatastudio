import { ExtensionContext } from 'vscode';
export declare namespace Utils {
    interface IPackageInfo {
        name: string;
        version: string;
        aiKey: string;
    }
    function getPackageInfo(context: ExtensionContext): IPackageInfo;
    function generateGuid(): string;
    function generateUserId(): Promise<string>;
    function getActiveTextEditorUri(): string;
    function logDebug(msg: any, extensionConfigSectionName: string): void;
    function showErrorMsg(msg: string, extensionName: string): void;
    function isEmpty(str: any): boolean;
    function getAppDataPath(): any;
    function getDefaultLogLocation(): any;
}
