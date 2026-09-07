import type { CaptureResult } from "posthog-js";

// One entry of properties.$exception_list, narrowed to the fields this filter
// reads. posthog-js types $exception_list loosely (Properties), so the shape is
// described here.
interface ExceptionListItem {
  mechanism?: { handled?: boolean; synthetic?: boolean };
  stacktrace?: { frames?: unknown[] };
}

// Drop an autocaptured $exception whose every entry is an unhandled, synthetic
// rejection with no stack frames. Firefox raises this shape when a fetch is
// aborted by a lesson-to-lesson navigation, or when the service worker resolves
// respondWith with Response.error() (public/sw.js): the rejected value is not an
// Error, so posthog-js synthesises a frameless exception. Source maps have no
// frames to symbolicate, so the event reaches error tracking with no call site
// and cannot be triaged. Every other exception class carries a stack, so this
// removes only the untriageable network noise and keeps real errors.
export function dropFramelessNetworkRejection(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event || event.event !== "$exception") {
    return event;
  }
  const list = event.properties.$exception_list as
    | ExceptionListItem[]
    | undefined;
  if (!Array.isArray(list) || list.length === 0) {
    return event;
  }
  const everyEntryFrameless = list.every((item) => {
    const unhandled = item?.mechanism?.handled === false;
    const synthetic = item?.mechanism?.synthetic === true;
    const frameless = !item?.stacktrace?.frames?.length;
    return unhandled && synthetic && frameless;
  });
  return everyEntryFrameless ? null : event;
}
