package com.farepro.driver.permissions

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.net.toUri

data class PermissionItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val granted: Boolean,
    val required: Boolean = true,
)

object DriverPermissions {
    const val ID_LOCATION = "location"
    const val ID_BACKGROUND = "background"
    const val ID_NOTIFICATIONS = "notifications"
    const val ID_OVERLAY = "overlay"
    const val ID_BATTERY = "battery"

    fun fineLocationGranted(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    fun backgroundLocationGranted(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun notificationsGranted(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < 33) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun overlayGranted(context: Context): Boolean = Settings.canDrawOverlays(context)

    fun batteryUnrestricted(context: Context): Boolean {
        val pm = context.getSystemService(PowerManager::class.java) ?: return true
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun snapshot(context: Context): List<PermissionItem> = listOf(
        PermissionItem(
            id = ID_LOCATION,
            title = "Location",
            subtitle = "Precise GPS for jobs & fare meter",
            granted = fineLocationGranted(context),
            required = true,
        ),
        PermissionItem(
            id = ID_BACKGROUND,
            title = "Background location",
            subtitle = "Keep tracking while screen is off",
            granted = backgroundLocationGranted(context),
            required = true,
        ),
        PermissionItem(
            id = ID_NOTIFICATIONS,
            title = "Notifications",
            subtitle = "Online / on-trip status bar",
            granted = notificationsGranted(context),
            required = true,
        ),
        PermissionItem(
            id = ID_OVERLAY,
            title = "Display over apps",
            subtitle = "Floating KM bubble during trips",
            granted = overlayGranted(context),
            required = true,
        ),
        PermissionItem(
            id = ID_BATTERY,
            title = "Unrestricted battery",
            subtitle = "Survive reboot & Doze while on trip",
            granted = batteryUnrestricted(context),
            required = false,
        ),
    )

    fun allRequiredGranted(context: Context): Boolean =
        snapshot(context).filter { it.required }.all { it.granted }

    fun runtimeLocationPerms(): Array<String> = arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    )

    fun runtimeNotificationPerms(): Array<String> =
        if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.POST_NOTIFICATIONS)
        else emptyArray()

    fun backgroundLocationPerm(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        } else {
            emptyArray()
        }

    fun openAppSettings(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }

    fun openOverlaySettings(context: Context) {
        context.startActivity(
            Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                "package:${context.packageName}".toUri(),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    fun openBatterySettings(activity: Activity) {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = "package:${activity.packageName}".toUri()
            }
            activity.startActivity(intent)
        } catch (_: Exception) {
            activity.startActivity(
                Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    fun openLocationSettings(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
