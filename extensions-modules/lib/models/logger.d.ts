import { ILogger } from './interfaces';
import { IExtensionConstants } from './contracts/contracts';
export declare class Logger implements ILogger {
    private _writer;
    private _prefix;
    private _extensionConstants;
    private _indentLevel;
    private _indentSize;
    private _atLineStart;
    constructor(writer: (message: string) => void, extensionConstants: IExtensionConstants, prefix?: string);
    logDebug(message: string): void;
    private _appendCore(message);
    increaseIndent(): void;
    decreaseIndent(): void;
    append(message?: string): void;
    appendLine(message?: string): void;
}
