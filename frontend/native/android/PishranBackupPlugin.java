package com.pishran.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import com.getcapacitor.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "PishranBackup")
public class PishranBackupPlugin extends Plugin {
    private static final String PREFS = "pishran_backup";
    private static final String TREE = "tree_uri";
    private static final int KEEP = 8;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("انتخاب پوشه لغو شد");
            return;
        }
        Uri uri = result.getData().getData();
        int flags = result.getData().getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
            getContext().getSharedPreferences(PREFS, 0).edit().putString(TREE, uri.toString()).apply();
            JSObject out = new JSObject();
            out.put("folderName", displayName(uri));
            out.put("uri", uri.toString());
            call.resolve(out);
        } catch (Exception e) {
            call.reject("ذخیره مجوز پوشه ناموفق بود", e);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Uri uri = savedTree();
        JSObject out = new JSObject();
        out.put("hasFolder", uri != null && hasPersistedPermission(uri));
        out.put("folderName", uri == null ? "" : (displayName(uri).equalsIgnoreCase("Download") ? "Download/Pishran-Backups" : displayName(uri)));
        call.resolve(out);
    }

    @PluginMethod
    public void saveBackup(PluginCall call) {
        String name = call.getString("fileName");
        String content = call.getString("content");
        if (name == null || content == null) { call.reject("نام یا محتوای فایل خالی است"); return; }
        Uri tree = savedTree();
        if (tree == null || !hasPersistedPermission(tree)) { call.reject("ابتدا پوشه پشتیبان را انتخاب کنید"); return; }
        try {
            ContentResolver resolver = getContext().getContentResolver();
            Uri parent = ensureBackupDirectory(tree);
            Uri file = DocumentsContract.createDocument(resolver, parent, "application/json", safeName(name));
            if (file == null) throw new IllegalStateException("ساخت فایل ناموفق بود");
            try (OutputStream stream = resolver.openOutputStream(file, "w")) {
                if (stream == null) throw new IllegalStateException("دسترسی نوشتن وجود ندارد");
                stream.write(content.getBytes(StandardCharsets.UTF_8));
                stream.flush();
            }
            int removed = prune(tree, parent);
            JSObject out = new JSObject();
            out.put("fileName", safeName(name));
            out.put("folderName", displayName(tree).equalsIgnoreCase("Download") ? "Download/Pishran-Backups" : displayName(parent));
            out.put("deletedOldFiles", removed);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("ذخیره فایل پشتیبان ناموفق بود", e);
        }
    }

    private Uri savedTree() {
        String value = getContext().getSharedPreferences(PREFS, 0).getString(TREE, "");
        if (value == null || value.isEmpty()) return null;
        try { return Uri.parse(value); } catch (Exception e) { return null; }
    }

    private boolean hasPersistedPermission(Uri uri) {
        for (android.content.UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(uri) && p.isReadPermission() && p.isWritePermission()) return true;
        }
        return false;
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0) return c.getString(i);
            }
        } catch (Exception ignored) { }
        String id = DocumentsContract.getTreeDocumentId(uri);
        int slash = id.lastIndexOf(':');
        return slash >= 0 ? id.substring(slash + 1) : "پوشه انتخاب‌شده";
    }

    private String safeName(String name) {
        String clean = name.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!clean.toLowerCase(Locale.ROOT).endsWith(".json")) clean += ".json";
        return clean;
    }

    private Uri ensureBackupDirectory(Uri tree) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        if ("Pishran-Backups".equalsIgnoreCase(displayName(tree))) return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        String rootId = DocumentsContract.getTreeDocumentId(tree);
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, rootId);
        try (Cursor c = resolver.query(children, new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE}, null, null, null)) {
            if (c != null) while (c.moveToNext()) {
                if ("Pishran-Backups".equals(c.getString(1)) && DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(2))) return DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0));
            }
        }
        Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, rootId);
        Uri created = DocumentsContract.createDocument(resolver, root, DocumentsContract.Document.MIME_TYPE_DIR, "Pishran-Backups");
        if (created == null) throw new IllegalStateException("ساخت پوشه Pishran-Backups ناموفق بود");
        return created;
    }

    private int prune(Uri tree, Uri directory) {
        int removed = 0;
        try {
            ContentResolver resolver = getContext().getContentResolver();
            Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(directory));
            ArrayList<Uri> backups = new ArrayList<>();
            try (Cursor c = resolver.query(children, new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_LAST_MODIFIED}, null, null, null)) {
                if (c != null) while (c.moveToNext()) {
                    String name = c.getString(1);
                    if (name != null && name.startsWith("pishran-auto-") && name.endsWith(".json")) {
                        backups.add(DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0)));
                    }
                }
            }
            if (backups.size() <= KEEP) return 0;
            Collections.sort(backups, (a,b) -> Long.compare(lastModified(resolver,b), lastModified(resolver,a)));
            for (int i = KEEP; i < backups.size(); i++) if (DocumentsContract.deleteDocument(resolver, backups.get(i))) removed++;
        } catch (Exception ignored) { }
        return removed;
    }

    private long lastModified(ContentResolver resolver, Uri uri) {
        try (Cursor c = resolver.query(uri, new String[]{DocumentsContract.Document.COLUMN_LAST_MODIFIED}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getLong(0);
        } catch (Exception ignored) { }
        return 0;
    }
}
