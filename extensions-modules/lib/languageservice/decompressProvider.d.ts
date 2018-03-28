import { IDecompressProvider, IPackage } from './interfaces';
import { ILogger } from '../models/interfaces';
export default class DecompressProvider implements IDecompressProvider {
    decompress(pkg: IPackage, logger: ILogger): Promise<void>;
}
