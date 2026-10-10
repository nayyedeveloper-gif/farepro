package com.farepro.driver.location

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.farepro.driver.MainActivity
import com.farepro.driver.R
import com.farepro.driver.data.repository.DriverRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Foreground location service for ride-hailing:
 * - keeps GPS hot while driver is Online / On Trip
 * - pushes real-time coordinates to Go backend
 */
@AndroidEntryPoint
class DriverLocationService : LifecycleService() {

    @Inject lateinit var tracker: DriverLocationTracker
    @Inject lateinit var repo: DriverRepository

    private var pushJob: Job? = null
    private var tripId: String? = null
    private var mode: TrackingMode = TrackingMode.ONLINE

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelfSafe()
                return START_NOT_STICKY
            }
            ACTION_START, null -> {
                mode = intent?.getStringExtra(EXTRA_MODE)
                    ?.let { runCatching { TrackingMode.valueOf(it) }.getOrNull() }
                    ?: TrackingMode.ONLINE
                tripId = intent?.getStringExtra(EXTRA_TRIP_ID)
                tracker.setTripMeterActive(mode == TrackingMode.ON_TRIP)
                startAsForeground()
                tracker.start(mode)
                startRealtimePush()
            }
            ACTION_UPDATE -> {
                mode = intent.getStringExtra(EXTRA_MODE)
                    ?.let { runCatching { TrackingMode.valueOf(it) }.getOrNull() }
                    ?: mode
                tripId = intent.getStringExtra(EXTRA_TRIP_ID) ?: tripId
                tracker.setTripMeterActive(mode == TrackingMode.ON_TRIP)
                tracker.start(mode)
                updateNotification()
            }
        }
        return START_STICKY
    }

    private fun startAsForeground() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(
                NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun startRealtimePush() {
        pushJob?.cancel()
        pushJob = lifecycleScope.launch {
            var lastPushMs = 0L
            launch {
                tracker.fix
                    .map { Triple(it.lat, it.lng, it.timestampMs) }
                    .distinctUntilChanged()
                    .collectLatest { (lat, lng, ts) ->
                        val id = tripId ?: return@collectLatest
                        if (ts <= 0L || (lat == 0.0 && lng == 0.0)) return@collectLatest
                        val now = System.currentTimeMillis()
                        val minGap = if (mode == TrackingMode.ON_TRIP) 2_000L else 8_000L
                        if (now - lastPushMs < minGap) return@collectLatest
                        lastPushMs = now
                        repo.pushLocation(id, lat, lng)
                    }
            }
            while (isActive) {
                delay(if (mode == TrackingMode.ON_TRIP) 4_000 else 12_000)
                updateNotification()
            }
        }
    }

    private fun updateNotification() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIF_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this,
            1,
            Intent(this, DriverLocationService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val fix = tracker.fix.value
        val title = when (mode) {
            TrackingMode.ON_TRIP -> "On trip · sharing live GPS"
            TrackingMode.ONLINE -> "Online · waiting for jobs"
            else -> "Location active"
        }
        val body = if (fix.timestampMs > 0) {
            "±%.0fm · %.0f km/h".format(fix.accuracyM, fix.speedKmh)
        } else {
            "Acquiring GPS…"
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(open)
            .addAction(0, "Go offline", stop)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Driver location",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Keeps GPS active for ride-hailing dispatch"
            },
        )
    }

    private fun stopSelfSafe() {
        pushJob?.cancel()
        tracker.stop()
        tracker.setTripMeterActive(false)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    companion object {
        const val CHANNEL_ID = "farepro_driver_location"
        const val NOTIF_ID = 1001
        const val ACTION_START = "com.farepro.driver.location.START"
        const val ACTION_STOP = "com.farepro.driver.location.STOP"
        const val ACTION_UPDATE = "com.farepro.driver.location.UPDATE"
        const val EXTRA_MODE = "mode"
        const val EXTRA_TRIP_ID = "tripId"

        fun startIntent(context: android.content.Context, mode: TrackingMode, tripId: String? = null) =
            Intent(context, DriverLocationService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_MODE, mode.name)
                putExtra(EXTRA_TRIP_ID, tripId)
            }

        fun updateIntent(context: android.content.Context, mode: TrackingMode, tripId: String? = null) =
            Intent(context, DriverLocationService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_MODE, mode.name)
                putExtra(EXTRA_TRIP_ID, tripId)
            }

        fun stopIntent(context: android.content.Context) =
            Intent(context, DriverLocationService::class.java).setAction(ACTION_STOP)
    }
}
