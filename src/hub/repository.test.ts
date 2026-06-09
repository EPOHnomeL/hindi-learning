import { runHubContract } from "./hubContract.js";
import { InMemoryHubRepository } from "./repository.js";

// The in-memory adapter must satisfy the Hub contract. The Neon adapter runs
// the same contract in neonRepository.test.ts.
runHubContract("in-memory", async () => new InMemoryHubRepository());
