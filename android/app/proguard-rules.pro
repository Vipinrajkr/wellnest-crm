# Add project specific ProGuard rules here.
#
# No custom native code in this app (see MainActivity.java) — Capacitor's
# own consumer ProGuard rules (bundled in each plugin's .aar under
# META-INF/proguard/) are merged in automatically and are normally enough
# on their own. The rules below are an explicit safety net added when
# R8 minification was turned on for the release build (see
# android/app/build.gradle) — Capacitor's WebView bridge and its plugins
# (Local Notifications, Splash Screen, Background Runner) call into some
# classes via reflection/JS-bridge annotations, which R8's static analysis
# can't always see is "in use." These keep rules cost a little extra APK
# size relative to a fully-stripped build, but protect against R8 quietly
# removing something that only breaks at runtime — a source-level review
# can't catch that failure mode, only running the actual shrunk APK can
# (see BUILD.md's release checklist).

# Capacitor core + the JS<->native bridge.
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# Any Capacitor/Cordova plugin class, native or JS-facing (annotated
# @CapacitorPlugin / @PluginMethod), across every plugin this app uses.
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod public *;
}
-keep class com.capacitorjs.plugins.** { *; }

# WebView JS-interface methods are invoked by name from JS, not from Java
# call sites R8 can trace — must survive both shrinking and renaming.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
