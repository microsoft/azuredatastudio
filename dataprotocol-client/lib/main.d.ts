import { LanguageClient, ServerOptions, LanguageClientOptions as VSLanguageClientOptions, DynamicFeature, ServerCapabilities, RegistrationData, RPCMessageType, Disposable } from 'vscode-languageclient';
import { Ic2p } from './codeConverter';
import * as protocol from './protocol';
import { Ip2c } from './protocolConverter';
export interface LanguageClientOptions extends VSLanguageClientOptions {
    providerId: string;
    serverConnectionMetadata: any;
}
/**
 *
 */
export declare abstract class SqlOpsFeature<T> implements DynamicFeature<T> {
    protected _client: SqlOpsDataClient;
    private _message;
    protected _providers: Map<string, Disposable>;
    constructor(_client: SqlOpsDataClient, _message: RPCMessageType | RPCMessageType[]);
    readonly messages: RPCMessageType | RPCMessageType[];
    abstract fillClientCapabilities(capabilities: protocol.ClientCapabilities): void;
    abstract initialize(capabilities: ServerCapabilities): void;
    register(messages: RPCMessageType | RPCMessageType[], data: RegistrationData<T>): void;
    protected abstract registerProvider(options: T): Disposable;
    unregister(id: string): void;
    dispose(): void;
}
/**
 *
 */
export declare class SqlOpsDataClient extends LanguageClient {
    private _sqlc2p;
    private _sqlp2c;
    private _providerId;
    readonly sqlc2p: Ic2p;
    readonly sqlp2c: Ip2c;
    readonly providerId: string;
    constructor(name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean);
    constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean);
    private registerDataFeatures();
}
