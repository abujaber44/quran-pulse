package com.quranpulse.app

import android.app.AlarmManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ExactAlarmModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ExactAlarmModule"

  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.resolve(true)
      return
    }

    val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
    promise.resolve(alarmManager?.canScheduleExactAlarms() == true)
  }

  @ReactMethod
  fun openExactAlarmSettings(promise: Promise) {
    val packageUri = Uri.parse("package:${reactContext.packageName}")

    val exactIntent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
      data = packageUri
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    try {
      reactContext.startActivity(exactIntent)
      promise.resolve(true)
      return
    } catch (_: ActivityNotFoundException) {
      // Fallback below.
    } catch (_: Exception) {
      // Fallback below.
    }

    val appSettingsIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
      data = packageUri
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    try {
      reactContext.startActivity(appSettingsIntent)
      promise.resolve(true)
    } catch (_: Exception) {
      promise.resolve(false)
    }
  }
}
