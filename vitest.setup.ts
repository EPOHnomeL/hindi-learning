// Loads .env so DATABASE_URL_TEST is available to the Neon contract tests.
// Absent locally → the Neon suite auto-skips.
import "dotenv/config";
