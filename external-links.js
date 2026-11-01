document.querySelectorAll('a[href^="http"]').forEach((a) => {
  if (a.hostname !== location.hostname) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
});
