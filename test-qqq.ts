
import { QQQService } from './server/src/services/qqqService.js';
import { Logger } from './server/src/utils/logger.js';

// Mock Logger to console
Logger.info = console.log;
Logger.error = console.error;
Logger.warn = console.warn;

async function run() {
    console.log('Running manual update...');
    await QQQService.updateHoldings();
    const holdings = await QQQService.getHoldings();
    console.log(`Holdings count: ${holdings.length}`);
    console.log('Sample:', holdings.slice(0, 5));
}

run();
