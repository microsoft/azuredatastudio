import { Runtime } from '../models/platform';
import ServiceDownloadProvider from './serviceDownloadProvider';
import { IConfig, IStatusView } from './interfaces';
export default class ServerProvider {
    private _downloadProvider;
    private _config;
    private _statusView;
    private _extensionConfigSectionName;
    constructor(_downloadProvider: ServiceDownloadProvider, _config: IConfig, _statusView: IStatusView, _extensionConfigSectionName: string);
    /**
     * Public get method for downloadProvider
     */
    readonly downloadProvider: ServiceDownloadProvider;
    /**
     * Given a file path, returns the path to the SQL Tools service file.
     */
    findServerPath(filePath: string, executableFiles?: string[]): Promise<string>;
    /**
     * Download the service if doesn't exist and returns the file path.
     */
    getOrDownloadServer(runtime: Runtime): Promise<string>;
    /**
     * Returns the path of the installed service
     */
    getServerPath(runtime: Runtime): Promise<string>;
    /**
     * Downloads the service and returns the path of the installed service
     */
    downloadServerFiles(runtime: Runtime): Promise<string>;
}
