/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authoring from "../authoring.js";
import type * as backfill from "../backfill.js";
import type * as capture from "../capture.js";
import type * as catalogue from "../catalogue.js";
import type * as certificates from "../certificates.js";
import type * as content_authoring from "../content/authoring.js";
import type * as content_publish from "../content/publish.js";
import type * as content_reader from "../content/reader.js";
import type * as content_testHelpers from "../content/testHelpers.js";
import type * as crons from "../crons.js";
import type * as eft from "../eft.js";
import type * as email from "../email.js";
import type * as emblem from "../emblem.js";
import type * as env from "../env.js";
import type * as geminiClient from "../geminiClient.js";
import type * as http from "../http.js";
import type * as inviteEmail from "../inviteEmail.js";
import type * as languages from "../languages.js";
import type * as ledger from "../ledger.js";
import type * as lib from "../lib.js";
import type * as market from "../market.js";
import type * as openrouter from "../openrouter.js";
import type * as openrouterClient from "../openrouterClient.js";
import type * as payfast from "../payfast.js";
import type * as progressCounts from "../progressCounts.js";
import type * as public_ from "../public.js";
import type * as quizShuffle from "../quizShuffle.js";
import type * as resources from "../resources.js";
import type * as routine from "../routine.js";
import type * as sales from "../sales.js";
import type * as sellerStatus from "../sellerStatus.js";
import type * as sellers from "../sellers.js";
import type * as shares from "../shares.js";
import type * as tenantBackfill from "../tenantBackfill.js";
import type * as tenantFlags from "../tenantFlags.js";
import type * as tenants from "../tenants.js";
import type * as translate from "../translate.js";
import type * as userPrefs from "../userPrefs.js";
import type * as users from "../users.js";
import type * as whitelist from "../whitelist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authoring: typeof authoring;
  backfill: typeof backfill;
  capture: typeof capture;
  catalogue: typeof catalogue;
  certificates: typeof certificates;
  "content/authoring": typeof content_authoring;
  "content/publish": typeof content_publish;
  "content/reader": typeof content_reader;
  "content/testHelpers": typeof content_testHelpers;
  crons: typeof crons;
  eft: typeof eft;
  email: typeof email;
  emblem: typeof emblem;
  env: typeof env;
  geminiClient: typeof geminiClient;
  http: typeof http;
  inviteEmail: typeof inviteEmail;
  languages: typeof languages;
  ledger: typeof ledger;
  lib: typeof lib;
  market: typeof market;
  openrouter: typeof openrouter;
  openrouterClient: typeof openrouterClient;
  payfast: typeof payfast;
  progressCounts: typeof progressCounts;
  public: typeof public_;
  quizShuffle: typeof quizShuffle;
  resources: typeof resources;
  routine: typeof routine;
  sales: typeof sales;
  sellerStatus: typeof sellerStatus;
  sellers: typeof sellers;
  shares: typeof shares;
  tenantBackfill: typeof tenantBackfill;
  tenantFlags: typeof tenantFlags;
  tenants: typeof tenants;
  translate: typeof translate;
  userPrefs: typeof userPrefs;
  users: typeof users;
  whitelist: typeof whitelist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
