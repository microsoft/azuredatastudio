This is a sample extension that will show some basic model-backed UI scenarios and how to contribute feature providers(e.g. Connection, Object Explorer) in ADS. Note: only implement the providers this way if your data service has native JavaScript SDK available, otherwise use [data protocol client](https://github.com/microsoft/sqlops-dataprotocolclient), please refer to [SQL Tools Service] (https://github.com/microsoft/sqltoolsservice) or [PG Tools Service](https://github.com/microsoft/pgtoolsservice) as examples.

## Run the following commands to produce an extension installation package

- `yarn install` - to install the dependencies
- `yarn build` - to build the code
- `vsce package` - to produce an extension installation package; if not installed, run `npm install --global @vscode/vsce` first.

## Launch ADS Dev instance with this extension
- `yarn install` - to install dependencies
- `yarn build` - to build the code
- Launch VSCode and open the azuredatastudio's code folder, run the 'Launch azuredatastudio' debug option (to work around the issue. The next step won't work without doing this first)
- Launch VSCode and open this folder, run the 'Debug in enlistment' target.  To debug, [install the `sqlops-debug` extension](https://github.com/Microsoft/azuredatastudio/wiki/Debugging-an-Extension-with-VS-Code) in VS Code.
- Once ADS launches, you should be able to run the sqlservices commands, for example: `sqlservices.openDialog`.

## Consuming `azdata` typing changes during development
If writing samples for new component model UI components that aren't yet checked into main, change the URL specified in `sqlservices\tasks\buildtasks.js`'s `copytypings` task to point to the branch with the `azdata.proposed.d.ts` changes.  Because this task pulls the `azdata.proposed.d.ts` type from this URL, your changes must be pushed to your branch before this will work.  It does not use the local files.

After running `yarn build`, you should see your updated typings in `sqlservices\typings\azdata.proposed.d.ts`.

> **Important**
> Do not check in changes to this URL to `main`.  This is for development only; revert these changes before they are sent out in a PR.
