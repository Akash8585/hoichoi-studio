import { ensureDemoUser, seedDemoPipeline } from "../src/lib/db/seed";

async function main() {
  await ensureDemoUser();
  const result = await seedDemoPipeline();
  console.log(result);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
