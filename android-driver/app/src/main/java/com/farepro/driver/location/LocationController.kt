package com.farepro.driver.location

import android.content.Context
import androidx.core.content.ContextCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocationController @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    fun goOnline() {
        val intent = DriverLocationService.startIntent(context, TrackingMode.ONLINE)
        ContextCompat.startForegroundService(context, intent)
    }

    fun goOnTrip(tripId: String) {
        val intent = DriverLocationService.startIntent(context, TrackingMode.ON_TRIP, tripId)
        ContextCompat.startForegroundService(context, intent)
    }

    fun updateTrip(tripId: String?) {
        val mode = if (tripId != null) TrackingMode.ON_TRIP else TrackingMode.ONLINE
        val intent = DriverLocationService.updateIntent(context, mode, tripId)
        ContextCompat.startForegroundService(context, intent)
    }

    fun goOffline() {
        context.startService(DriverLocationService.stopIntent(context))
    }
}
