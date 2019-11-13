declare module 'buffer-stream-reader' {
	import * as fs from 'fs';

	class BufferStreamReader {
		constructor(stream: string | Buffer);
		pipe(pipe: fs.WriteStream): void
	}

	namespace BufferStreamReader {
		interface FindRemoveOptions {
			age?: {
				seconds?: number;
			};
			limit?: number;
		}
	}

	export = BufferStreamReader;
}
