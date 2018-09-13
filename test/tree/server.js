/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('mz/fs');
const path = require('path');
const Koa = require('koa');
const _ = require('koa-route');
const serve = require('koa-static');
const mount = require('koa-mount');

const app = new Koa();
const root = path.dirname(path.dirname(__dirname));

async function getTree(fsPath, level) {
	const element = path.basename(fsPath);
	const stat = await fs.stat(fsPath);

	if (!stat.isDirectory() || element === '.git' || element === '.build' || level >= 3) {
		return { element };
	}

	const childNames = await fs.readdir(fsPath);
	const children = await Promise.all(childNames.map(async childName => await getTree(path.join(fsPath, childName), level + 1)));
	return { element, collapsible: true, collapsed: false, children };
}

app.use(serve('public'));
app.use(mount('/static', serve('../../out')));
app.use(_.get('/api/ls', async ctx => {
	const relativePath = ctx.query.path;
	const absolutePath = path.join(root, relativePath);

	ctx.body = await getTree(absolutePath, 0);
}))

app.listen(3000);
console.log('http://localhost:3000');