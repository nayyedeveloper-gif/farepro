package com.farepro.driver.location

import android.location.Location
import com.farepro.driver.domain.GeoMath
import kotlin.math.abs
import kotlin.math.max

/**
 * Ride-hailing GPS filter for accurate kilo distance:
 * - reject low-accuracy / mock / stale samples
 * - reject teleport jumps vs realistic max speed
 * - accuracy-aware minimum movement (worse GPS → larger jump required)
 * - optional Kalman-style position blend for display stability
 */
class AccurateLocationFilter(
    private val maxAccuracyMeters: Float = 28f,
    private val minMoveMeters: Float = 2.5f,
    private val maxSpeedKmh: Double = 140.0,
    private val maxAgeMs: Long = 6_000L,
) {
    private var lastAccepted: Location? = null
    private var smoothLat: Double? = null
    private var smoothLng: Double? = null

    data class Result(
        val accepted: Boolean,
        val location: Location?,
        val deltaMeters: Double = 0.0,
        val reason: String? = null,
    )

    fun reset() {
        lastAccepted = null
        smoothLat = null
        smoothLng = null
    }

    fun evaluate(candidate: Location, nowMs: Long = System.currentTimeMillis()): Result {
        if (!candidate.hasAccuracy() || candidate.accuracy > maxAccuracyMeters) {
            return Result(false, null, reason = "low_accuracy_${candidate.accuracy}")
        }
        @Suppress("DEPRECATION")
        if (candidate.isFromMockProvider) {
            return Result(false, null, reason = "mock")
        }
        val age = nowMs - candidate.time
        if (age > maxAgeMs || age < -5_000) {
            return Result(false, null, reason = "stale_${age}")
        }

        // Light exponential smooth for marker stability (does not affect distance math input)
        val alpha = (1f / max(1f, candidate.accuracy / 8f)).coerceIn(0.15f, 0.55f)
        val sLat = smoothLat
        val sLng = smoothLng
        if (sLat == null || sLng == null) {
            smoothLat = candidate.latitude
            smoothLng = candidate.longitude
        } else {
            smoothLat = sLat + alpha * (candidate.latitude - sLat)
            smoothLng = sLng + alpha * (candidate.longitude - sLng)
        }

        val prev = lastAccepted
        if (prev == null) {
            lastAccepted = Location(candidate)
            return Result(true, candidate, 0.0)
        }

        val dtMs = (candidate.time - prev.time).coerceAtLeast(1L)
        val delta = GeoMath.distanceMeters(
            prev.latitude, prev.longitude,
            candidate.latitude, candidate.longitude,
        )

        // Worse accuracy → demand larger real movement before counting km
        val requiredMove = minMoveMeters + (candidate.accuracy * 0.15f).coerceAtMost(8f)
        if (delta < requiredMove) {
            if (candidate.accuracy <= prev.accuracy) {
                lastAccepted = Location(candidate).also {
                    // keep lastAccepted coords for next delta baseline without adding distance
                }
            }
            return Result(false, candidate, delta, reason = "jitter")
        }

        val speed = GeoMath.speedKmh(delta, dtMs)
        if (speed > maxSpeedKmh) {
            return Result(false, null, delta, reason = "teleport_${"%.0f".format(speed)}")
        }

        if (abs(dtMs) < 800 && candidate.accuracy > prev.accuracy + 6f) {
            return Result(false, null, delta, reason = "worse_accuracy")
        }

        lastAccepted = Location(candidate)
        return Result(true, candidate, delta)
    }

    fun smoothedPoint(): Pair<Double, Double>? {
        val lat = smoothLat ?: return null
        val lng = smoothLng ?: return null
        return lat to lng
    }
}

data class DriverFix(
    val lat: Double,
    val lng: Double,
    val accuracyM: Float,
    val speedKmh: Float,
    val bearing: Float,
    val altitudeM: Double?,
    val timestampMs: Long,
    val cumulativeDistanceM: Double,
)
