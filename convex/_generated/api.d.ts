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
import type * as backfill from "../backfill.js";
import type * as capture from "../capture.js";
import type * as certificates from "../certificates.js";
import type * as content from "../content.js";
import type * as crons from "../crons.js";
import type * as emblem from "../emblem.js";
import type * as http from "../http.js";
import type * as languages from "../languages.js";
import type * as ledger from "../ledger.js";
import type * as lib from "../lib.js";
import type * as market from "../market.js";
import type * as openrouter from "../openrouter.js";
import type * as payfast from "../payfast.js";
import type * as public_ from "../public.js";
import type * as quizShuffle from "../quizShuffle.js";
import type * as resources from "../resources.js";
import type * as routine from "../routine.js";
import type * as sellers from "../sellers.js";
import type * as shares from "../shares.js";
import type * as translate from "../translate.js";
import type * as whitelist from "../whitelist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  backfill: typeof backfill;
  capture: typeof capture;
  certificates: typeof certificates;
  content: typeof content;
  crons: typeof crons;
  emblem: typeof emblem;
  http: typeof http;
  languages: typeof languages;
  ledger: typeof ledger;
  lib: typeof lib;
  market: typeof market;
  openrouter: typeof openrouter;
  payfast: typeof payfast;
  public: typeof public_;
  quizShuffle: typeof quizShuffle;
  resources: typeof resources;
  routine: typeof routine;
  sellers: typeof sellers;
  shares: typeof shares;
  translate: typeof translate;
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
