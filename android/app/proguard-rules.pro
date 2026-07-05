# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# expo-notifications: local notification scheduling relies on reflection and
# serialization of trigger/content classes (including WorkManager, used
# internally for scheduled/date-based triggers). Without these keep rules,
# R8 can strip or rename members those internals depend on, which surfaces
# as opaque scheduling failures (e.g. android.net.Uri$HierarchicalUri cast
# exceptions) with no code-level change on our side.
-keep class expo.modules.notifications.** { *; }
-keep class androidx.work.** { *; }

# Add any project specific keep options here:
