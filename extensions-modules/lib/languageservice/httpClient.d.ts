import { IPackage, IStatusView, IHttpClient } from './interfaces';
import { ILogger } from '../models/interfaces';
export default class HttpClient implements IHttpClient {
    downloadFile(urlString: string, pkg: IPackage, logger: ILogger, statusView: IStatusView, proxy?: string, strictSSL?: boolean): Promise<void>;
    private getHttpClientOptions(url, proxy?, strictSSL?);
    handleDataReceivedEvent(progress: IDownloadProgress, data: any, logger: ILogger, statusView: IStatusView): void;
    private handleSuccessfulResponse(pkg, response, logger, statusView);
}
export interface IDownloadProgress {
    packageSize: number;
    downloadedBytes: number;
    downloadPercentage: number;
    dots: number;
}
