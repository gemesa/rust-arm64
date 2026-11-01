const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const BOOK = isLocal ? "/" : "/rust-arm64/";

document.querySelectorAll("a[href]").forEach((a) => {
  const url = new URL(a.href);
  if (url.hostname === location.hostname && url.pathname.startsWith(BOOK))
    return;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
});
