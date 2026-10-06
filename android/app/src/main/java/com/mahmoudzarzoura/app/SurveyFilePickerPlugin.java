package com.mahmoudzarzoura.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.ActivityCallback;

@CapacitorPlugin(name = "SurveyFilePicker")
public class SurveyFilePickerPlugin extends Plugin {

    private static final int PICK_FILE = 7467;

    @com.getcapacitor.PluginMethod
    public void pickFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                "application/octet-stream",
                "text/plain",
                "application/dxf",
                "application/acad"
        });
        startActivityForResult(call, intent, "filePicked");
    }

    @ActivityCallback
    private void filePicked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("تم إلغاء اختيار الملف");
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("لم يتم اختيار ملف");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        ret.put("name", uri.getLastPathSegment());
        call.resolve(ret);
    }
}
