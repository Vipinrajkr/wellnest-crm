// services/fileExport.js
// Triggers a standard file download for a Blob. Works in a plain browser
// context and inside the Capacitor WebView. This is a stand-in for a
// future platform/filesystemAdapter.js — once Capacitor's Filesystem and
// Share plugins are wired in for native saving/sharing, that concern
// should move there so this module stays purely "hand the user a file."

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
