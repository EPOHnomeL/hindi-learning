import { httpRouter } from "convex/server";
import { auth } from "./auth";

// Mounts Convex Auth's HTTP routes (sign-in/up, token refresh, etc.).
const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
