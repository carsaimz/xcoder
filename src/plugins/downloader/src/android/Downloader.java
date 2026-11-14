package com.carsaimz.xcoder.downloader;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * System DownloadManager bridge.
 *
 * Why: big APK downloads through cordova-plugin-advanced-http die on the
 * 60s read timeout and offer no resume/notification. The system
 * DownloadManager streams to the public Downloads folder, survives app
 * kills, retries flaky networks and shows the native progress
 * notification — the user taps it when the download finishes.
 *
 * JS API (window.Downloader):
 *   download(url, filename) -> Promise<string id>
 *   query(id)               -> Promise<{status, bytes, total, reason, localUri}>
 *   cancel(id)              -> Promise<number removed>
 */
public class Downloader extends CordovaPlugin {

  @Override
  public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
    if ("download".equals(action)) {
      download(args, callbackContext);
      return true;
    }
    if ("query".equals(action)) {
      query(args, callbackContext);
      return true;
    }
    if ("cancel".equals(action)) {
      cancel(args, callbackContext);
      return true;
    }
    return false;
  }

  private void download(JSONArray args, CallbackContext callback) {
    try {
      String url = args.getString(0);
      String filename = args.getString(1);
      if (url == null || !url.startsWith("http")) {
        callback.error("download: url must be http(s)");
        return;
      }
      if (filename == null || filename.isEmpty()) {
        filename = "xcoder-download";
      }

      DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
      request.setTitle(filename);
      request.setDescription("XCoder");
      request.setNotificationVisibility(
          DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      request.setMimeType("application/vnd.android.package-archive");
      request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
      request.setAllowedOverMetered(true);
      request.setAllowedOverRoaming(true);

      DownloadManager manager = getManager();
      long id = manager.enqueue(request);
      callback.success(String.valueOf(id));
    } catch (Exception e) {
      callback.error("download failed: " + e.getMessage());
    }
  }

  private void query(JSONArray args, CallbackContext callback) {
    Cursor cursor = null;
    try {
      long id = Long.parseLong(args.getString(0));
      DownloadManager.Query query = new DownloadManager.Query();
      query.setFilterById(id);
      cursor = getManager().query(query);

      if (cursor == null || !cursor.moveToFirst()) {
        callback.error("download id not found: " + id);
        return;
      }

      JSONObject result = new JSONObject();
      int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
      long bytes = cursor.getLong(
          cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
      long total = cursor.getLong(
          cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
      int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
      String localUri = cursor.getString(
          cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));

      result.put("id", id);
      result.put("status", statusName(status));
      result.put("bytes", bytes);
      result.put("total", total);
      result.put("reason", reason);
      if (localUri != null) {
        result.put("localUri", localUri);
      }
      callback.success(result);
    } catch (Exception e) {
      callback.error("query failed: " + e.getMessage());
    } finally {
      if (cursor != null) {
        cursor.close();
      }
    }
  }

  private void cancel(JSONArray args, CallbackContext callback) {
    try {
      long id = Long.parseLong(args.getString(0));
      int removed = getManager().remove(new long[] { id });
      callback.success(removed);
    } catch (Exception e) {
      callback.error("cancel failed: " + e.getMessage());
    }
  }

  private DownloadManager getManager() {
    return (DownloadManager) cordova
        .getContext()
        .getSystemService(Context.DOWNLOAD_SERVICE);
  }

  private static String statusName(int status) {
    switch (status) {
      case DownloadManager.STATUS_SUCCESSFUL:
        return "successful";
      case DownloadManager.STATUS_FAILED:
        return "failed";
      case DownloadManager.STATUS_PAUSED:
        return "paused";
      case DownloadManager.STATUS_PENDING:
        return "pending";
      case DownloadManager.STATUS_RUNNING:
        return "running";
      default:
        return "unknown";
    }
  }
}
