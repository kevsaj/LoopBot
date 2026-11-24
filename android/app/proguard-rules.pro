# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# --- LoopBot (used only when R8 is turned on, see build.gradle) ---
# Readable crash stack traces in Play Console (upload mapping.txt from the release artifact).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# The web page talks to Capacitor through a JavaScript interface; those methods are only ever
# called by name from JavaScript, so R8 must not rename or drop them.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Our own Capacitor plugin (DisplayPlugin: text zoom + font scale). Capacitor's rules keep
# annotated plugins already; this is a belt-and-braces keep for the app package.
-keep class com.kisstudios.loopbot.** { *; }
