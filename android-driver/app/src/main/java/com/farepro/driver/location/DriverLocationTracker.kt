package com.farepro.driver.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.farepro.driver.domain.GeoMath
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import javax.inject.Singleton

enum class TrackingMode { IDLE, ONLINE, ON_TRIP }

@Singleton
class DriverLocationTracker @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val fused = LocationServices.getFusedLocationProviderClient(context)
    private val filter = AccurateLocationFilter()

    private val _fix = MutableStateFlow(DriverFix(0.0, 0.0, 0f, 0f, 0f, null, 0L, 0.0))
    val fix: StateFlow<DriverFix> = _fix.asStateFlow()

    private val _path = MutableStateFlow<List<Pair<Double, Double>>>(emptyList())
    val path: StateFlow<List<Pair<Double, Double>>> = _path.asStateFlow()

    private val _tracking = MutableStateFlow(false)
    val tracking: StateFlow<Boolean> = _tracking.asStateFlow()

    private var mode: TrackingMode = TrackingMode.IDLE
    private var cumulativeM = 0.0
    private var tripMeterActive = false

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val loc = result.lastLocation ?: return
            onRawLocation(loc)
        }
    }

    fun resetTripMeter() {
        cumulativeM = 0.0
        filter.reset()
        _path.value = emptyList()
        _fix.update { it.copy(cumulativeDistanceM = 0.0) }
    }

    /** Restore distance after reboot / process death without wiping the filter seed. */
    fun restoreTripMeter(meters: Double, active: Boolean) {
        cumulativeM = meters.coerceAtLeast(0.0)
        tripMeterActive = active
        filter.reset()
        _fix.update { it.copy(cumulativeDistanceM = cumulativeM) }
    }

    fun setTripMeterActive(active: Boolean) {
        tripMeterActive = active
    }

    fun cumulativeKm(): Double = cumulativeM / 1000.0

    @SuppressLint("MissingPermission")
    fun start(mode: TrackingMode = TrackingMode.ONLINE) {
        this.mode = mode
        val interval = when (mode) {
            TrackingMode.ON_TRIP -> 1_000L
            TrackingMode.ONLINE -> 3_000L
            TrackingMode.IDLE -> 10_000L
        }
        val minDistance = when (mode) {
            TrackingMode.ON_TRIP -> 2f
            else -> 8f
        }
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, interval)
            .setMinUpdateIntervalMillis(interval / 2)
            .setMinUpdateDistanceMeters(minDistance)
            .setWaitForAccurateLocation(mode == TrackingMode.ON_TRIP)
            .setMaxUpdates(Int.MAX_VALUE)
            .build()

        fused.removeLocationUpdates(callback)
        fused.requestLocationUpdates(request, callback, Looper.getMainLooper())
        _tracking.value = true

        fused.lastLocation.addOnSuccessListener { loc ->
            if (loc != null) onRawLocation(loc)
        }
    }

    fun stop() {
        fused.removeLocationUpdates(callback)
        _tracking.value = false
        mode = TrackingMode.IDLE
    }

    private fun onRawLocation(loc: Location) {
        val evaluated = filter.evaluate(loc)
        val acceptedLoc = evaluated.location ?: return

        var speed = if (acceptedLoc.hasSpeed() && acceptedLoc.speed >= 0) {
            acceptedLoc.speed * 3.6f
        } else {
            0f
        }
        if (evaluated.accepted && evaluated.deltaMeters > 0) {
            val prev = _fix.value
            if (prev.timestampMs > 0) {
                val inferred = GeoMath.speedKmh(
                    evaluated.deltaMeters,
                    (acceptedLoc.time - prev.timestampMs).coerceAtLeast(1L),
                )
                if (speed < 0.5f) speed = inferred.toFloat()
            }
            if (tripMeterActive) {
                cumulativeM += evaluated.deltaMeters
            }
        }

        val bearing = when {
            acceptedLoc.hasBearing() -> acceptedLoc.bearing
            else -> _fix.value.bearing
        }

        if (evaluated.accepted || _path.value.isEmpty()) {
            val point = acceptedLoc.latitude to acceptedLoc.longitude
            _path.update { cur ->
                if (cur.isEmpty()) listOf(point)
                else {
                    val last = cur.last()
                    val d = GeoMath.distanceMeters(last.first, last.second, point.first, point.second)
                    if (d >= 4) (cur + point).takeLast(2_000) else cur
                }
            }
        }

        if (evaluated.accepted || _fix.value.timestampMs == 0L) {
            _fix.value = DriverFix(
                lat = acceptedLoc.latitude,
                lng = acceptedLoc.longitude,
                accuracyM = acceptedLoc.accuracy,
                speedKmh = speed.coerceAtLeast(0f),
                bearing = bearing,
                altitudeM = if (acceptedLoc.hasAltitude()) acceptedLoc.altitude else null,
                timestampMs = acceptedLoc.time,
                cumulativeDistanceM = cumulativeM,
            )
        }
    }
}
