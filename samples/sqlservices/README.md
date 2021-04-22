This is a sample extension that will show some basic model-backed UI scenarios. The long-term goal is to use SQL Service querying (e.g. see if Agent and other services are running) and visualize in interesting ways. Additional suggestions for improving this sample are welcome.

## Run the following commands to produce an extension installation package

- `yarn install` - to install the dependencies
- `yarn build` - to build the code
- `vsce package` - to produce an extension installation package

## Launch ADS Dev instance with this extension
- `yarn install` - to install dependencies
- `yarn build` - to build the code
- Launch VSCode and open the azuredatastudio's code folder, run the 'Launch azuredatastudio' debug option (to work around the issue. The next step won't work without doing this first)
- Launch VSCode and open this folder, run the 'Debug in enlistment'
- Once ADS launches, you should be able to run the sqlservices commands, for example: sqlservices.openDialog