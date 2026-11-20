package com.kisstudios.loopbot;

import android.content.pm.ActivityInfo;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** Reported by Google Play Games on PC (and its developer emulator). */
    static final String PLAY_GAMES_PC = "com.google.android.play.feature.HPE_EXPERIENCE";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The manifest leaves the orientation open, because Google Play Games on PC picks the
        // window's shape from the manifest alone, once, at launch: a portrait lock there gave a
        // tall phone-shaped window even in full screen. Phones are locked to portrait here, before
        // the window is first drawn, so they never show a landscape frame. Tablets, Chromebooks and
        // PCs turn and resize freely (the web layout has a wide side-by-side mode for landscape).
        if (!freeOrientation()) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
        // Local plugins register before the bridge starts.
        registerPlugin(DisplayPlugin.class);
        super.onCreate(savedInstanceState);
    }

    private boolean freeOrientation() {
        boolean pc = getPackageManager().hasSystemFeature(PLAY_GAMES_PC);
        boolean largeScreen = getResources().getConfiguration().smallestScreenWidthDp >= 600;
        return pc || largeScreen;
    }
}
