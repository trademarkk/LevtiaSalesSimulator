import "dotenv/config";

import { ensureAllManagersHaveDefaultObjections } from "../lib/db";

async function main() {
  const summary = await ensureAllManagersHaveDefaultObjections();
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
