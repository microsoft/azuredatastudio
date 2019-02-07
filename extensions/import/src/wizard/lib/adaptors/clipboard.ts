const PLATFORM_WINDOWS = 'win32';

interface Clipboardy {
    read: () => Promise<string>;
}

export default class Clipboard {
    private readonly clipboardy: Clipboardy;
    private readonly platform: string;

    constructor(clipboardy: Clipboardy, platform: string) {
        this.clipboardy = clipboardy;
        this.platform = platform;
    }

    async read(): Promise<string> {
        const text = await this.clipboardy.read();
        return this.windows ? this.dropCRFromEOL(text) : text;
    }

    private get windows(): boolean {
        return this.platform === PLATFORM_WINDOWS;
    }

    private dropCRFromEOL(text: string): string {
        return text.split('\r\r\n').join('\r\n');
    }
}
