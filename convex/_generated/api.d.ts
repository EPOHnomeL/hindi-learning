/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessCodeAuth from "../accessCodeAuth.js";
import type * as accessCodeFormat from "../accessCodeFormat.js";
import type * as accessCodes from "../accessCodes.js";
import type * as adminSecret from "../adminSecret.js";
import type * as auth from "../auth.js";
import type * as authRedirect from "../authRedirect.js";
import type * as authoring from "../authoring.js";
import type * as backfill from "../backfill.js";
import type * as capture from "../capture.js";
import type * as catalogue from "../catalogue.js";
import type * as certificates from "../certificates.js";
import type * as contentBlobs from "../contentBlobs.js";
import type * as content_authoring from "../content/authoring.js";
import type * as content_publish from "../content/publish.js";
import type * as content_reader from "../content/reader.js";
import type * as content_testHelpers from "../content/testHelpers.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as donations from "../donations.js";
import type * as eft from "../eft.js";
import type * as email from "../email.js";
import type * as emblem from "../emblem.js";
import type * as env from "../env.js";
import type * as geminiClient from "../geminiClient.js";
import type * as http from "../http.js";
import type * as interest from "../interest.js";
import type * as inviteEmail from "../inviteEmail.js";
import type * as joinConsent from "../joinConsent.js";
import type * as languages from "../languages.js";
import type * as ledger from "../ledger.js";
import type * as lib from "../lib.js";
import type * as market from "../market.js";
import type * as openrouter from "../openrouter.js";
import type * as openrouterClient from "../openrouterClient.js";
import type * as passwordReset from "../passwordReset.js";
import type * as payfast from "../payfast.js";
import type * as progressCounts from "../progressCounts.js";
import type * as public_ from "../public.js";
import type * as quizShuffle from "../quizShuffle.js";
import type * as rates from "../rates.js";
import type * as regions from "../regions.js";
import type * as resetEmail from "../resetEmail.js";
import type * as resources from "../resources.js";
import type * as routine from "../routine.js";
import type * as sales from "../sales.js";
import type * as sellerStatus from "../sellerStatus.js";
import type * as sellers from "../sellers.js";
import type * as shareGrants from "../shareGrants.js";
import type * as shares from "../shares.js";
import type * as sourceLang from "../sourceLang.js";
import type * as tenantAssignment from "../tenantAssignment.js";
import type * as tenantBackfill from "../tenantBackfill.js";
import type * as tenantDonations from "../tenantDonations.js";
import type * as tenantFlags from "../tenantFlags.js";
import type * as tenantTheme from "../tenantTheme.js";
import type * as tenants from "../tenants.js";
import type * as tokens from "../tokens.js";
import type * as topicAccess from "../topicAccess.js";
import type * as translate from "../translate.js";
import type * as userPrefs from "../userPrefs.js";
import type * as users from "../users.js";
import type * as voucherCode from "../voucherCode.js";
import type * as vouchers from "../vouchers.js";
import type * as whitelist from "../whitelist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessCodeAuth: typeof accessCodeAuth;
  accessCodeFormat: typeof accessCodeFormat;
  accessCodes: typeof accessCodes;
  adminSecret: typeof adminSecret;
  auth: typeof auth;
  authRedirect: typeof authRedirect;
  authoring: typeof authoring;
  backfill: typeof backfill;
  capture: typeof capture;
  catalogue: typeof catalogue;
  certificates: typeof certificates;
  contentBlobs: typeof contentBlobs;
  "content/authoring": typeof content_authoring;
  "content/publish": typeof content_publish;
  "content/reader": typeof content_reader;
  "content/testHelpers": typeof content_testHelpers;
  crons: typeof crons;
  dashboard: typeof dashboard;
  donations: typeof donations;
  eft: typeof eft;
  email: typeof email;
  emblem: typeof emblem;
  env: typeof env;
  geminiClient: typeof geminiClient;
  http: typeof http;
  interest: typeof interest;
  inviteEmail: typeof inviteEmail;
  joinConsent: typeof joinConsent;
  languages: typeof languages;
  ledger: typeof ledger;
  lib: typeof lib;
  market: typeof market;
  openrouter: typeof openrouter;
  openrouterClient: typeof openrouterClient;
  passwordReset: typeof passwordReset;
  payfast: typeof payfast;
  progressCounts: typeof progressCounts;
  public: typeof public_;
  quizShuffle: typeof quizShuffle;
  rates: typeof rates;
  regions: typeof regions;
  resetEmail: typeof resetEmail;
  resources: typeof resources;
  routine: typeof routine;
  sales: typeof sales;
  sellerStatus: typeof sellerStatus;
  sellers: typeof sellers;
  shareGrants: typeof shareGrants;
  shares: typeof shares;
  sourceLang: typeof sourceLang;
  tenantAssignment: typeof tenantAssignment;
  tenantBackfill: typeof tenantBackfill;
  tenantDonations: typeof tenantDonations;
  tenantFlags: typeof tenantFlags;
  tenantTheme: typeof tenantTheme;
  tenants: typeof tenants;
  tokens: typeof tokens;
  topicAccess: typeof topicAccess;
  translate: typeof translate;
  userPrefs: typeof userPrefs;
  users: typeof users;
  voucherCode: typeof voucherCode;
  vouchers: typeof vouchers;
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
