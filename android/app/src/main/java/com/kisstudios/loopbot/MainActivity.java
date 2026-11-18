package com.kisstudios.loopbot;

import android.content.pm.ActivityInfo;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** Reported by Google Play Games on PC (and its developer emulator). */
    private static final String PLAY_GAMES_PC = "com.google.android.play.feature.HPE_EXPERIENCE";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Phones stay locked to portrait (set in AndroidManifest.xml). Tablets, Chromebooks and
        // Google Play Games on PC turn freely and resize: the web layout has a wide, side-by-side
        // mode for landscape windows (board left, program right), so nothing is letterboxed.
        boolean pc = getPackageManager().hasSystemFeature(PLAY_GAMES_PC);
        boolean largeScreen = getResources().getConfiguration().smallestScreenWidthDp >= 600;
        if (pc || largeScreen) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
        }
    }
}
