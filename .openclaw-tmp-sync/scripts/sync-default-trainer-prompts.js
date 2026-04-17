"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const db_1 = require("../lib/db");
async function main() {
    const summary = await (0, db_1.overwriteAllManagersWithDefaultTrainerPrompt)();
    console.log(JSON.stringify(summary, null, 2));
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
