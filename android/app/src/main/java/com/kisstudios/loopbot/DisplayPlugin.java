package com.kisstudios.loopbot;

import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android's Font size setting. The WebView scales every font by it on its own (text zoom), which
 * also inflates buttons, the command palette and the board's labels until the program has no room.
 * The game keeps its layout at 100% and tells the page the device's font scale instead, so the
 * page can turn on its own Larger text (which grows the reading text, not the controls).
 */
@CapacitorPlugin(name = "LoopBotDisplay")
public class DisplayPlugin extends Plugin {

    @Override
    public void load() {
        WebView webView = getBridge().getWebView();
        if (webView != null) webView.getSettings().setTextZoom(100);
    }

    @PluginMethod
    public void getFontScale(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("fontScale", getContext().getResources().getConfiguration().fontScale);
        call.resolve(ret);
    }
}
