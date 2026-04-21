import { auth } from "../src/lib/auth";
import { headers } from "next/headers";

async function main() {
  // Mock headers for auth bypass
  process.env.SKIP_AUTH = "true";
  
  const authResult = await auth();
  console.log("Auth Result:", authResult);
  console.log("User ID:", authResult.userId);
}

main().catch(console.error);
