/** Query flag for branding iframe loaded from first-party `/create/`. */
export const CREATE_HOST_QUERY_KEY = "createHost";
export const CREATE_HOST_QUERY_VALUE = "1";

export function isCreateHostSearchParams(params: URLSearchParams): boolean {
  return params.get(CREATE_HOST_QUERY_KEY) === CREATE_HOST_QUERY_VALUE;
}

export function isEmbeddedDocument(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

export type ICreateHostEmbedContext = {
  embedded: boolean;
  searchParams: URLSearchParams;
};

/** Pure check for tests — create-host shell requires iframe embed + query flag. */
export function resolveCreateHostEmbed(context: ICreateHostEmbedContext): boolean {
  return (
    context.embedded && isCreateHostSearchParams(context.searchParams)
  );
}

export function isCreateHostEmbed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return resolveCreateHostEmbed({
    embedded: isEmbeddedDocument(),
    searchParams: new URLSearchParams(window.location.search),
  });
}

/** Sets {@link CREATE_HOST_QUERY_KEY} on `url` (mutates and returns the same URL). */
export function appendCreateHostQuery(url: URL): URL {
  url.searchParams.set(CREATE_HOST_QUERY_KEY, CREATE_HOST_QUERY_VALUE);
  return url;
}
