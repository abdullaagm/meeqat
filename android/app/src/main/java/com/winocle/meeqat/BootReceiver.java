package com.winocle.meeqat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Opens the prayer screen as soon as the TV / stick finishes starting up. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent != null ? intent.getAction() : null;
        if (a == null) return;
        if (a.equals(Intent.ACTION_BOOT_COMPLETED) || a.endsWith("QUICKBOOT_POWERON") || a.equals(Intent.ACTION_MY_PACKAGE_REPLACED)) {
            Intent i = new Intent(context, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            try { context.startActivity(i); } catch (Exception ignored) { }
        }
    }
}
