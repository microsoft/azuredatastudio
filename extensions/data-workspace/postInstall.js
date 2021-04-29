const fs = require('fs');

// copy git.d.ts from git extension to data-workspace extension
fs.copyFile('../git/src/api/git.d.ts', "./src/typings/git.d.ts", (err) => {
	if (err) {
		throw err;
	}
});
