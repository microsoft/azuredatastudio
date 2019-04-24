'use strict';
import 'mocha';
import { runWhenCodeLoad } from '../src/fmkUtils';
import { stressify, sleep, bear} from '../src/stressutils'; //, bear, sleep
import assert = require('assert');
//import { runWhenCodeLoad } from '../extensions/integration-tests/src/fmkUtils';

class StressifyTester {
	static dop:number = 5;
	static iter:number = 4;

	i:number = 0;
	@runWhenCodeLoad(StressifyTester.prototype.setup)
	setup()
	{
		process.env.SuiteType = 'Stress';
		console.log(`environment variable SuiteType set to ${process.env.SuiteType}`);
	}

	@stressify({dop:StressifyTester.dop, iterations:StressifyTester.iter})
	async basicTest(arg:string)
	{
		bear();	// yield to other operations.
		await sleep(50); // sleep for 100 ms without spinning
		//console.log(`basicTest() called for i=${this.i}`);
		this.i++;
	}
}

suite('StressUtils unit tests', function () {
	setup(function () {
		this.Tester = new StressifyTester();
	});
	test('basicTest', async function () {
		console.log('invoking basicTest()');
		let retVal = await this.Tester.basicTest('abracadabra');
		console.log(`test basicTest done, i=${this.Tester.i}`);
		console.log(`test retVal is ${retVal}`);
		assert(this.Tester.i === StressifyTester.dop * StressifyTester.iter, `i should be ${StressifyTester.dop * StressifyTester.iter}`);
	});
});
