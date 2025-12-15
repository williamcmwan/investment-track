import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const QQQ_FILE = path.join(DATA_DIR, 'qqq-holdings.json');

export class QQQService {
    /**
     * Initialize the service: check if data exists, if not, fetch it.
     */
    static async initialize() {
        try {
            await fs.access(QQQ_FILE);
            Logger.info('✅ QQQ holdings data found.');
        } catch (error) {
            Logger.info('⚠️ QQQ holdings data not found on startup, fetching...');
            await this.updateHoldings();
        }
    }

    /**
     * Fetch QQQ holdings from Wikipedia and save to JSON file.
     */
    static async updateHoldings() {
        Logger.info('🔄 Updating QQQ holdings from Wikipedia...');
        try {
            const response = await axios.get('https://en.wikipedia.org/wiki/Nasdaq-100', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const html = response.data as string;

            // Extract symbols using Regex
            // Looking for the table with "Constituents" and then rows
            // Wikipedia structure varies, but usually symbols are links in a table
            // <table class="wikitable sortable" ...>
            // <td><a href="..." title="...">AAPL</a></td>

            // Matches Ticker symbols in the constituents table
            // This regex looks for capital letters (3-5 chars) inside a link in a wikitable cell
            // It's a heuristic but usually works for typical tickers
            const symbols: string[] = [];

            // Refined extraction logic: find the constituents table first
            // Table id is "constituents" (all lowercase)
            const tableMatch = html.match(/<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/);

            if (tableMatch && tableMatch[1]) {
                const tableContent = tableMatch[1];

                // Tickers are in the first column, usually plain text: <td>ADBE</td>
                // Regex to match: <td>TICKER</td>
                const rowRegex = /<td>\s*([A-Z\.]+)\s*<\/td>/g;
                let match;
                while ((match = rowRegex.exec(tableContent)) !== null) {
                    const symbol = match[1];
                    if (symbol && !symbols.includes(symbol)) {
                        symbols.push(symbol);
                    }
                }
            } else {
                // Fallback: try to match just generally in the page if table extraction fails (riskier)
                // Or could try a different known structure
                Logger.warn('⚠️ Could not isolate Constituents table, attempting broad search...');
            }

            // If regex failed or empty, don't overwrite with empty
            if (symbols.length < 90) { // Should be ~100
                Logger.error(`❌ Fetched QQQ list is too short (${symbols.length}). Aborting update to preserve data.`);
                return;
            }

            // Ensure data directory exists
            await fs.mkdir(DATA_DIR, { recursive: true });

            await fs.writeFile(QQQ_FILE, JSON.stringify(symbols, null, 2));
            Logger.info(`✅ QQQ holdings updated successfully: ${symbols.length} symbols.`);
        } catch (error) {
            Logger.error('❌ Failed to update QQQ holdings:', error);
        }
    }

    /**
     * Get QQQ holdings from local file.
     */
    static async getHoldings(): Promise<string[]> {
        try {
            const data = await fs.readFile(QQQ_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            Logger.error('❌ Failed to read QQQ holdings file:', error);
            return [];
        }
    }
}
