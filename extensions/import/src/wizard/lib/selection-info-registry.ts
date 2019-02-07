import {ObjectMap} from './utils/collections';
import {SelectionInfo} from './types/selection-info';

export default class SelectionInfoRegistry {
    private readonly data: ObjectMap<SelectionInfo>;

    constructor() {
        this.data = Object.create(null);
    }

    set(key: string, textInfo: SelectionInfo): void {
        this.data[key] = {
            text: textInfo.text,
            fileName: textInfo.fileName,
            lineRanges: textInfo.lineRanges || []
        };
    }

    get(key: string): SelectionInfo {
        return this.data[key];
    }
}
